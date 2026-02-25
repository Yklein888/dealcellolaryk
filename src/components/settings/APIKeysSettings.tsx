import { Key, Copy, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface APIKey {
  name: string;
  key: string;
  createdAt: string;
  lastUsed?: string;
}

export function APIKeysSettings() {
  const { toast } = useToast();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const handleCopyKey = (key: string, name: string) => {
    navigator.clipboard.writeText(key);
    toast({
      title: '✅ הועתק',
      description: `ה-API key של ${name} הועתק ללוח`,
    });
  };

  const generateNewKey = (name: string) => {
    const newKey = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    toast({
      title: '✅ מיוצר',
      description: `ה-API key החדש של ${name} מוכן לשימוש`,
    });
  };

  const demoKeys: APIKey[] = [
    {
      name: 'Production Key',
      key: 'sk_live_' + Math.random().toString(36).substring(2, 15),
      createdAt: '2024-01-15',
      lastUsed: 'היום',
    },
    {
      name: 'Development Key',
      key: 'sk_test_' + Math.random().toString(36).substring(2, 15),
      createdAt: '2024-02-01',
      lastUsed: 'לא בשימוש',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          API Keys
        </CardTitle>
        <CardDescription>ניהול ה-API keys שלך לתשלומים ושירותים חיצוניים</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {demoKeys.map((apiKey) => (
          <div
            key={apiKey.name}
            className="border border-border/50 rounded-lg p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">{apiKey.name}</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowKeys(prev => ({ ...prev, [apiKey.name]: !prev[apiKey.name] }))}
              >
                {showKeys[apiKey.name] ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <code className="bg-muted p-2 rounded text-xs flex-1 font-mono truncate">
                {showKeys[apiKey.name]
                  ? apiKey.key
                  : '•'.repeat(Math.min(apiKey.key.length, 20))}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleCopyKey(apiKey.key, apiKey.name)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>יוצר: {apiKey.createdAt}</p>
              <p>שימוש אחרון: {apiKey.lastUsed || 'לא בשימוש'}</p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => generateNewKey(apiKey.name)}
              className="gap-1 w-full text-xs"
            >
              <RefreshCw className="h-3 w-3" />
              יצור מחדש
            </Button>
          </div>
        ))}

        <p className="text-xs text-muted-foreground mt-4 p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded">
          ⚠️ שמור את ה-API keys שלך בבטחה. אל תשתף אותם עם אחרים או תעלה אותם ל-GitHub.
        </p>
      </CardContent>
    </Card>
  );
}
