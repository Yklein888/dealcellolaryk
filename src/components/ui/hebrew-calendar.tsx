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
    <div className="flex flex-col items-center gap-0">
      <span className="text-sm font-medium leading-tight">{props.date.getDate()}</span>
      <span className="text-[9px] text-muted-foreground leading-none opacity-75">
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
      className={cn("p-3 pointer-events-auto", className)}
      locale={he}
      dir="rtl"
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-11 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-12 w-11 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-l-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-r-md last:[&:has([aria-selected])]:rounded-l-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-12 w-11 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
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
