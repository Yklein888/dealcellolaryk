import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DateRangePicker } from '@/components/DateRangePicker';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { he } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getFullHebrewDate } from '@/components/ui/hebrew-calendar';

interface RentalDatePickerProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onSelectDates: (start: Date | undefined, end: Date | undefined) => void;
}

export function RentalDatePicker({ startDate, endDate, onSelectDates }: RentalDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rentalDays = startDate && endDate ? differenceInDays(endDate, startDate) + 1 : 0;

  return (
    <div className="space-y-3 p-4 sm:p-5 rounded-xl sm:rounded-2xl border bg-card shadow-sm">
      <Label className="flex items-center gap-2 text-sm sm:text-base font-semibold">
        <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
        תאריכי השכרה
      </Label>

      <Button
        type="button"
        variant="outline"
        className={cn("w-full justify-start text-right h-12 text-base", !startDate && "text-muted-foreground")}
        onClick={() => setIsOpen(true)}
      >
        <CalendarIcon className="ml-2 h-5 w-5" />
        {startDate ? (
          endDate ? (
            <>
              {format(startDate, "dd/MM/yyyy", { locale: he })} - {format(endDate, "dd/MM/yyyy", { locale: he })}
              <span className="mr-auto text-primary font-medium">({rentalDays} ימים)</span>
            </>
          ) : format(startDate, "dd/MM/yyyy", { locale: he })
        ) : (
          <span>בחר טווח תאריכים</span>
        )}
      </Button>

      {startDate && endDate && (
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 space-y-1">
          <p className="text-xs text-muted-foreground text-center">
            {getFullHebrewDate(startDate)} - {getFullHebrewDate(endDate)}
          </p>
          <p className="text-sm text-center">
            <span className="text-muted-foreground">משך השכרה: </span>
            <span className="font-bold text-primary text-lg">{rentalDays}</span>
            <span className="text-muted-foreground"> ימים</span>
          </p>
        </div>
      )}

      <DateRangePicker
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        startDate={startDate}
        endDate={endDate}
        onSelect={(start, end) => onSelectDates(start, end)}
      />
    </div>
  );
}
