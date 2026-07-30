import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { AskQuestionResponse, ConversationMessage } from "@faq/contracts";
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
    mutationFn: ({
      question,
      history
    }: {
      question: string;
      turnId: string;
      history: ConversationMessage[];
    }) => askQuestion({ question, ...(history.length > 0 ? { history } : {}) })
  });

  function runTurn(
    question: string,
    turnId: string,
    history: ConversationMessage[],
    onSuccess?: () => void
  ) {
    mutation.mutate(
      { question, turnId, history },
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
    const history = toConversationHistory(turns);
    setTurns((current) => [
      ...current,
      { id: turnId, question: trimmedQuestion, status: "pending" }
    ]);
    runTurn(trimmedQuestion, turnId, history, onSuccess);
  }

  function retry(turnId?: string, onSuccess?: () => void) {
    const turn = turnId
      ? turns.find((candidate) => candidate.id === turnId)
      : [...turns].reverse().find((candidate) => candidate.status === "error");
    if (!turn) return;
    const turnIndex = turns.findIndex((candidate) => candidate.id === turn.id);
    const history = toConversationHistory(turns.slice(0, turnIndex));
    setTurns((current) =>
      current.map((candidate) =>
        candidate.id === turn.id ? { ...candidate, status: "pending" } : candidate
      )
    );
    runTurn(turn.question, turn.id, history, onSuccess);
  }

  return { ...mutation, submit, retry, turns };
}

function toConversationHistory(turns: ChatTurn[]): ConversationMessage[] {
  return turns
    .filter(
      (turn): turn is ChatTurn & { response: AskQuestionResponse } =>
        turn.status === "answered" && Boolean(turn.response)
    )
    .flatMap((turn) => [
      { role: "user" as const, content: turn.question },
      {
        role: "assistant" as const,
        content:
          "answer" in turn.response
            ? (turn.response.answer ?? turn.response.message)
            : turn.response.message,
        status: turn.response.status
      }
    ])
    .slice(-6);
}
