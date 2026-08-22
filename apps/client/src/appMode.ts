/**
 * Режим приложения (`front/owner/001` ADR §1): `App.tsx` монтирует гостевой или owner-корень
 * в зависимости от `EXPO_PUBLIC_APP_MODE`. Дефолт — `guest`: без переменной или с любым значением
 * кроме точного `'owner'` (включая пустую строку и опечатки) приложение остаётся гостевым.
 */
export type AppMode = 'guest' | 'owner';

export function resolveAppMode(): AppMode {
  // Expo инлайнит EXPO_PUBLIC_* только при статическом обращении через точку (см. api/config.ts):
  // деструктуризация и process.env[key] в сборке дадут undefined.
  const configured = process.env.EXPO_PUBLIC_APP_MODE;
  return configured === 'owner' ? 'owner' : 'guest';
}
