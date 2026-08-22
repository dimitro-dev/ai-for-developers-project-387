#!/usr/bin/env python3
"""UISpec-валидатор: внутренняя согласованность файлов + стыки с контрактом.

Проверки V1–V11 — спецификация в docs/ui-spec-kit/AUDIT.md, Приложение П2:
  V1  api-действие ↔ ровно один Binding; Binding.action существует; api-id глобально уникальны
  V2  Binding.operation ∈ operationId из packages/contracts/generated/openapi.yaml
  V3  inline operation= в спеках запрещён
  V4  target= у navigation.* резолвится в Route/Tab/Stack id
  V5  Route.screen существует среди Meta.id; route-сироты — WARN
  V6  onSuccessState/onErrorState ∈ states экрана; onSuccessRoute ∈ routes
  V7  kind из allowlist; неизвестный атрибут <Action> — WARN
  V8  вызовы {fn(...)} ∈ реестру <Helpers> — WARN
  V9  gap-маркеры и gap= имеют запись в contract-gaps.xml; сводка open-gaps
  V10 сводка status: frontmatter; --strict не пускает draft в OK
  V11 поля source="api"-моделей ⊆ properties контрактной схемы (schema=);
      не-примитивные типы Property/Field резолвятся в Model/Enum файла или схему контракта
  --lint: повторяющийся литеральный размер (>=3 вхождений) — WARN вне exit code

Только stdlib. Контракт читается line-scan'ом generated/openapi.yaml (парсинг .tsp сознательно
не делается: openapi.yaml — его полное машинное представление, формат стабилен — эмиттер).
"""
from pathlib import Path
import argparse, json, re, sys, xml.etree.ElementTree as ET

FENCE = re.compile(r"```uispec\s*\n(.*?)\n```", re.S)
FRONT = re.compile(r"\A---\s*\n(.*?)\n---", re.S)
GAP_MARKER = re.compile(r"TODO-CONTRACT-GAP\((GAP-[A-Za-z0-9-]+)\)")
HELPER_CALL = re.compile(r"([A-Za-z_][A-Za-z0-9_]*)\s*\(")
OPERATION_ID = re.compile(r"^\s*operationId:\s*([A-Za-z0-9_]+)\s*$")
INLINE_ACTION_REF = re.compile(r"onPress:\s*'([^']+)'")

PRIMITIVES = {'string', 'boolean', 'int32', 'decimal', 'utcDateTime', 'localTime', 'url'}
EXPR_BUILTINS = {'trim', 'matches', 'isEmail'}
ACTION_KINDS = {
    'navigation.push', 'navigation.sheet', 'navigation.back', 'navigation.reset', 'navigation.tab',
    'native.share', 'api.query', 'api.command',
    'local.update', 'local.dispatch', 'local.submit', 'local.transition',
}
ACTION_ATTRS = {
    'id', 'kind', 'target', 'path', 'value', 'disabledWhen',
    'onSuccessState', 'onErrorState', 'onSuccessRoute', 'onSuccessWhen', 'onErrorWhen',
    'preserveContent', 'markDirty', 'before', 'after', 'afterWhen', 'onConflict', 'result', 'gap',
}
BRANCH_ATTRS = ('onSuccessWhen', 'onErrorWhen')
ACTION_REF_ATTRS = ('onPress', 'onChange', 'onCancel', 'onConfirm', 'refreshAction', 'backAction', 'ctaAction')
SIZE_ATTRS = {'height', 'width', 'minHeight', 'maxHeight', 'size'}
REF_PREFIXES = ('$state', '$data', '$event', '$result', '$error', '$props', '$item', '$group',
                '$booking', '$interval', '$validation', '$accessibility', '$system', '$asset',
                '$action', '$route')
BUILTIN_TAGS = {'ScreenSpec', 'ComponentSpec', 'Meta', 'Viewport', 'Data', 'Model', 'Field', 'Enum',
                'StateMachine', 'State', 'Property', 'Actions', 'Action', 'Param', 'Payload',
                'Validation', 'Rule', 'Layout', 'Props', 'Prop', 'Slot', 'SlotRef', 'Motion',
                'ProgressBar', 'ProgressIndicator', 'ConfirmationDialog'}


