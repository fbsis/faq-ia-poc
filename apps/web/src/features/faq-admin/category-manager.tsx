import { Button, Input } from "@faq/ui";
import { useState } from "react";

export function CategoryManager({
  pending,
  onCreate
}: {
  pending: boolean;
  onCreate: (name: string) => Promise<unknown>;
}) {
  const [name, setName] = useState("");

  return (
    <form
      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim().length < 2) return;
        void onCreate(name.trim()).then(() => setName(""));
      }}
    >
      <label className="flex-1 text-sm font-medium text-slate-700">
        Nova categoria
        <Input
          className="mt-2"
          value={name}
          minLength={2}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex.: Conta e acesso"
        />
      </label>
      <Button disabled={pending || name.trim().length < 2} type="submit">
        Adicionar categoria
      </Button>
    </form>
  );
}
