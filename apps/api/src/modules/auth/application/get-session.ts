import { AppError } from "../../../infrastructure/http/errors.js";
import type { Clock } from "../../../shared/domain/ports.js";
import { publicAdmin, type PublicAdmin } from "../domain/admin.js";
import type { AdminRepository, SessionRepository } from "./ports.js";
import { hashToken } from "./login.js";

export interface CurrentSession {
  admin: PublicAdmin;
  csrfToken: string;
}

export class GetSession {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly admins: AdminRepository,
    private readonly clock: Clock
  ) {}

  async execute(token: string | undefined): Promise<CurrentSession> {
    if (!token) throw unauthorized();
    const session = await this.sessions.findSessionByTokenHash(hashToken(token), this.clock.now());
    if (!session) throw unauthorized();
    const admin = await this.admins.findAdminById(session.adminId);
    if (!admin?.active) throw unauthorized();
    return { admin: publicAdmin(admin), csrfToken: session.csrfToken };
  }
}

function unauthorized(): AppError {
  return new AppError("UNAUTHORIZED", "Administrator authentication is required.", 401);
}