def parse_frontmatter(text):
    m = FRONT.search(text)
    result = {}
    if not m:
        return result
    for line in m.group(1).splitlines():
        if ':' in line and not line.startswith(' '):
            k, v = line.split(':', 1)
            result[k.strip()] = v.strip().strip('"\'')
    return result


def load_config(config_arg):
    path = Path(config_arg)
    if not path.exists():
        return {}, None
    return json.loads(path.read_text(encoding='utf-8')), path.parent


def resolve_paths(args):
    """ui_root — из positional path или config.sourceRoot; остальные пути — из config либо дефолты."""
    config, config_dir = load_config(args.config)
    files = None
    if args.path:
        target = Path(args.path)
        if target.is_file():
            ui_root = target.parent.parent if target.parent.name in {'screens', 'components'} else target.parent
            files = [target]
        else:
            ui_root = target
    elif config and config_dir is not None:
        ui_root = config_dir / config.get('sourceRoot', 'specs/ui')
    else:
        print('ERROR: не задан ни путь до specs, ни uispec.config.json')
        raise SystemExit(2)

    def cfg_path(key, default_rel):
        if config and config.get(key) and config_dir is not None:
            return config_dir / config[key]
        return ui_root / default_rel

    paths = {
        'ui_root': ui_root,
        'tokens': cfg_path('tokens', 'tokens'),
        'registry': cfg_path('registry', 'registry/components.registry.xml'),
        'bindings': cfg_path('apiBindings', 'bindings/api-bindings.xml'),
        'gaps': cfg_path('contractGaps', 'bindings/contract-gaps.xml'),
        'navigation': cfg_path('navigation', 'navigation/navigation.uispec.xml'),
    }
    if config and config.get('openapi') and config_dir is not None:
        paths['openapi'] = config_dir / config['openapi']
    else:
        paths['openapi'] = None
        probe = ui_root.resolve()
        for _ in range(6):
            candidate = probe / 'packages/contracts/generated/openapi.yaml'
            if candidate.exists():
                paths['openapi'] = candidate
                break
            probe = probe.parent
    full_scan = files is None
    if files is None:
        files = sorted(list((ui_root / 'screens').glob('*.screen.md')) +
                       list((ui_root / 'components').glob('*.component.md')))
    return paths, files, full_scan


def collect_tokens(tokens_dir, problems):
    tokens = set()
    for p in sorted(Path(tokens_dir).glob('*.xml')):
        try:
            tree = ET.parse(p)
            for el in tree.getroot():
                if el.get('id'):
                    tokens.add('$' + el.get('id'))
        except ET.ParseError as e:
            problems.append(f'ERROR {p}: invalid token XML: {e}')
    return tokens


def collect_registry(registry_path, problems):
    tags, helpers = set(), set()
    path = Path(registry_path)
    if not path.exists():
        problems.append(f'ERROR {path}: components.registry.xml не найден')
        return tags | BUILTIN_TAGS, helpers
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as e:
        problems.append(f'ERROR {path}: invalid XML: {e}')
        return tags | BUILTIN_TAGS, helpers
    tags = {el.get('tag') for el in root.findall('Component')}
    helpers = {el.get('name') for el in root.findall('Helpers/Helper') if el.get('name')}
    return tags | BUILTIN_TAGS, helpers


def collect_bindings(bindings_path, problems):
    """V1/V2: action -> список записей {operation, gap, screen}."""
    bindings = {}
    path = Path(bindings_path)
    if not path.exists():
        problems.append(f'ERROR {path}: api-bindings.xml не найден')
        return bindings
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as e:
        problems.append(f'ERROR {path}: invalid XML: {e}')
        return bindings
    for el in root.findall('Binding'):
        action = el.get('action')
        if not action:
            problems.append(f'ERROR {path}: Binding без action')
            continue
        bindings.setdefault(action, []).append(
            {'operation': el.get('operation'), 'gap': el.get('gap'), 'screen': el.get('screen')})
    return bindings


