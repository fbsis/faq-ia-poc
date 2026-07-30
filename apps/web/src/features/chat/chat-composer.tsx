import { Button, Input } from "@faq/ui";
import { Send } from "lucide-react";
import type { FormEvent } from "react";

interface ChatComposerProps {
  value: string;
  pending: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function ChatComposer({ value, pending, onChange, onSubmit }: ChatComposerProps) {
  function submit(event: FormEvent) {
    event.preventDefault();
    if (value.trim() && !pending) onSubmit();
  }

  return (
    <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
      <label className="sr-only" htmlFor="question">
        Digite sua pergunta
      </label>
      <Input
        id="question"
        maxLength={500}
        placeholder="Ex.: Como redefino minha senha?"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <Button
        className="min-w-44 gap-2"
        disabled={pending || !value.trim()}
        type="submit"
        aria-label={pending ? "Consultando" : "Enviar pergunta"}
      >
        <Send aria-hidden size={18} />
        {pending ? "Consultando…" : "Perguntar"}
      </Button>
    </form>
  );
}
