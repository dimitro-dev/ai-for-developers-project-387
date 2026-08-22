import { Image, type ImageProps, type ImageSourcePropType } from 'react-native';

export interface AppImageProps {
  source: ImageSourcePropType;
  width: number;
  height: number;
  resizeMode?: ImageProps['resizeMode'];
  /** Без label изображение считается декоративным и скрывается от screen reader. */
  accessibilityLabel?: string;
  testID?: string;
}

/** UISpec-тег `Image`. */
export function AppImage({
  source,
  width,
  height,
  resizeMode = 'contain',
  accessibilityLabel,
  testID,
}: AppImageProps) {
  const decorative = accessibilityLabel === undefined;
  return (
    <Image
      testID={testID}
      source={source}
      resizeMode={resizeMode}
      accessible={!decorative}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      style={{ width, height }}
    />
  );
}

export default AppImage;