def collect_gaps(gaps_path, problems):
    gaps = {}
    path = Path(gaps_path)
    if not path.exists():
        return gaps  # реестр опционален, пока нет ни одного gap
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as e:
        problems.append(f'ERROR {path}: invalid XML: {e}')
        return gaps
    for el in root.findall('Gap'):
        if el.get('id'):
            gaps[el.get('id')] = el.get('status', 'open')
    return gaps


def collect_navigation(nav_path, problems):
    """V4/V5/V6: navigation-ids, route->screen, implicit-initial routes."""
    nav = {'target_ids': set(), 'route_ids': set(), 'route_screen': {}, 'initial': set()}
    path = Path(nav_path)
    if not path.exists():
        problems.append(f'ERROR {path}: navigation.uispec.xml не найден')
        return nav
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as e:
        problems.append(f'ERROR {path}: invalid XML: {e}')
        return nav
    for el in root.iter():
        if el.tag in {'Route', 'Tab', 'Stack', 'Tabs'} and el.get('id'):
            nav['target_ids'].add(el.get('id'))
        if el.tag == 'Route' and el.get('id'):
            nav['route_ids'].add(el.get('id'))
            nav['route_screen'][el.get('id')] = el.get('screen')
        if el.get('initial'):
            nav['initial'].add(el.get('initial'))
        if el.tag in {'Stack', 'Tab', 'Tabs', 'Root'}:
            first = next((c for c in el if c.tag == 'Route'), None)
            if first is not None and first.get('id'):
                nav['initial'].add(first.get('id'))
    return nav


def collect_openapi(openapi_path, problems):
    """Line-scan generated/openapi.yaml: operationId + components.schemas.properties."""
    operations, schemas = set(), {}
    if openapi_path is None or not Path(openapi_path).exists():
        problems.append(f'WARN  {openapi_path}: openapi.yaml не найден — проверки V2/V11 против контракта пропущены')
        return operations, schemas
    in_components = in_schemas = False
    current_schema, in_properties = None, False
    for line in Path(openapi_path).read_text(encoding='utf-8').splitlines():
        m = OPERATION_ID.match(line)
        if m:
            operations.add(m.group(1))
        stripped = line.strip()
        indent = len(line) - len(line.lstrip(' '))
        if not stripped or stripped.startswith('#'):
            continue
        if indent == 0:
            in_components = stripped == 'components:'
            in_schemas = False
            continue
        if in_components and indent == 2:
            in_schemas = stripped == 'schemas:'
            continue
        if in_schemas and indent == 4 and stripped.endswith(':'):
            current_schema = stripped[:-1]
            schemas[current_schema] = set()
            in_properties = False
            continue
        if current_schema and indent == 6:
            in_properties = stripped == 'properties:'
            continue
        if current_schema and in_properties and indent == 8 and stripped.endswith(':'):
            schemas[current_schema].add(stripped[:-1])
    return operations, schemas


