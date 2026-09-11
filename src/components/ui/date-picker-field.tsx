import { CalendarIcon } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DatePickerFieldProps = {
  value?: string | null;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  required?: boolean;
  "aria-label"?: string;
};

export function DatePickerField({
  value,
  onValueChange,
  placeholder = "Selecionar data",
  className,
  disabled,
  min,
  max,
  required,
  "aria-label": ariaLabel,
}: DatePickerFieldProps) {
  const selected = value ? parseISO(value) : undefined;
  const validSelected = selected && isValid(selected) ? selected : undefined;
  const minimum = min ? parseISO(min) : undefined;
  const maximum = max ? parseISO(max) : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel || placeholder}
          aria-required={required || undefined}
          className={cn(
            "relative h-9 w-full justify-end pl-9 pr-3 text-right font-normal",
            !validSelected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="absolute left-3 size-4" />
          {validSelected ? format(validSelected, "dd/MM/yyyy", { locale: ptBR }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={validSelected}
          onSelect={(date) => onValueChange(date ? format(date, "yyyy-MM-dd") : "")}
          disabled={(date) => Boolean(
            (minimum && isValid(minimum) && date < minimum)
            || (maximum && isValid(maximum) && date > maximum)
          )}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
