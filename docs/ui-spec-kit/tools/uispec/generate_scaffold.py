#!/usr/bin/env python3
"""Генерирует TypeScript-каркас и TSP-фрагмент моделей по одному спеку UISpec.

Файл ищется по переданному пути; если путь не существует и задан/найден
uispec.config.json — дополнительно в каталогах screens/ и components/ из конфига.
"""
from pathlib import Path
import argparse, json, re, sys, xml.etree.ElementTree as ET

FENCE = re.compile(r"```uispec\s*\n(.*?)\n```", re.S)

TS_TYPES = {'string':'string','boolean':'boolean','int32':'number','decimal':'number','utcDateTime':'UtcDateTime','localTime':'LocalTime','url':'Url'}

API_CLIENT_MODULE = '@minical/api-client'
RUNTIME_MODULE = './uispec-runtime'
RUNTIME_FILE = 'uispec-runtime.ts'
BRANDED = ('UtcDateTime', 'LocalTime', 'Url')
RUNTIME_SOURCE = """// Shared branded primitives for UISpec-generated types. Generated once; safe to keep in VCS.
export type UtcDateTime = string & { readonly __brand: 'UtcDateTime' };
export type LocalTime = string & { readonly __brand: 'LocalTime' };
export type Url = string & { readonly __brand: 'Url' };
"""

TSP_HEADER = """// Generated model fragments from a UISpec file. NOT compilable standalone:
// models with source="api" are skipped by design, so references to them — and to
// models declared in other specs — stay unresolved here.
// Merge into packages/contracts/src/**/*.tsp only through Contract Agent review.
"""


def pascal(s):
    return ''.join(x[:1].upper()+x[1:] for x in re.split(r'[^A-Za-z0-9]+', s) if x)


def ts_type(t):
    if t.endswith('[]'):
        return ts_type(t[:-2]) + '[]'
    return TS_TYPES.get(t, t)


def ts_default(raw):
    """Значение default= из спека → литерал TypeScript."""
    v = raw.strip()
    if v in ('true', 'false'):
        return v
    if re.fullmatch(r'-?\d+', v):
        return v
    if v.startswith('[') and v.endswith(']'):
        items = [i.strip() for i in v[1:-1].split(',') if i.strip()]
        return '[' + ', '.join(f"'{i}'" for i in items) + ']'
    return "'" + v.replace("'", "\\'") + "'"


def parse(path):
    text = path.read_text(encoding='utf-8')
    blocks = FENCE.findall(text)
    if len(blocks) != 1:
        raise ValueError(f'{path}: expected exactly one uispec block, found {len(blocks)}')
    return ET.fromstring(blocks[0])


def resolve(file_arg, config_arg):
    path = Path(file_arg)
    if path.exists():
        return path
    config_path = Path(config_arg)
    if config_path.exists():
        config = json.loads(config_path.read_text(encoding='utf-8'))
        for key in ('screens', 'components'):
            candidate = config_path.parent / config.get(key, '') / file_arg
            if config.get(key) and candidate.exists():
                return candidate
    raise FileNotFoundError(file_arg)


def render_types(root, screen_name):
    lines = []
    api_imports = []      # схемы контракта, импортируемые из @minical/api-client
    api_aliases = []      # export type <Name> = <Schema>; и реэкспорты одноимённых
    data = root.find('Data')
    if data is not None:
        for enum in data.findall('Enum'):
            vals = [v.strip() for v in enum.get('values','').split(',') if v.strip()]
            lines.append(f"export type {enum.get('name')} = " + ' | '.join(repr(v) for v in vals) + ';\n')
        for model in data.findall('Model'):
            name = model.get('name')
            schema = model.get('schema')
            if model.get('source') == 'api':
                if schema:
                    if schema not in api_imports:
                        api_imports.append(schema)
                    # реэкспорт формой `export type {X} from ...` не создаёт локального
                    # имени, а модели этого же файла на него ссылаются — поэтому import + export
                    api_aliases.append(f'export type {{ {schema} }};' if name == schema
                                       else f'export type {name} = {schema};')
                    continue
                print(f'WARN  Model {name}: source="api" без schema= — генерируется локальный '
                      f'интерфейс-дубль вместо импорта из {API_CLIENT_MODULE}', file=sys.stderr)
            lines.append(f"export interface {name} {{")
            for field in model.findall('Field'):
                opt = '?' if field.get('required','true') == 'false' else ''
                lines.append(f"  {field.get('name')}{opt}: {ts_type(field.get('type','string'))};")
            lines.append('}\n')
    sm = root.find('StateMachine')
    if sm is not None:
        members=[]
        defaults=[]
        state_map={s.get('id'): s for s in sm.findall('State')}
        def properties_for(state):
            props=[]
            base=state.get('extends')
            if base and base in state_map:
                props.extend(properties_for(state_map[base]))
            props.extend(list(state.findall('Property')))
            return props
        for state in sm.findall('State'):
            props=[f"kind: {state.get('id')!r}"]
            entries=[]
            for prop in properties_for(state):
                props.append(f"{prop.get('name')}: {ts_type(prop.get('type','string'))}")
                if prop.get('default') is not None:
                    entries.append((prop.get('name'), ts_default(prop.get('default'))))
            members.append('  | { ' + '; '.join(props) + ' }')
            if entries:
                defaults.append(f"export const {screen_name}{pascal(state.get('id'))}Defaults = {{")
                defaults.extend(f"  {n}: {v}," for n, v in entries)
                defaults.append('} as const;\n')
        lines.append(f"export type {screen_name}State =\n" + '\n'.join(members) + ';\n')
        lines.extend(defaults)
    acts = root.find('Actions')
    if acts is not None:
        members=[]
        for a in acts.findall('Action'):
            props=[f"type: {a.get('id')!r}"]
            for p in a.findall('Param'):
                declared = p.get('type')
                props.append(f"{p.get('name')}: {ts_type(declared) if declared else 'unknown'}")
            members.append('  | { ' + '; '.join(props) + ' }')
        lines.append(f"export type {screen_name}Action =\n" + '\n'.join(members) + ';\n')

    body = '\n'.join(lines)
    header = []
    if api_imports:
        header.append(f"import type {{ {', '.join(sorted(api_imports))} }} from '{API_CLIENT_MODULE}';")
    branded = [b for b in BRANDED if re.search(rf'\b{b}\b', body)]
    if branded:
        header.append(f"import type {{ {', '.join(branded)} }} from '{RUNTIME_MODULE}';")
    if header:
        header.append('')
    if api_aliases:
        header.extend(api_aliases)
        header.append('')
    return '\n'.join(header + [body]) if header else body


