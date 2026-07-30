export class QuestionProcessingUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super("Question processing could not be committed.", options);
    this.name = "QuestionProcessingUnavailableError";
  }
}
