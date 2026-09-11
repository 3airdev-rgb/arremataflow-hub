import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import * as React from "react";

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export const parseCurrency = (value: string) => {
  return Number(value.replace(/\D/g, "")) / 100;
};

interface CurrencyInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  value: number;
  onValueChange: (value: number) => void;
  wholeReais?: boolean;
  maxValue?: number;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onValueChange, wholeReais = false, maxValue, className, onFocus, onBlur, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(formatCurrency(value));
    const isFocused = React.useRef(false);

    React.useEffect(() => {
      if (!isFocused.current) setDisplayValue(formatCurrency(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;

      if (wholeReais) {
        const cleaned = rawValue.replace(/[^\d,]/g, "");
        const [integerPart = "", ...decimalParts] = cleaned.split(",");
        const decimalPart = decimalParts.join("").slice(0, 2);
        const normalized = decimalParts.length > 0
          ? `${integerPart || "0"},${decimalPart}`
          : integerPart;
        const parsedValue = normalized
          ? Number(normalized.replace(",", "."))
          : 0;
        const limitedValue = Number.isFinite(parsedValue)
          ? Math.min(parsedValue, maxValue ?? Number.MAX_SAFE_INTEGER)
          : 0;

        setDisplayValue(limitedValue === parsedValue ? `R$ ${normalized}` : formatCurrency(limitedValue));
        onValueChange(limitedValue);
        return;
      }

      const parsedValue = parseCurrency(rawValue);
      const limitedValue = Math.min(parsedValue, maxValue ?? Number.MAX_SAFE_INTEGER);
      setDisplayValue(formatCurrency(limitedValue));
      onValueChange(limitedValue);
    };

    return (
      <Input
        {...props}
        ref={ref}
        value={displayValue}
        onChange={handleChange}
        onFocus={(event) => {
          isFocused.current = true;
          if (wholeReais) {
            const editableValue = value === 0
              ? ""
              : value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
            setDisplayValue(`R$ ${editableValue}`);
            requestAnimationFrame(() => {
              event.currentTarget.setSelectionRange(
                event.currentTarget.value.length,
                event.currentTarget.value.length,
              );
            });
          }
          onFocus?.(event);
        }}
        onBlur={(event) => {
          isFocused.current = false;
          if (wholeReais) setDisplayValue(formatCurrency(value));
          onBlur?.(event);
        }}
        className={cn("text-right", className)}
      />
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
