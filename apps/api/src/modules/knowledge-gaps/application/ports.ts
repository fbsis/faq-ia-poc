import type { Interaction } from "../../chat/domain/interaction.js";

export interface UnansweredInteractionRecorder {
  record(interaction: Interaction): Promise<void>;
}
