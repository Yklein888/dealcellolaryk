import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { format, differenceInDays } from 'date-fns';
import { he } from 'date-fns/locale';
import { CalendarCheck, Calendar as CalendarIcon, ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const [activeTab, setActiveTab] = useState<'start' | 'end'>('start');
  const isMobile = useIsMobile();

  // Reset temp dates when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTempStartDate(startDate);
      setTempEndDate(endDate);
      setActiveTab('start');
    }
  }, [isOpen, startDate, endDate]);

  const handleConfirm = () => {
    onSelect(tempStartDate, tempEndDate);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    onOpenChange(false);
  };

  const handleStartDateSelect = (date: Date | undefined) => {
    setTempStartDate(date);
    // If end date is before new start date, reset it
    if (date && tempEndDate && tempEndDate < date) {
      setTempEndDate(undefined);
    }
    // On mobile, auto-switch to end date selection
    if (isMobile && date) {
      setTimeout(() => setActiveTab('end'), 300);
    }
  };

  const handleEndDateSelect = (date: Date | undefined) => {
    setTempEndDate(date);
  };

  const rentalDays = tempStartDate && tempEndDate 
    ? differenceInDays(tempEndDate, tempStartDate) + 1 
    : 0;

  // Custom calendar class names for spacious layout
  const calendarClassNames = {
    months: "flex flex-col",
    month: "space-y-6",
    caption: "flex justify-center pt-2 relative items-center h-12",
    caption_label: "text-lg font-semibold tracking-tight",
    nav: "space-x-1 flex items-center",
    nav_button: cn(
      "h-9 w-9 bg-transparent p-0 opacity-60 hover:opacity-100 hover:bg-muted rounded-full transition-all"
    ),
    nav_button_previous: "absolute left-2",
    nav_button_next: "absolute right-2",
    table: "w-full border-collapse",
    head_row: "flex justify-around mb-3",
    head_cell: "text-muted-foreground w-12 font-medium text-sm",
    row: "flex w-full justify-around mt-1",
    cell: cn(
      "relative p-0.5 text-center focus-within:relative focus-within:z-20",
      "[&:has([aria-selected])]:bg-primary/10 [&:has([aria-selected])]:rounded-lg"
    ),
    day: cn(
      "h-11 w-11 p-0 font-normal rounded-lg transition-all text-base",
      "hover:bg-muted hover:scale-105",
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      "aria-selected:opacity-100"
    ),
    day_range_end: "day-range-end",
    day_selected: cn(
      "bg-primary text-primary-foreground shadow-md",
      "hover:bg-primary/90 hover:scale-100"
    ),
    day_today: "bg-accent text-accent-foreground font-bold ring-1 ring-accent",
    day_outside: "text-muted-foreground/40 hover:text-muted-foreground/60",
    day_disabled: "text-muted-foreground/30 hover:bg-transparent cursor-not-allowed",
    day_range_middle: "aria-selected:bg-accent/40 aria-selected:text-accent-foreground",
    day_hidden: "invisible",
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "p-0 gap-0 overflow-hidden",
        isMobile ? "max-w-[95vw] w-full" : "max-w-[800px] w-[90vw]"
      )}>
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/30">
          <DialogTitle className="flex items-center gap-3 text-xl font-semibold">
            <div className="p-2 rounded-full bg-primary/10">
              <CalendarIcon className="h-5 w-5 text-primary" />
            </div>
            בחירת תאריכי השכרה
          </DialogTitle>
        </DialogHeader>

        {/* Mobile Tab Switcher */}
        {isMobile && (
          <div className="flex border-b bg-background">
            <button
              onClick={() => setActiveTab('start')}
              className={cn(
                "flex-1 py-4 px-4 text-center transition-all relative",
                activeTab === 'start' 
                  ? "text-primary font-semibold" 
                  : "text-muted-foreground"
              )}
            >
              <div className="text-sm mb-1">תאריך התחלה</div>
              <div className={cn(
                "text-base font-medium",
                tempStartDate ? "text-foreground" : "text-muted-foreground"
              )}>
                {tempStartDate 
                  ? format(tempStartDate, "dd/MM/yyyy", { locale: he })
                  : "בחר תאריך"
                }
              </div>
              {activeTab === 'start' && (
                <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />
              )}
            </button>
            
            <div className="flex items-center px-2">
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </div>
            
            <button
              onClick={() => setActiveTab('end')}
              className={cn(
                "flex-1 py-4 px-4 text-center transition-all relative",
                activeTab === 'end' 
                  ? "text-primary font-semibold" 
                  : "text-muted-foreground"
              )}
            >
              <div className="text-sm mb-1">תאריך סיום</div>
              <div className={cn(
                "text-base font-medium",
                tempEndDate ? "text-foreground" : "text-muted-foreground"
              )}>
                {tempEndDate 
                  ? format(tempEndDate, "dd/MM/yyyy", { locale: he })
                  : "בחר תאריך"
                }
              </div>
              {activeTab === 'end' && (
                <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          </div>
        )}

        {/* Calendars Container */}
        <div className={cn(
          "p-6 bg-background",
          isMobile ? "pb-4" : "pb-6"
        )}>
          {isMobile ? (
            // Mobile: Single calendar with tabs
            <div className="flex justify-center">
              {activeTab === 'start' ? (
                <Calendar
                  mode="single"
                  selected={tempStartDate}
                  onSelect={handleStartDateSelect}
                  locale={he}
                  dir="rtl"
                  classNames={calendarClassNames}
                  className="pointer-events-auto"
                />
              ) : (
                <Calendar
                  mode="single"
                  selected={tempEndDate}
                  onSelect={handleEndDateSelect}
                  disabled={(date) => !!(tempStartDate && date < tempStartDate)}
                  locale={he}
                  dir="rtl"
                  classNames={calendarClassNames}
                  className="pointer-events-auto"
                />
              )}
            </div>
          ) : (
            // Desktop: Two calendars side by side
            <div className="grid grid-cols-2 gap-8">
              {/* Start Date Calendar */}
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    תאריך התחלה
                  </h3>
                  <p className={cn(
                    "text-sm transition-all",
                    tempStartDate 
                      ? "text-primary font-medium" 
                      : "text-muted-foreground"
                  )}>
                    {tempStartDate 
                      ? format(tempStartDate, "EEEE, d בMMMM yyyy", { locale: he })
                      : "לחץ לבחירת תאריך"
                    }
                  </p>
                </div>
                <div className="border rounded-xl p-4 bg-card shadow-sm">
                  <Calendar
                    mode="single"
                    selected={tempStartDate}
                    onSelect={handleStartDateSelect}
                    locale={he}
                    dir="rtl"
                    classNames={calendarClassNames}
                    className="pointer-events-auto"
                  />
                </div>
              </div>

              {/* Visual Separator */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden">
                <div className="w-px h-48 bg-border" />
              </div>

              {/* End Date Calendar */}
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    תאריך סיום
                  </h3>
                  <p className={cn(
                    "text-sm transition-all",
                    tempEndDate 
                      ? "text-primary font-medium" 
                      : "text-muted-foreground"
                  )}>
                    {tempEndDate 
                      ? format(tempEndDate, "EEEE, d בMMMM yyyy", { locale: he })
                      : "לחץ לבחירת תאריך"
                    }
                  </p>
                </div>
                <div className="border rounded-xl p-4 bg-card shadow-sm">
                  <Calendar
                    mode="single"
                    selected={tempEndDate}
                    onSelect={handleEndDateSelect}
                    disabled={(date) => !!(tempStartDate && date < tempStartDate)}
                    locale={he}
                    dir="rtl"
                    classNames={calendarClassNames}
                    className="pointer-events-auto"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/30">
          {/* Duration Summary */}
          {rentalDays > 0 && (
            <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg text-center">
              <span className="text-2xl font-bold text-primary">{rentalDays}</span>
              <span className="text-muted-foreground mr-2">ימי השכרה</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button 
              variant="ghost" 
              onClick={handleCancel}
              className="px-6"
            >
              ביטול
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={!tempStartDate || !tempEndDate}
              className="gap-2 px-6 shadow-sm"
            >
              <CalendarCheck className="h-4 w-4" />
              אישור
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
