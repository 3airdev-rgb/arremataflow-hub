import { useEffect, useRef, useState } from "react";
import { CalendarIcon } from "lucide-react";
import { format, parseISO, subYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ageFromIso,
  birthDateError,
  birthDateToIso,
  isoToBirthDate,
  maskBirthDate,
  MIN_BIRTH_YEAR,
} from "@/lib/birth-date";

type BirthDateFieldProps = {
  id?: string;
  /** Data salva no formato AAAA-MM-DD; vazio quando não informada ou incompleta. */
  value: string;
  onValueChange: (iso: string) => void;
  required?: boolean;
};

/**
 * Data de nascimento: digitação direta com máscara DD/MM/AAAA (rápida no teclado e no celular)
 * e, opcionalmente, um calendário com seleção de ano e mês para quem prefere clicar.
 */
export function BirthDateField({ id, value, onValueChange, required }: BirthDateFieldProps) {
  const [text, setText] = useState(() => isoToBirthDate(value));
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const error = birthDateError(text);

  // Mantém o texto em sincronia quando o valor muda por fora (abrir outro cadastro, por exemplo).
  useEffect(() => {
    if (value !== (birthDateToIso(text) ?? "")) setText(isoToBirthDate(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const incomplete = text.length > 0 && text.length < 10;
    inputRef.current?.setCustomValidity(
      error ?? (incomplete ? "Informe a data completa no formato DD/MM/AAAA." : ""),
    );
  }, [text, error]);

  const change = (next: string) => {
    setText(next);
    onValueChange(birthDateToIso(next) ?? "");
  };

  const iso = birthDateToIso(text);
  const age = iso ? ageFromIso(iso) : null;
  const selected = iso ? parseISO(iso) : undefined;
  const today = new Date();

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          id={id}
          value={text}
          onChange={(event) => change(maskBirthDate(event.target.value))}
          inputMode="numeric"
          autoComplete="bday"
          placeholder="DD/MM/AAAA"
          maxLength={10}
          required={required}
          aria-invalid={error ? true : undefined}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              aria-label="Escolher a data no calendário"
            >
              <CalendarIcon className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              locale={ptBR}
              captionLayout="dropdown"
              startMonth={new Date(MIN_BIRTH_YEAR, 0)}
              endMonth={today}
              defaultMonth={selected ?? subYears(today, 35)}
              selected={selected}
              disabled={{ after: today }}
              onSelect={(date) => {
                if (!date) return;
                change(format(date, "dd/MM/yyyy"));
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : age !== null ? (
        <p className="text-xs text-muted-foreground">{age} anos</p>
      ) : null}
    </div>
  );
}
