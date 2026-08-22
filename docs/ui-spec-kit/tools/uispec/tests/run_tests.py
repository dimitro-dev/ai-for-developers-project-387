#!/usr/bin/env python3
"""Негативные фикстуры валидатора (acceptance R2, AUDIT.md C13/П2).

Собирает во временной директории минимальный валидный kit (BASE), затем для каждого
кейса вносит ровно одну поломку и проверяет, что валидатор её ловит: exit code,
подстрока в выводе. Первый кейс — контроль: BASE без поломок проходит с errors=0.

Запуск: python3 tools/uispec/tests/run_tests.py
Только stdlib.
"""
from pathlib import Path
import json, subprocess, sys, tempfile

VALIDATOR = Path(__file__).resolve().parent.parent / 'validate_uispec.py'

CONFIG = {
    "version": "0.1",
    "sourceRoot": "specs/ui",
    "screens": "specs/ui/screens",
    "components": "specs/ui/components",
    "tokens": "specs/ui/tokens",
    "registry": "specs/ui/registry/components.registry.xml",
    "apiBindings": "specs/ui/bindings/api-bindings.xml",
    "navigation": "specs/ui/navigation/navigation.uispec.xml",
    "contractGaps": "specs/ui/bindings/contract-gaps.xml",
    "openapi": "openapi.yaml",
}

OPENAPI = """openapi: 3.0.0
info:
  title: fixture
paths:
  /things:
    get:
      operationId: getThings
components:
  schemas:
    Thing:
      type: object
      required:
        - id
      properties:
        id:
          type: string
        name:
          type: string
"""

TOKENS = """<?xml version="1.0" encoding="UTF-8"?>
<DesignTokens version="0.1">
  <Size id="size.button.height" value="48" />
</DesignTokens>
"""

REGISTRY = """<?xml version="1.0" encoding="UTF-8"?>
<ComponentRegistry version="0.1">
  <Component tag="Column" reactNative="Column" import="@/x/Column" />
  <Component tag="Text" reactNative="AppText" import="@/x/AppText" />
  <Component tag="Button" reactNative="AppButton" import="@/x/AppButton" />
  <Component tag="StateView" reactNative="StateView" import="@/x/StateView" />
  <Helpers>
    <Helper name="thingLabel" signature="(name: string) =&gt; string" module="@/x/lib">Подпись.</Helper>
  </Helpers>
</ComponentRegistry>
"""

NAVIGATION = """<?xml version="1.0" encoding="UTF-8"?>
<NavigationSpec version="0.1">
  <Root initial="Things">
    <Route id="Things" screen="fixture.things" presentation="screen" />
  </Root>
</NavigationSpec>
"""

BINDINGS = """<?xml version="1.0" encoding="UTF-8"?>
<ApiBindings version="0.1">
  <Binding action="loadThings" operation="getThings" screen="fixture.things" />
</ApiBindings>
"""

GAPS = """<?xml version="1.0" encoding="UTF-8"?>
<ContractGaps version="0.1">
  <Gap id="GAP-900" status="open" severity="low" blocking="false" screens="fixture.things">
    <Missing>fixture</Missing>
  </Gap>
</ContractGaps>
"""

SCREEN = """---
id: fixture.things
route: Things
status: approved
---

# Fixture

```uispec
<ScreenSpec version="0.1">
  <Meta id="fixture.things" route="Things" title="Things" />
  <Data>
    <Model name="Thing" source="api" schema="Thing"><Field name="id" type="string" /><Field name="name" type="string" /></Model>
  </Data>
  <StateMachine initial="loading">
    <State id="loading" />
    <State id="content"><Property name="items" type="Thing[]" /></State>
    <State id="error"><Property name="message" type="string" /></State>
  </StateMachine>
  <Actions>
    <Action id="loadThings" kind="api.query" onSuccessState="content" onErrorState="error" />
    <Action id="retryThings" kind="local.dispatch" target="loadThings" />
  </Actions>
  <Layout type="column">
    <StateView state="content"><Column><Text value="{thingLabel($state.items)}" /></Column></StateView>
    <StateView state="error"><Button variant="secondary" height="$size.button.height" label="Повторить" onPress="retryThings" /></StateView>
  </Layout>
</ScreenSpec>
```

## UX rules

- fixture

## Acceptance criteria

- fixture
"""


