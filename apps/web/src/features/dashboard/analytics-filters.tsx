import { Button, Input } from "@faq/ui";
import { useState, type FormEvent } from "react";
import type { AnalyticsRequest } from "@faq/contracts";

interface AnalyticsFiltersProps {
  range: AnalyticsRequest;
  onApply: (range: AnalyticsRequest) => void;
}

export function AnalyticsFilters({ range, onApply }: AnalyticsFiltersProps) {
  const [draft, setDraft] = useState(range);

  function submit(event: FormEvent) {
    event.preventDefault();
    onApply(draft);
  }

  return (
    <form
      className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      onSubmit={submit}
    >
      <label>
        <span className="mb-2 block text-sm font-medium text-slate-700">Data inicial</span>
        <Input
          type="date"
          required
          value={draft.from}
          max={draft.to}
          onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
        />
      </label>
      <label>
        <span className="mb-2 block text-sm font-medium text-slate-700">Data final</span>
        <Input
          type="date"
          required
          value={draft.to}
          min={draft.from}
          onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
        />
      </label>
      <Button type="submit">Aplicar período</Button>
    </form>
  );
}
