import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { render, screen } from '@testing-library/react-native';

import { AppIcon, type IconName } from '@/design-system/components/AppIcon';

/** Декоративная иконка скрыта от screen reader, поэтому в запросы RNTL входит только явно. */
const HIDDEN = { includeHiddenElements: true } as const;

/**
 * Символ глифа семейства — то, что реально попадает в текстовый узел иконки.
 * `glyphMap` семейства типизирован union'ом своих имён, поэтому сверка идёт по значению.
 */
function glyphChar(glyphMap: object, glyph: string): string {
  return String.fromCodePoint((glyphMap as Record<string, number>)[glyph]);
}

const ALL_NAMES: IconName[] = [
  'alert-circle',
  'alert-triangle',
  'arrow-left',
  'calendar',
  'calendar-x',
  'check-circle',
  'chevron-down',
  'chevron-right',
  'clock',
  'cloud-off',
  'event-type',
  'globe',
  'info',
  'layout-grid',
  'mail',
  'message-square',
  'plus',
  'settings',
  'user',
];

describe('AppIcon', () => {
  it('рендерит глиф Feather для имени спеки', async () => {
    await render(<AppIcon name="cloud-off" />);

    expect(screen.getByTestId('icon-cloud-off', HIDDEN)).toHaveTextContent(
      glyphChar(Feather.glyphMap, 'cloud-off'),
    );
  });

  // Три имени спеков не имеют глифа в Feather и переопределены другим семейством пакета.
  it('подменяет семейство для calendar-x, event-type и layout-grid', async () => {
    await render(<AppIcon name="calendar-x" />);
    expect(screen.getByTestId('icon-calendar-x', HIDDEN)).toHaveTextContent(
      glyphChar(MaterialCommunityIcons.glyphMap, 'calendar-remove'),
    );

    await render(<AppIcon name="event-type" />);
    expect(screen.getByTestId('icon-event-type', HIDDEN)).toHaveTextContent(
      glyphChar(MaterialCommunityIcons.glyphMap, 'forum'),
    );

    // `layout-grid` — header action экрана 05 (`owner.upcoming-meetings`, открыть типы событий).
    await render(<AppIcon name="layout-grid" />);
    expect(screen.getByTestId('icon-layout-grid', HIDDEN)).toHaveTextContent(
      glyphChar(MaterialCommunityIcons.glyphMap, 'view-grid'),
    );
  });

  // Остальные owner-имена берут глиф из Feather буквально, как guest-имена выше.
  it('рендерит Feather-глиф для owner-имён settings, plus и message-square', async () => {
    await render(<AppIcon name="settings" />);
    expect(screen.getByTestId('icon-settings', HIDDEN)).toHaveTextContent(
      glyphChar(Feather.glyphMap, 'settings'),
    );

    await render(<AppIcon name="plus" />);
    expect(screen.getByTestId('icon-plus', HIDDEN)).toHaveTextContent(glyphChar(Feather.glyphMap, 'plus'));

    await render(<AppIcon name="message-square" />);
    expect(screen.getByTestId('icon-message-square', HIDDEN)).toHaveTextContent(
      glyphChar(Feather.glyphMap, 'message-square'),
    );
  });

  it('без accessibilityLabel скрыта от screen reader', async () => {
    await render(<AppIcon name="info" />);

    const icon = screen.getByTestId('icon-info', HIDDEN);
    expect(icon.props.accessibilityElementsHidden).toBe(true);
    expect(icon.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('с accessibilityLabel доступна и озвучивается', async () => {
    await render(<AppIcon name="globe" accessibilityLabel="Часовой пояс" />);

    const icon = screen.getByLabelText('Часовой пояс');
    expect(icon.props.accessibilityElementsHidden).toBe(false);
  });

  // Плейсхолдера не осталось: каждое имя словаря даёт непустой глиф (AC9 brief).
  it('рендерит реальный глиф для всех имён гостевых спеков', async () => {
    await render(
      <>
        {ALL_NAMES.map((name) => (
          <AppIcon key={name} name={name} />
        ))}
      </>,
    );

    for (const name of ALL_NAMES) {
      const icon = screen.getByTestId(`icon-${name}`, HIDDEN);
      expect(String(icon.props.children ?? '')).not.toHaveLength(0);
    }
  });
});
