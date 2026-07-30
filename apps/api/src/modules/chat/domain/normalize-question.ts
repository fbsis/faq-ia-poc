export function normalizeQuestion(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(
      /\b(?:a|o|as|os)\s+(?=(?:meu|minha|meus|minhas|seu|sua|seus|suas|nosso|nossa|nossos|nossas)\b)/gu,
      ""
    );
}
