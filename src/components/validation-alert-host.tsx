import { useEffect, useRef, useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { VALIDATION_ALERT_EVENT } from "@/lib/validation-feedback";

function fieldLabel(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  return element.labels?.[0]?.textContent?.trim()
    || element.getAttribute("aria-label")
    || element.getAttribute("placeholder")
    || element.name
    || "campo obrigatório";
}

export function ValidationAlertHost() {
  const [message, setMessage] = useState("");
  const pendingFocus = useRef<HTMLElement | null>(null);
  const suppressInvalid = useRef(false);

  useEffect(() => {
    const onAlert = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setMessage(detail?.message || "Revise os campos informados.");
    };
    const onInvalid = (event: Event) => {
      const element = event.target;
      if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) return;
      event.preventDefault();
      if (suppressInvalid.current) return;
      suppressInvalid.current = true;
      window.setTimeout(() => { suppressInvalid.current = false; }, 100);
      pendingFocus.current = element;
      const label = fieldLabel(element).replace(/\s+/g, " ");
      const instruction = element.validity.valueMissing
        ? `Preencha o campo “${label}”.`
        : `Corrija o campo “${label}”: ${element.validationMessage || "valor inválido"}.`;
      setMessage(instruction);
    };
    window.addEventListener(VALIDATION_ALERT_EVENT, onAlert);
    document.addEventListener("invalid", onInvalid, true);
    return () => {
      window.removeEventListener(VALIDATION_ALERT_EVENT, onAlert);
      document.removeEventListener("invalid", onInvalid, true);
    };
  }, []);

  const close = () => {
    setMessage("");
    window.setTimeout(() => pendingFocus.current?.focus(), 0);
  };

  return (
    <AlertDialog open={Boolean(message)} onOpenChange={(open) => !open && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Verifique os dados informados</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line">{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter><AlertDialogAction onClick={close}>Corrigir dados</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