def validate_file(path, ctx):
    errors, warnings = [], []
    text = path.read_text(encoding='utf-8')
    fm = parse_frontmatter(text)
    status = fm.get('status', '')
    blocks = FENCE.findall(text)
    if len(blocks) != 1:
        return [f'expected exactly one uispec block, found {len(blocks)}'], warnings, status, {}
    try:
        root = ET.fromstring(blocks[0])
    except ET.ParseError as e:
        return [f'XML parse error: {e}'], warnings, status, {}
    if root.tag not in {'ScreenSpec', 'ComponentSpec'}:
        errors.append(f'root must be ScreenSpec or ComponentSpec, got {root.tag}')
    if not root.get('version'):
        errors.append('корневой элемент обязан иметь version= (правило бывшего uispec.xsd)')
    meta = root.find('Meta')
    screen_id = meta.get('id') if meta is not None else None
    if meta is None or not meta.get('id'):
        errors.append('Meta id is required')
    elif fm.get('id') and fm.get('id') != meta.get('id'):
        errors.append(f'frontmatter id {fm.get("id")} != Meta id {meta.get("id")}')

    actions = {a.get('id') for a in root.findall('.//Action') if a.get('id')}
    states = {s.get('id') for s in root.findall('.//State') if s.get('id')}
    local_types = set(PRIMITIVES)
    models = {}
    data = root.find('Data')
    if data is not None:
        for enum in data.findall('Enum'):
            local_types.add(enum.get('name'))
        for model in data.findall('Model'):
            local_types.add(model.get('name'))
            models[model.get('name')] = model

    file_info = {'screen_id': screen_id, 'route': meta.get('route') if meta is not None else None,
                 'api_actions': set(), 'nav_targets': [], 'route_refs': set(), 'gap_refs': set(),
                 'size_literals': []}

    # gap-маркеры в прозе файла (V9)
    file_info['gap_refs'].update(GAP_MARKER.findall(text))

    ids = []
    for el in root.iter():
        if el.tag not in ctx['registry_tags']:
            errors.append(f'unregistered tag <{el.tag}>')
        if el.get('id'):
            ids.append(el.get('id'))
        # gap= — contract-gap маркер только на Action/Model/Field/Property;
        # на layout-элементах gap= — flexbox-отступ, не трогаем
        if el.tag in {'Action', 'Model', 'Field', 'Property'} and el.get('gap'):
            file_info['gap_refs'].add(el.get('gap'))
        for k, v in el.attrib.items():
            for ref in re.findall(r'\$[A-Za-z][A-Za-z0-9_.-]*', v):
                if ref.startswith(REF_PREFIXES):
                    continue
                if ref not in ctx['tokens']:
                    warnings.append(f'unknown token/reference {ref} at <{el.tag} {k}=...>')
            # V8: вызовы helpers внутри {...}-биндов
            for expr in re.findall(r'\{[^{}]*\}', v):
                for fn in HELPER_CALL.findall(expr):
                    if fn not in ctx['helpers'] and fn not in EXPR_BUILTINS:
                        warnings.append(f'V8: helper {fn}() не объявлен в реестре <Helpers> (<{el.tag} {k}=...>)')
            if k in SIZE_ATTRS and v.isdigit() and el.tag != 'Viewport':
                file_info['size_literals'].append((k, v))
        for attr in ACTION_REF_ATTRS:
            val = el.get(attr)
            if val and not val.startswith(('$', '{')) and val not in actions:
                errors.append(f'{el.tag}.{attr} references missing action {val}')
        if el.tag == 'Header' and el.get('rightActions'):
            for ref in INLINE_ACTION_REF.findall(el.get('rightActions')):
                if ref not in actions:
                    errors.append(f'Header.rightActions references missing action {ref}')
        if el.tag == 'IconButton' and not el.get('accessibilityLabel'):
            errors.append('IconButton requires accessibilityLabel')
        if el.tag in {'Button', 'IconButton', 'TimeField', 'TextField', 'SelectField'}:
            numeric = el.get('height') or el.get('size') or el.get('minItemSize')
            if numeric and numeric.isdigit() and int(numeric) < 48:
                warnings.append(f'{el.tag} touch target {numeric}dp is below Android recommendation 48dp')
        if el.get('x') or el.get('y'):
            if el.get('position') != 'absolute':
                errors.append(f'{el.tag} uses x/y without position="absolute"')

        if el.tag == 'Action':
            kind = el.get('kind', '')
            if kind not in ACTION_KINDS:
                errors.append(f'V7: Action {el.get("id")}: kind "{kind}" вне allowlist')
            for k in el.attrib:
                if k not in ACTION_ATTRS:
                    warnings.append(f'V7: Action {el.get("id")}: неизвестный атрибут {k}=')
            if el.get('operation'):
                errors.append(f'V3: Action {el.get("id")}: inline operation= запрещён — связь только через api-bindings.xml')
            if kind.startswith('api.') and el.get('id'):
                file_info['api_actions'].add(el.get('id'))
            if kind.startswith('navigation.') and el.get('target'):
                file_info['nav_targets'].append((el.get('id'), el.get('target')))
            for attr in ('onSuccessState', 'onErrorState'):
                val = el.get(attr)
                if val and val not in states:
                    errors.append(f'V6: Action {el.get("id")}: {attr}="{val}" не является state этого экрана')
            val = el.get('onSuccessRoute')
            if val:
                file_info['route_refs'].add(val)
                if ctx['nav']['route_ids'] and val not in ctx['nav']['route_ids']:
                    errors.append(f'V6: Action {el.get("id")}: onSuccessRoute="{val}" не является route из navigation.uispec.xml')
            # ветви onSuccessWhen/onErrorWhen как ERROR не проверяются (неразличимость state/route,
            # находка C3) — учитываются только route-цели, иначе V5 сочтёт route сиротой
            for attr in BRANCH_ATTRS:
                when = el.get(attr)
                if when:
                    for branch in when.split(';'):
                        if ':' in branch:
                            file_info['route_refs'].add(branch.rsplit(':', 1)[1].strip())

        # V11: типы Property/Field и поля source="api"-моделей
        if el.tag in {'Property', 'Field'}:
            typ = (el.get('type') or 'string').removesuffix('[]')
            if typ not in local_types and typ not in ctx['schemas'] and ctx['schemas']:
                errors.append(f'V11: {el.tag} {el.get("name")}: тип "{typ}" не резолвится ни в Model/Enum файла, ни в схему контракта')

    for name, model in models.items():
        if model.get('source') == 'api':
            schema = model.get('schema')
            if not schema:
                warnings.append(f'V11: Model {name}: source="api" без атрибута schema= (контрактная схема неизвестна)')
            elif ctx['schemas']:
                if schema not in ctx['schemas']:
                    errors.append(f'V11: Model {name}: schema="{schema}" отсутствует в контракте')
                else:
                    for field in model.findall('Field'):
                        if field.get('name') not in ctx['schemas'][schema]:
                            errors.append(f'V11: Model {name}: поле {field.get("name")} отсутствует в контрактной схеме {schema}')

    if len(ids) != len(set(ids)):
        errors.append('duplicate id attributes found')
    for sv in root.findall('.//StateView'):
        val = sv.get('state')
        if val:
            for st in val.split('|'):
                if st and st not in states:
                    errors.append(f'StateView references missing state {st}')
    return errors, warnings, status, file_info


