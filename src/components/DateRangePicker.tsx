import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { HebrewCalendar, getFullHebrewDate } from '@/components/ui/hebrew-calendar';
import { format, differenceInDays } from 'date-fns';
import { he } from 'date-fns/locale';
import { CalendarCheck, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DateRangePickerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  startDate: Date | undefined;
  endDate: Date | undefined;
  onSelect: (start: Date | undefined, end: Date | undefined) => void;
}

export function DateRangePicker({
  isOpen,
  onOpenChange,
  startDate,
  endDate,
  onSelect,
}: DateRangePickerProps) {
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>(startDate);
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>(endDate);

  const handleConfirm = () => {
    onSelect(tempStartDate, tempEndDate);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    onOpenChange(false);
  };

  const rentalDays = tempStartDate && tempEndDate 
    ? differenceInDays(tempEndDate, tempStartDate) + 1 
    : 0;

  // Reset temp dates when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setTempStartDate(startDate);
      setTempEndDate(endDate);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CalendarIcon className="h-5 w-5 text-primary" />
            בחר תאריכי השכרה
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* Start Date Calendar */}
          <div className="space-y-3">
            <Label className="text-center block font-semibold text-lg">
              תאריך התחלה
            </Label>
            <div className="border rounded-xl p-2 bg-muted/30 flex justify-center">
              <HebrewCalendar
                mode="single"
                selected={tempStartDate}
                onSelect={(date) => {
                  setTempStartDate(date);
                  // If end date is before new start date, reset it
                  if (date && tempEndDate && tempEndDate < date) {
                    setTempEndDate(undefined);
                  }
                }}
              />
            </div>
            {tempStartDate && (
              <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="font-medium text-foreground">
                  {format(tempStartDate, "EEEE, dd בMMMM yyyy", { locale: he })}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {getFullHebrewDate(tempStartDate)}
                </p>
              </div>
            )}
          </div>

          {/* End Date Calendar */}
          <div className="space-y-3">
            <Label className="text-center block font-semibold text-lg">
              תאריך סיום
            </Label>
            <div className="border rounded-xl p-2 bg-muted/30 flex justify-center">
              <HebrewCalendar
                mode="single"
                selected={tempEndDate}
                onSelect={setTempEndDate}
                disabled={(date) => !!(tempStartDate && date < tempStartDate)}
              />
            </div>
            {tempEndDate && (
              <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="font-medium text-foreground">
                  {format(tempEndDate, "EEEE, dd בMMMM yyyy", { locale: he })}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {getFullHebrewDate(tempEndDate)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Duration Summary */}
        {rentalDays > 0 && (
          <div className="p-4 bg-gradient-to-r from-primary/20 to-primary/5 rounded-xl text-center border border-primary/20">
            <span className="text-3xl font-bold text-primary">{rentalDays}</span>
            <span className="text-muted-foreground mr-2 text-lg">ימי השכרה</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={handleCancel}>
            ביטול
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!tempStartDate || !tempEndDate}
            className="gap-2"
          >
            <CalendarCheck className="h-4 w-4" />
            אישור
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
