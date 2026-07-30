import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { AskQuestionResponse } from "@faq/contracts";
import { askQuestion } from "./chat-api.js";

export interface ChatTurn {
  id: string;
  question: string;
  status: "pending" | "answered" | "error";
  response?: AskQuestionResponse;
}

export function useAskQuestion() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const mutation = useMutation({
    mutationFn: ({ question }: { question: string; turnId: string }) => askQuestion({ question })
  });

  function runTurn(question: string, turnId: string, onSuccess?: () => void) {
    mutation.mutate(
      { question, turnId },
      {
        onSuccess(response) {
          setTurns((current) =>
            current.map((turn) =>
              turn.id === turnId ? { ...turn, status: "answered", response } : turn
            )
          );
          onSuccess?.();
        },
        onError() {
          setTurns((current) =>
            current.map((turn) => (turn.id === turnId ? { ...turn, status: "error" } : turn))
          );
        }
      }
    );
  }

  function submit(question: string, onSuccess?: () => void) {
    const trimmedQuestion = question.trim();
    const turnId = crypto.randomUUID();
    setTurns((current) => [
      ...current,
      { id: turnId, question: trimmedQuestion, status: "pending" }
    ]);
    runTurn(trimmedQuestion, turnId, onSuccess);
  }

  function retry(turnId?: string) {
    const turn = turnId
      ? turns.find((candidate) => candidate.id === turnId)
      : [...turns].reverse().find((candidate) => candidate.status === "error");
    if (!turn) return;
    setTurns((current) =>
      current.map((candidate) =>
        candidate.id === turn.id ? { ...candidate, status: "pending" } : candidate
      )
    );
    runTurn(turn.question, turn.id);
  }

  return { ...mutation, submit, retry, turns };
}