def main():
    ap = argparse.ArgumentParser(description='UISpec validator (V1–V11, см. AUDIT.md П2)')
    ap.add_argument('path', nargs='?', help='UISpec root directory или один markdown-спек')
    ap.add_argument('--config', default='uispec.config.json', help='путь до uispec.config.json')
    ap.add_argument('--strict', action='store_true', help='draft-файлы не получают OK и считаются ошибкой')
    ap.add_argument('--lint', action='store_true', help='подсказки по повторяющимся литеральным размерам (вне exit code)')
    args = ap.parse_args()

    problems = []
    paths, files, full_scan = resolve_paths(args)
    tokens = collect_tokens(paths['tokens'], problems)
    registry_tags, helpers = collect_registry(paths['registry'], problems)
    bindings = collect_bindings(paths['bindings'], problems)
    gaps = collect_gaps(paths['gaps'], problems)
    nav = collect_navigation(paths['navigation'], problems)
    operations, schemas = collect_openapi(paths['openapi'], problems)
    ctx = {'tokens': tokens, 'registry_tags': registry_tags, 'helpers': helpers,
           'nav': nav, 'schemas': schemas}

    total_errors = 0
    for line in problems:
        print(line)
        if line.startswith('ERROR'):
            total_errors += 1

    statuses, all_infos, draft_files = {}, {}, []
    for f in files:
        errors, warnings, status, info = validate_file(f, ctx)
        statuses[status or '(нет status)'] = statuses.get(status or '(нет status)', 0) + 1
        all_infos[f] = info
        for w in warnings:
            print(f'WARN  {f}: {w}')
        for e in errors:
            print(f'ERROR {f}: {e}')
        if errors:
            total_errors += len(errors)
        elif args.strict and status == 'draft':
            print(f'DRAFT {f}: status=draft не проходит --strict')
            draft_files.append(f)
        else:
            print(f'OK    {f}')

    # --- кросс-файловые проверки ---
    screen_of_action, cross = {}, []
    for f, info in all_infos.items():
        for a in info.get('api_actions', ()):  # V1: глобальная уникальность
            if a in screen_of_action:
                cross.append(f'ERROR {f}: V1: api-action id "{a}" уже объявлен в {screen_of_action[a][0]}')
            else:
                screen_of_action[a] = (f, info.get('screen_id'))
    for a, (f, screen_id) in screen_of_action.items():
        entries = bindings.get(a, [])
        if len(entries) != 1:
            cross.append(f'ERROR {f}: V1: api-action "{a}" имеет {len(entries)} Binding (нужен ровно один)')
            continue
        b = entries[0]
        if b['screen'] and screen_id and b['screen'] != screen_id:
            cross.append(f'ERROR {f}: V1: Binding "{a}" объявляет screen="{b["screen"]}", фактический экран {screen_id}')
        if b['operation']:
            if operations and b['operation'] not in operations:
                cross.append(f'ERROR {f}: V2: Binding "{a}": operation "{b["operation"]}" отсутствует в openapi.yaml')
        elif not b['gap']:
            cross.append(f'ERROR {f}: V2: Binding "{a}" не имеет ни operation, ни gap')
        if b['gap'] and b['gap'] not in gaps:
            cross.append(f'ERROR {f}: V9: Binding "{a}": gap "{b["gap"]}" не зарегистрирован в contract-gaps.xml')
    if full_scan:  # при одиночном файле остальные действия просто не в наборе
        for action, entries in bindings.items():
            if action not in screen_of_action:
                cross.append(f'ERROR {paths["bindings"]}: V1: Binding "{action}" не соответствует ни одному api-действию экранов')

    used_routes = set(nav['initial'])
    for f, info in all_infos.items():
        used_routes.update(info.get('route_refs', ()))
        for action_id, target in info.get('nav_targets', ()):  # V4
            used_routes.add(target)
            if nav['target_ids'] and target not in nav['target_ids']:
                cross.append(f'ERROR {f}: V4: Action {action_id}: target="{target}" отсутствует в navigation.uispec.xml')
        for gap in info.get('gap_refs', ()):  # V9
            if gap not in gaps:
                cross.append(f'ERROR {f}: V9: маркер {gap} не зарегистрирован в contract-gaps.xml')

    declared_screens = {info.get('screen_id') for info in all_infos.values()}
    if full_scan:  # V5 имеет смысл только при прогоне всего набора (не одиночного файла)
        for route_id, screen in nav['route_screen'].items():
            if screen not in declared_screens:
                cross.append(f'ERROR {paths["navigation"]}: V5: Route {route_id}: screen "{screen}" не найден среди Meta.id')
            if route_id not in used_routes:
                cross.append(f'WARN  {paths["navigation"]}: V5: Route {route_id} — сирота: ни один target/onSuccessRoute его не использует')

    for line in cross:
        print(line)
        if line.startswith('ERROR'):
            total_errors += 1

    # --- сводки ---
    print('--- Статусы (V10): ' + ', '.join(f'{k}={v}' for k, v in sorted(statuses.items())))
    open_gaps = [g for g, s in sorted(gaps.items()) if s not in {'resolved', 'rejected'}]
    if open_gaps:
        print('--- Contract gaps (V9, не resolved): ' + ', '.join(f'{g} ({gaps[g]})' for g in open_gaps))

    if args.lint:
        counts = {}
        for f, info in all_infos.items():
            for k, v in info.get('size_literals', ()):
                counts.setdefault(v, []).append(f'{Path(f).name}:{k}')
        for value, places in sorted(counts.items(), key=lambda kv: -len(kv[1])):
            if len(places) >= 3:
                print(f'LINT  размер "{value}" повторяется {len(places)} раз — вынеси в токен ({", ".join(sorted(set(places))[:5])}…)')

    strict_failures = len(draft_files) if args.strict else 0
    print(f'Validated {len(files)} files; errors={total_errors}' +
          (f'; strict-draft={strict_failures}' if args.strict else ''))
    raise SystemExit(1 if (total_errors or strict_failures) else 0)


if __name__ == '__main__':
    main()
