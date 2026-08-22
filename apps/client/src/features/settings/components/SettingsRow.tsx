import { Pressable } from 'react-native';

import { AppIcon, type IconName } from '@/design-system/components/AppIcon';
import { AppText } from '@/design-system/components/AppText';
import { Center } from '@/design-system/layout/Center';
import { Column } from '@/design-system/layout/Column';
import { Row } from '@/design-system/layout/Row';
import { useColors } from '@/design-system/theme';
import { radii, sizes, spacing, typography } from '@/design-system/tokens';

export interface SettingsRowProps {
  title: string;
  subtitle?: string;
  /** Имя глифа ведущей иконки; без пропа строка сохраняет раскладку и высоту без плитки. */
  icon?: IconName;
  onPress: () => void;
  testID?: string;
}

/**
 * UISpec-тег `SettingsRow`: строка корневого экрана настроек — ведущая иконка (необязательна),
 * название, подпись и chevron. Строка целиком нажимаема.
 */
export function SettingsRow({ title, subtitle, icon, onPress, testID }: SettingsRowProps) {
  const colors = useColors();
  const rowTestID = testID ?? 'settings-row';

  return (
    <Pressable
      testID={rowTestID}
      onPress={onPress}
      accessibilityRole="button"
      // Вся строка — один интерактивный элемент; ведущая иконка декоративна (Rules спеки), поэтому
      // отдельного accessibilityLabel у неё нет и в комбинированную фразу она не входит.
      accessible
      accessibilityLabel={[title, subtitle].filter(Boolean).join('. ')}
      style={{
        minHeight: sizes.row.settings.height,
        justifyContent: 'center',
        paddingHorizontal: spacing[16],
      }}
    >
      <Row align="center" gap={spacing[12]}>
        {icon === undefined ? null : (
          <Center
            testID={`${rowTestID}-icon`}
            width={sizes.touch.android}
            height={sizes.touch.android}
            radius={radii[12]}
            background={colors.surface.selected}
          >
            <AppIcon name={icon} size={sizes.icon.medium} color={colors.action.primary} />
          </Center>
        )}
        <Column flex={1} gap={spacing[4]}>
          <AppText typography={typography.title.small}>{title}</AppText>
          {subtitle === undefined ? null : (
            <AppText typography={typography.body.small} color={colors.text.secondary}>
              {subtitle}
            </AppText>
          )}
        </Column>
        <AppIcon name="chevron-right" size={sizes.icon.small} color={colors.icon.secondary} />
      </Row>
    </Pressable>
  );
}

export default SettingsRow;
