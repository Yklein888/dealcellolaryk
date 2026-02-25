import { Building2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface BusinessInfo {
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  businessAddress: string;
  businessNotes: string;
}

export function BusinessSettings() {
  const { toast } = useToast();
  const [info, setInfo] = useState<BusinessInfo>({
    businessName: '',
    businessPhone: '',
    businessEmail: '',
    businessAddress: '',
    businessNotes: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('businessInfo');
    if (saved) {
      try {
        setInfo(JSON.parse(saved));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem('businessInfo', JSON.stringify(info));
      toast({
        title: '✅ נשמר',
        description: 'פרטי העסק עודכנו בהצלחה',
      });
    } catch {
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לשמור את הנתונים',
        variant: 'destructive',
      });
    }
    setIsSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          פרטי העסק
        </CardTitle>
        <CardDescription>הגדר מידע בסיסי על העסק שלך</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>שם העסק</Label>
          <Input
            placeholder="לדוגמה: דיל סלולארי"
            value={info.businessName}
            onChange={(e) => setInfo({ ...info, businessName: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>טלפון</Label>
          <Input
            placeholder="+972-50-..."
            value={info.businessPhone}
            onChange={(e) => setInfo({ ...info, businessPhone: e.target.value })}
            dir="ltr"
          />
        </div>

        <div className="space-y-2">
          <Label>אימייל</Label>
          <Input
            type="email"
            placeholder="example@business.com"
            value={info.businessEmail}
            onChange={(e) => setInfo({ ...info, businessEmail: e.target.value })}
            dir="ltr"
          />
        </div>

        <div className="space-y-2">
          <Label>כתובת</Label>
          <Input
            placeholder="כתובת העסק"
            value={info.businessAddress}
            onChange={(e) => setInfo({ ...info, businessAddress: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>הערות</Label>
          <Textarea
            placeholder="הערות נוספות על העסק..."
            value={info.businessNotes}
            onChange={(e) => setInfo({ ...info, businessNotes: e.target.value })}
            rows={3}
          />
        </div>

        <Button onClick={handleSave} disabled={isSaving} className="gap-2 w-full">
          <Save className="h-4 w-4" />
          {isSaving ? 'שומר...' : 'שמור שינויים'}
        </Button>
      </CardContent>
    </Card>
  );
}