def render_tsp(root):
    lines=[TSP_HEADER]
    data=root.find('Data')
    if data is None: return '\n'.join(lines)
    for enum in data.findall('Enum'):
        lines.append(f"enum {enum.get('name')} {{")
        for v in enum.get('values','').split(','):
            v=v.strip()
            if v: lines.append(f"  {v},")
        lines.append('}\n')
    for model in data.findall('Model'):
        if model.get('source') == 'api':
            lines.append(f"// {model.get('name')} is source=api; reference existing TypeSpec model instead of duplicating it.\n")
            continue
        lines.append(f"model {model.get('name')} {{")
        for f in model.findall('Field'):
            typ=f.get('type','string')
            mapping={'int32':'int32','decimal':'decimal','boolean':'boolean','string':'string','utcDateTime':'utcDateTime','localTime':'string','url':'url'}
            if typ.endswith('[]'): typ=mapping.get(typ[:-2],typ[:-2])+'[]'
            else: typ=mapping.get(typ,typ)
            opt='?' if f.get('required','true')=='false' else ''
            if f.get('format'): lines.append(f"  @format(\"{f.get('format')}\")")
            lines.append(f"  {f.get('name')}{opt}: {typ};")
        lines.append('}\n')
    return '\n'.join(lines)


def render_tsx(root, screen_name):
    meta=root.find('Meta'); sid=meta.get('id') if meta is not None else screen_name
    return f"""// Generated scaffold from UISpec. Do not edit this file directly.\nimport React from 'react';\nimport type {{ {screen_name}Action, {screen_name}State }} from './{screen_name}.types.generated';\n\nexport interface {screen_name}GeneratedProps {{\n  state: {screen_name}State;\n  dispatch: (action: {screen_name}Action) => void;\n}}\n\nexport function {screen_name}GeneratedView(props: {screen_name}GeneratedProps) {{\n  // TODO: map UISpec Layout nodes through the project component registry.\n  // Source screen: {sid}\n  return null;\n}}\n"""


def main():
    ap=argparse.ArgumentParser(description='Generate a TypeScript/TSP scaffold from a UISpec file')
    ap.add_argument('file', help='спек-файл или имя файла внутри screens/components из конфига')
    ap.add_argument('--out',required=True)
    ap.add_argument('--config', default='uispec.config.json', help='путь до uispec.config.json')
    args=ap.parse_args()
    try:
        path=resolve(args.file, args.config)
        root=parse(path)
    except (FileNotFoundError, ValueError) as e:
        print(e, file=sys.stderr)
        raise SystemExit(2)
    meta=root.find('Meta')
    name=pascal((meta.get('route') if meta is not None and meta.get('route') else path.stem.split('.')[0]))
    out=Path(args.out); out.mkdir(parents=True,exist_ok=True)
    runtime=out/RUNTIME_FILE
    if not runtime.exists():
        runtime.write_text(RUNTIME_SOURCE,encoding='utf-8')
    (out/f'{name}.types.generated.ts').write_text(render_types(root,name),encoding='utf-8')
    (out/f'{name}.generated.tsx').write_text(render_tsx(root,name),encoding='utf-8')
    (out/f'{name}.models.generated.tsp').write_text(render_tsp(root),encoding='utf-8')
    print(f'Generated scaffold for {name} in {out}')

if __name__=='__main__': main()
