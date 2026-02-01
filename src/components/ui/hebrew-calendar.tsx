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
    <div className="flex flex-col items-center justify-center gap-px">
      <span className="text-[13px] font-semibold leading-none tabular-nums">
        {props.date.getDate()}
      </span>
      <span className="text-[8px] leading-none text-muted-foreground/50 font-medium">
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
      className={cn("p-2 pointer-events-auto select-none", className)}
      locale={he}
      dir="rtl"
      classNames={{
        months: "flex flex-col sm:flex-row gap-3",
        month: "space-y-3",
        caption: "flex justify-center relative items-center h-9 mb-1",
        caption_label: "text-sm font-bold tracking-tight",
        nav: "flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 bg-transparent p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200"
        ),
        nav_button_previous: "absolute left-0",
        nav_button_next: "absolute right-0",
        table: "w-full border-collapse",
        head_row: "flex mb-1",
        head_cell: "text-muted-foreground/70 w-8 font-semibold text-[10px] uppercase tracking-wide",
        row: "flex w-full",
        cell: cn(
          "relative p-0.5 text-center focus-within:relative focus-within:z-20",
          "[&:has([aria-selected])]:bg-primary/10 [&:has([aria-selected])]:rounded-lg",
          "[&:has([aria-selected].day-outside)]:bg-primary/5"
        ),
        day: cn(
          "h-8 w-8 p-0 font-normal rounded-lg transition-all duration-150",
          "hover:bg-muted/80 hover:scale-105",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected: cn(
          "bg-primary text-primary-foreground shadow-sm",
          "hover:bg-primary/90 hover:scale-100",
          "focus:bg-primary focus:text-primary-foreground"
        ),
        day_today: cn(
          "bg-accent/60 text-accent-foreground font-bold",
          "ring-1 ring-accent ring-offset-1 ring-offset-background"
        ),
        day_outside: "text-muted-foreground/30 hover:text-muted-foreground/50",
        day_disabled: "text-muted-foreground/20 hover:bg-transparent hover:scale-100 cursor-not-allowed",
        day_range_middle: "aria-selected:bg-accent/30 aria-selected:text-accent-foreground rounded-none",
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
