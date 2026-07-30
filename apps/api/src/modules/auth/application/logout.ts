import { AppError } from "../../../infrastructure/http/errors.js";
import type { Clock } from "../../../shared/domain/ports.js";
import type { SessionRepository } from "./ports.js";
import { hashToken } from "./login.js";

export class Logout {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly clock: Clock
  ) {}

  async execute(token: string | undefined): Promise<void> {
    if (!token) {
      throw new AppError("UNAUTHORIZED", "Administrator authentication is required.", 401);
    }
    await this.sessions.revokeSession(hashToken(token), this.clock.now());
  }
}
