import { Globe, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useState, useEffect } from 'react';

export function LanguageSettings() {
  const [language, setLanguage] = useState<'he' | 'en'>('he');

  useEffect(() => {
    const saved = localStorage.getItem('language') as 'he' | 'en' | null;
    if (saved) setLanguage(saved);
  }, []);

  const handleLanguageChange = (lang: 'he' | 'en') => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
    // Reload page to apply language change
    setTimeout(() => window.location.reload(), 300);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          שפה
        </CardTitle>
        <CardDescription>בחר את שפת הממשק</CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button
          variant={language === 'he' ? 'default' : 'outline'}
          onClick={() => handleLanguageChange('he')}
          className="gap-2"
        >
          {language === 'he' && <Check className="h-4 w-4" />}
          עברית
        </Button>
        <Button
          variant={language === 'en' ? 'default' : 'outline'}
          onClick={() => handleLanguageChange('en')}
          className="gap-2"
        >
          {language === 'en' && <Check className="h-4 w-4" />}
          English
        </Button>
      </CardContent>
    </Card>
  );
}