def write_kit(root: Path):
    (root / 'specs/ui/screens').mkdir(parents=True)
    (root / 'specs/ui/components').mkdir(parents=True)
    (root / 'specs/ui/tokens').mkdir(parents=True)
    (root / 'specs/ui/registry').mkdir(parents=True)
    (root / 'specs/ui/bindings').mkdir(parents=True)
    (root / 'specs/ui/navigation').mkdir(parents=True)
    (root / 'uispec.config.json').write_text(json.dumps(CONFIG, indent=2), encoding='utf-8')
    (root / 'openapi.yaml').write_text(OPENAPI, encoding='utf-8')
    (root / 'specs/ui/tokens/base.tokens.xml').write_text(TOKENS, encoding='utf-8')
    (root / 'specs/ui/registry/components.registry.xml').write_text(REGISTRY, encoding='utf-8')
    (root / 'specs/ui/navigation/navigation.uispec.xml').write_text(NAVIGATION, encoding='utf-8')
    (root / 'specs/ui/bindings/api-bindings.xml').write_text(BINDINGS, encoding='utf-8')
    (root / 'specs/ui/bindings/contract-gaps.xml').write_text(GAPS, encoding='utf-8')
    (root / 'specs/ui/screens/01-things.screen.md').write_text(SCREEN, encoding='utf-8')


# Кейс: (имя, mutate(root), extra_args, ожидаемый exit, ожидание по выводу)
# Ожидание по выводу — подстрока либо tuple подстрок; подстрока с ведущим '!' обязана
# в выводе ОТСУТСТВОВАТЬ (положительные кейсы: «атрибут разрешён, а не просто не падает»).
def mutate_noop(root): pass


def replace_in(path: Path, old: str, new: str):
    text = path.read_text(encoding='utf-8')
    assert old in text, f'fixture mutation target not found: {old!r}'
    path.write_text(text.replace(old, new), encoding='utf-8')


