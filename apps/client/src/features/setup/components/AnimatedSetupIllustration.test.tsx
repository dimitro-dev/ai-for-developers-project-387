import { render, screen } from '@testing-library/react-native';

import { AnimatedSetupIllustration } from '@/features/setup/components/AnimatedSetupIllustration';

const HIDDEN = { includeHiddenElements: true } as const;

describe('AnimatedSetupIllustration', () => {
  it('декоративна — скрыта от screen reader (не блокирует его)', async () => {
    await render(<AnimatedSetupIllustration reduceMotion={false} />);

    expect(screen.queryByTestId('asset-setup-check')).toBeNull();
    expect(screen.getByTestId('asset-setup-check', HIDDEN)).toBeTruthy();
  });

  it('при reduceMotion=true рендерится статично, без падения', async () => {
    await render(<AnimatedSetupIllustration reduceMotion />);

    expect(screen.getByTestId('asset-setup-check', HIDDEN)).toBeTruthy();
  });

  it('рендерится без прогресса и без reduceMotion, не падает', async () => {
    await render(<AnimatedSetupIllustration reduceMotion={false} progress={0.5} />);

    expect(screen.getByTestId('asset-setup-check', HIDDEN)).toBeTruthy();
    expect(screen.getByTestId('icon-check-circle', HIDDEN)).toBeTruthy();
  });
});
