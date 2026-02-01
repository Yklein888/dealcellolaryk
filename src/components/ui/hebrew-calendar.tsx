import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, DayContentProps } from "react-day-picker";
import { toJewishDate, formatJewishDateInHebrew } from "jewish-date";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { he } from "date-fns/locale";

// Component to display day content with Hebrew date
function HebrewDayContent(props: DayContentProps) {
  const jewishDate = toJewishDate(props.date);
  const hebrewFull = formatJewishDateInHebrew(jewishDate);
  // Get just the day part (first word)
  const hebrewDay = hebrewFull.split(' ')[0];

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <span className="text-base font-semibold leading-none">{props.date.getDate()}</span>
      <span className="text-[10px] text-muted-foreground/70 leading-none mt-0.5">
        {hebrewDay}
      </span>
    </div>
  );
}

export type HebrewCalendarProps = React.ComponentProps<typeof DayPicker>;

function HebrewCalendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: HebrewCalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-4 pointer-events-auto", className)}
      locale={he}
      dir="rtl"
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "space-y-3",
        caption: "flex justify-center pt-1 relative items-center h-9",
        caption_label: "text-base font-semibold",
        nav: "flex items-center gap-1",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 bg-transparent p-0 opacity-60 hover:opacity-100 transition-opacity"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex gap-1",
        head_cell:
          "text-muted-foreground rounded-md w-10 font-medium text-xs py-2",
        row: "flex w-full gap-1 mt-1",
        cell: "h-11 w-10 text-center text-sm p-0 relative rounded-md [&:has([aria-selected].day-range-end)]:rounded-l-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-r-md last:[&:has([aria-selected])]:rounded-l-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-11 w-10 p-0 font-normal aria-selected:opacity-100 rounded-md hover:bg-muted/80 transition-colors"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md",
        day_today: "bg-accent/80 text-accent-foreground font-semibold",
        day_outside:
          "day-outside text-muted-foreground/40 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground/40",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
        IconRight: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
        DayContent: HebrewDayContent,
      }}
      {...props}
    />
  );
}
HebrewCalendar.displayName = "HebrewCalendar";

// Helper function to get full Hebrew date string
export function getFullHebrewDate(date: Date): string {
  const jewishDate = toJewishDate(date);
  return formatJewishDateInHebrew(jewishDate);
}

export { HebrewCalendar };