CASES = [
    ('base-ok', mutate_noop, [], 0, 'errors=0'),
    ('V1-binding-missing', lambda r: replace_in(
        r / 'specs/ui/bindings/api-bindings.xml',
        '<Binding action="loadThings" operation="getThings" screen="fixture.things" />', ''),
     [], 1, 'V1: api-action "loadThings" имеет 0 Binding'),
    ('V1-binding-unknown-action', lambda r: replace_in(
        r / 'specs/ui/bindings/api-bindings.xml',
        '</ApiBindings>', '  <Binding action="ghostAction" operation="getThings" screen="fixture.things" />\n</ApiBindings>'),
     [], 1, 'V1: Binding "ghostAction" не соответствует'),
    ('V1-duplicate-api-id', lambda r: (r / 'specs/ui/screens/02-copy.screen.md').write_text(
        SCREEN.replace('fixture.things', 'fixture.copy').replace('route: Things', 'route: Things2')
              .replace('route="Things"', 'route="Things2"'), encoding='utf-8'),
     [], 1, 'V1: api-action id "loadThings" уже объявлен'),
    ('V2-foreign-operation', lambda r: replace_in(
        r / 'specs/ui/bindings/api-bindings.xml', 'operation="getThings"', 'operation="OwnerSetup.getState"'),
     [], 1, 'V2: Binding "loadThings": operation "OwnerSetup.getState" отсутствует'),
    ('V3-inline-operation', lambda r: replace_in(
        r / 'specs/ui/screens/01-things.screen.md',
        '<Action id="loadThings" kind="api.query"', '<Action id="loadThings" kind="api.query" operation="getThings"'),
     [], 1, 'V3'),
    ('V4-missing-target', lambda r: replace_in(
        r / 'specs/ui/screens/01-things.screen.md',
        '<Action id="retryThings" kind="local.dispatch" target="loadThings" />',
        '<Action id="openGhost" kind="navigation.sheet" target="GhostSheet" /><Action id="retryThings" kind="local.dispatch" target="loadThings" />'),
     [], 1, 'V4: Action openGhost: target="GhostSheet" отсутствует'),
    ('V5-route-without-screen', lambda r: replace_in(
        r / 'specs/ui/navigation/navigation.uispec.xml',
        'screen="fixture.things"', 'screen="fixture.ghost"'),
     [], 1, 'V5: Route Things: screen "fixture.ghost" не найден'),
    ('V6-unknown-state', lambda r: replace_in(
        r / 'specs/ui/screens/01-things.screen.md', 'onSuccessState="content"', 'onSuccessState="loaded"'),
     [], 1, 'V6'),
    ('V6-unknown-route', lambda r: replace_in(
        r / 'specs/ui/screens/01-things.screen.md', 'onSuccessState="content"', 'onSuccessRoute="GhostRoute"'),
     [], 1, 'V6'),
    ('V7-unknown-kind', lambda r: replace_in(
        r / 'specs/ui/screens/01-things.screen.md', 'kind="local.dispatch"', 'kind="local.magic"'),
     [], 1, 'V7'),
    ('V8-unknown-helper-warn', lambda r: replace_in(
        r / 'specs/ui/screens/01-things.screen.md', '{thingLabel($state.items)}', '{ghostHelper($state.items)}'),
     [], 0, 'V8: helper ghostHelper()'),
    ('V9-unregistered-gap', lambda r: replace_in(
        r / 'specs/ui/screens/01-things.screen.md',
        '<Action id="loadThings" kind="api.query"', '<Action id="loadThings" kind="api.query" gap="GAP-999"'),
     [], 1, 'V9: маркер GAP-999 не зарегистрирован'),
    ('V10-draft-strict', lambda r: replace_in(
        r / 'specs/ui/screens/01-things.screen.md', 'status: approved', 'status: draft'),
     ['--strict'], 1, 'status=draft не проходит --strict'),
    ('V11-unresolved-type', lambda r: replace_in(
        r / 'specs/ui/screens/01-things.screen.md',
        '<Property name="items" type="Thing[]" />', '<Property name="items" type="GhostModel[]" />'),
     [], 1, 'V11'),
    ('V11-field-not-in-schema', lambda r: replace_in(
        r / 'specs/ui/screens/01-things.screen.md',
        '<Field name="name" type="string" />', '<Field name="title" type="string" />'),
     [], 1, 'V11: Model Thing: поле title отсутствует в контрактной схеме Thing'),
    ('version-required', lambda r: replace_in(
        r / 'specs/ui/screens/01-things.screen.md', '<ScreenSpec version="0.1">', '<ScreenSpec>'),
     [], 1, 'version='),
    # Положительный кейс: onErrorWhen ∈ ACTION_ATTRS, $error ∈ REF_PREFIXES (MANUAL §6.4).
    # Закрепляет расширение allowlist: снятие onErrorWhen или $error вернёт WARN и уронит кейс.
    ('onErrorWhen-allowed', lambda r: (
        replace_in(r / 'specs/ui/screens/01-things.screen.md',
                   '<State id="error"><Property name="message" type="string" /></State>',
                   '<State id="error"><Property name="message" type="string" /></State>'
                   '<State id="networkError" extends="error" />'),
        replace_in(r / 'specs/ui/screens/01-things.screen.md',
                   '<Action id="loadThings" kind="api.query" onSuccessState="content" onErrorState="error" />',
                   '<Action id="loadThings" kind="api.command" onSuccessState="content"'
                   ' onErrorWhen="$error.transport == true:networkError" onErrorState="error" />'),
        replace_in(r / 'specs/ui/screens/01-things.screen.md',
                   '<StateView state="error">',
                   '<StateView state="error"><Text value="{$error.code}" />')),
     [], 0, ('errors=0', '!неизвестный атрибут', '!unknown token/reference')),
]


def output_matches(out, want_text):
    """Подстрока или tuple подстрок; ведущий '!' — требование отсутствия в выводе."""
    for want in (want_text,) if isinstance(want_text, str) else want_text:
        if want.startswith('!'):
            if want[1:] in out:
                return False
        elif want not in out:
            return False
    return True


def main():
    failures = []
    for name, mutate, extra, want_exit, want_text in CASES:
        with tempfile.TemporaryDirectory(prefix=f'uispec-{name}-') as tmp:
            root = Path(tmp)
            write_kit(root)
            mutate(root)
            proc = subprocess.run(
                [sys.executable, str(VALIDATOR), '--config', str(root / 'uispec.config.json'), *extra],
                capture_output=True, text=True)
            out = proc.stdout + proc.stderr
            ok = proc.returncode == want_exit and output_matches(out, want_text)
            print(f'{"PASS" if ok else "FAIL"}  {name}')
            if not ok:
                failures.append(name)
                print(f'      want exit={want_exit} contains {want_text!r}')
                print(f'      got  exit={proc.returncode}')
                for line in out.splitlines():
                    print(f'      | {line}')
    print(f'{len(CASES) - len(failures)}/{len(CASES)} passed')
    raise SystemExit(1 if failures else 0)


if __name__ == '__main__':
    main()
