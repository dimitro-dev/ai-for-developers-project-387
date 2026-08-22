#!/usr/bin/env python3
"""Извлекает единственный ```uispec```-блок из спека.

Файл ищется по переданному пути; если путь не существует и задан/найден
uispec.config.json — дополнительно в каталогах screens/ и components/ из конфига.
"""
from pathlib import Path
import argparse, json, re, sys


def extract(path: Path) -> str:
    text = path.read_text(encoding='utf-8')
    blocks = re.findall(r"```uispec\s*\n(.*?)\n```", text, flags=re.S)
    if len(blocks) != 1:
        raise ValueError(f"{path}: expected exactly one uispec block, found {len(blocks)}")
    return blocks[0].strip()


def resolve(file_arg: str, config_arg: str) -> Path:
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


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='Extract the uispec block from a spec file')
    ap.add_argument('file', help='спек-файл или имя файла внутри screens/components из конфига')
    ap.add_argument('--config', default='uispec.config.json', help='путь до uispec.config.json')
    args = ap.parse_args()
    try:
        print(extract(resolve(args.file, args.config)))
    except (FileNotFoundError, ValueError) as e:
        print(e, file=sys.stderr)
        raise SystemExit(2)
