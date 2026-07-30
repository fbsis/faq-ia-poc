import { createHash, randomBytes } from "node:crypto";
import { AppError } from "../../../infrastructure/http/errors.js";
import type { Clock, IdGenerator, PasswordHasher } from "../../../shared/domain/ports.js";
import { publicAdmin, type PublicAdmin } from "../domain/admin.js";
import type { AdminRepository, SessionRepository } from "./ports.js";

interface LoginOptions {
  ttlSeconds: number;
  tokenFactory?: () => string;
}

export interface LoginResult {
  token: string;
  csrfToken: string;
  admin: PublicAdmin;
}

export class Login {
  constructor(
    private readonly admins: AdminRepository,
    private readonly sessions: SessionRepository,
    private readonly passwords: PasswordHasher,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly options: LoginOptions
  ) {}

  async execute(input: { email: string; password: string }): Promise<LoginResult> {
    const email = input.email.trim().toLowerCase();
    const admin = await this.admins.findAdminByEmail(email);
    const valid = admin ? await this.passwords.verify(input.password, admin.passwordHash) : false;
    if (!admin || !admin.active || !valid) {
      throw new AppError("INVALID_CREDENTIALS", "Invalid email or password.", 401);
    }

    const token = this.options.tokenFactory?.() ?? randomBytes(32).toString("base64url");
    const csrfToken = randomBytes(24).toString("base64url");
    const createdAt = this.clock.now();
    await this.sessions.createSession({
      id: this.ids.next(),
      adminId: admin.id,
      tokenHash: hashToken(token),
      csrfToken,
      createdAt,
      expiresAt: new Date(createdAt.getTime() + this.options.ttlSeconds * 1_000),
      revokedAt: null
    });

    return { token, csrfToken, admin: publicAdmin(admin) };
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
