import { Moon, Sun, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';

export function ThemeSettings() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme | null;
    if (saved) {
      setTheme(saved);
      applyTheme(saved);
    } else {
      // Detect system preference
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(isDark ? 'dark' : 'light');
    }
  }, []);

  const applyTheme = (newTheme: Theme) => {
    const html = document.documentElement;
    if (newTheme === 'dark' || (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sun className="h-5 w-5" />
          עיצוב
        </CardTitle>
        <CardDescription>בחר בין אור וחושך</CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button
          variant={theme === 'light' ? 'default' : 'outline'}
          onClick={() => handleThemeChange('light')}
          className="gap-2"
        >
          {theme === 'light' && <Check className="h-4 w-4" />}
          <Sun className="h-4 w-4" />
          בהיר
        </Button>
        <Button
          variant={theme === 'dark' ? 'default' : 'outline'}
          onClick={() => handleThemeChange('dark')}
          className="gap-2"
        >
          {theme === 'dark' && <Check className="h-4 w-4" />}
          <Moon className="h-4 w-4" />
          אפל
        </Button>
      </CardContent>
    </Card>
  );
}
