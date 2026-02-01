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
    <div className="flex flex-col items-center justify-center w-full h-full overflow-hidden">
      <span className="text-sm font-medium leading-none">{props.date.getDate()}</span>
      <span className="text-[9px] text-muted-foreground/60 leading-none mt-0.5 truncate max-w-full">
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
        months: "flex flex-col sm:flex-row gap-2",
        month: "space-y-2",
        caption: "flex justify-center pt-1 relative items-center h-8",
        caption_label: "text-sm font-semibold",
        nav: "flex items-center gap-1",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-60 hover:opacity-100 transition-opacity"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex",
        head_cell:
          "text-muted-foreground w-9 font-medium text-[11px] py-1.5 text-center",
        row: "flex w-full mt-0.5",
        cell: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
          "h-9 w-9",
          "[&:has([aria-selected])]:bg-accent",
          "[&:has([aria-selected].day-outside)]:bg-accent/50",
          "[&:has([aria-selected].day-range-end)]:rounded-l-md",
          "first:[&:has([aria-selected])]:rounded-r-md",
          "last:[&:has([aria-selected])]:rounded-l-md"
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-md hover:bg-muted/60 transition-colors"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md",
        day_today: "bg-accent/70 text-accent-foreground font-semibold",
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
