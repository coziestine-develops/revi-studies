import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'revi-theme';
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function readInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Storage may be blocked; fall back to the system preference.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    // Pages such as the landing page can force a theme via data-force-theme.
    const forced = root.dataset.forceTheme;
    const effective = forced ? forced : theme;
    root.classList.toggle('dark', effective === 'dark');
    root.dataset.theme = effective;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors; the theme still applies for this session.
    }
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}

/**
 * Keeps the page in dark mode while it is mounted (landing and auth pages),
 * then restores the theme the user picked for the app.
 */
export function useForcedDarkTheme(): void {
  const { theme } = useTheme();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.forceTheme = 'dark';
    root.classList.add('dark');
    root.dataset.theme = 'dark';
    return () => {
      delete root.dataset.forceTheme;
      root.classList.toggle('dark', theme === 'dark');
      root.dataset.theme = theme;
    };
  }, [theme]);
}
