# UISpec tools

- `extract_uispec.py` — извлекает XML-блок из Markdown.
- `validate_uispec.py` — проверяет XML, action/state refs, registry и базовую accessibility.
- `generate_scaffold.py` — создаёт TypeScript types, TSX placeholder и TypeSpec model fragments.

Скрипты намеренно не генерируют production-ready data layer или сложную layout-разметку: это делает AI-агент по `MANUAL.md` и component registry.
