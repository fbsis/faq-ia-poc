import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { askQuestion } from "./chat-api.js";

export function useAskQuestion() {
  const [submittedQuestion, setSubmittedQuestion] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (question: string) => askQuestion({ question })
  });

  function submit(question: string) {
    setSubmittedQuestion(question);
    mutation.mutate(question);
  }

  function retry() {
    if (submittedQuestion) mutation.mutate(submittedQuestion);
  }

  return { ...mutation, submit, retry, submittedQuestion };
}
