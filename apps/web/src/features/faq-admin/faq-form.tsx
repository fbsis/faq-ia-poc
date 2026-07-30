import type { Category, Faq, FaqInput } from "@faq/contracts";
import { Button, Input } from "@faq/ui";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

interface FormValues {
  categoryId: string;
  question: string;
  aliases: string;
  answer: string;
}

export function FaqForm({
  categories,
  faq,
  pending,
  onCancel,
  onSubmit
}: {
  categories: Category[];
  faq?: Faq;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (input: FaqInput) => Promise<unknown>;
}) {
  const { register, handleSubmit, reset, formState } = useForm<FormValues>();
  useEffect(() => {
    reset({
      categoryId: faq?.category.id ?? categories[0]?.id ?? "",
      question: faq?.question ?? "",
      aliases: faq?.aliases.join(", ") ?? "",
      answer: faq?.answer ?? ""
    });
  }, [categories, faq, reset]);

  return (
    <form
      className="space-y-4 rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm"
      onSubmit={(event) => {
        void handleSubmit(async (values) => {
          await onSubmit({
            categoryId: values.categoryId,
            question: values.question.trim(),
            aliases: values.aliases
              .split(",")
              .map((alias) => alias.trim())
              .filter(Boolean),
            answer: values.answer.trim()
          });
        })(event);
      }}
    >
      <h2 className="text-xl font-bold text-slate-950">
        {faq ? "Editar pergunta" : "Nova pergunta"}
      </h2>
      <label className="block text-sm font-medium text-slate-700">
        Categoria
        <select
          className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-4"
          {...register("categoryId", { required: true })}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Pergunta
        <Input
          className="mt-2"
          {...register("question", { required: true, minLength: 3, maxLength: 500 })}
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Variações de busca
        <Input
          className="mt-2"
          {...register("aliases")}
          placeholder="Separe as variações por vírgulas"
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Resposta
        <textarea
          className="mt-2 min-h-36 w-full rounded-xl border border-slate-300 bg-white p-4 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          {...register("answer", { required: true, maxLength: 10_000 })}
        />
      </label>
      {Object.keys(formState.errors).length > 0 && (
        <p role="alert" className="text-sm text-red-700">
          Revise os campos obrigatórios antes de salvar.
        </p>
      )}
      <div className="flex gap-3">
        <Button disabled={pending || categories.length === 0} type="submit">
          {pending ? "Salvando…" : "Salvar pergunta"}
        </Button>
        <Button variant="ghost" type="button" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
