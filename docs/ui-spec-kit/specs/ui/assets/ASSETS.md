# Asset manifest

| UISpec ref | Файл/реализация | Правило |
|---|---|---|
| `$asset.setup-check` | будущий SVG/Lottie или RN illustration | календарь, checkmark, мягкие декоративные элементы |
| `$asset.calendar-share` | будущий SVG | календарь/конверт/share, используется в empty meetings |
| `$asset.event-types` | будущий SVG | карточки типов событий |
| visual reference | `owner-mobile-flow.png` | направление, не pixel-perfect source |
| visual reference (guest) | `guest-mobile-flow.png` | направление, не pixel-perfect source |
| visual reference (owner settings) | `owner-mobile-settings.png` | направление, не pixel-perfect source; 3 кадра корня настроек (экран 08) |
| visual reference (owner settings details) | `owner-mobile-settings-details.png` | направление, не pixel-perfect source; 8 кадров экранов 09, 10, 06, 11 |
| `$asset.network-error` | placeholder-компонент | облако с Wi-Fi и крестом (кадр 9 guest-доски, кадр 3 owner-settings-доски), TODO-ASSET — в пакете исходника нет |

В текущем пакете исходные векторные иллюстрации отсутствуют. Агент должен создать placeholder-компоненты и пометить `TODO-ASSET`, а не вырезать иллюстрации из PNG.
