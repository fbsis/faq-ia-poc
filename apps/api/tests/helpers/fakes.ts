import type { Clock, IdGenerator, PasswordHasher } from "../../src/shared/domain/ports.js";
import type {
  AdminRepository,
  SessionRepository
} from "../../src/modules/auth/application/ports.js";
import type { Admin, AdminSession } from "../../src/modules/auth/domain/admin.js";

export class FixedClock implements Clock {
  constructor(private readonly value = new Date("2026-07-30T12:00:00.000Z")) {}

  now(): Date {
    return new Date(this.value);
  }
}

export class SequentialIds implements IdGenerator {
  private current = 0;

  next(): string {
    this.current += 1;
    return `00000000-0000-4000-8000-${String(this.current).padStart(12, "0")}`;
  }
}

export class PlainPasswordHasher implements PasswordHasher {
  async hash(value: string): Promise<string> {
    return `hashed:${value}`;
  }

  async verify(value: string, hash: string): Promise<boolean> {
    return hash === `hashed:${value}`;
  }
}

export class InMemoryAuthRepository implements AdminRepository, SessionRepository {
  admins: Admin[] = [];
  sessions: AdminSession[] = [];

  async findAdminByEmail(email: string): Promise<Admin | null> {
    return this.admins.find((admin) => admin.email === email) ?? null;
  }

  async findAdminById(id: string): Promise<Admin | null> {
    return this.admins.find((admin) => admin.id === id) ?? null;
  }

  async createSession(session: AdminSession): Promise<void> {
    this.sessions.push(session);
  }

  async findSessionByTokenHash(tokenHash: string, now: Date): Promise<AdminSession | null> {
    return (
      this.sessions.find(
        (session) =>
          session.tokenHash === tokenHash &&
          session.revokedAt === null &&
          session.expiresAt.getTime() > now.getTime()
      ) ?? null
    );
  }

  async revokeSession(tokenHash: string, revokedAt: Date): Promise<void> {
    const session = this.sessions.find((candidate) => candidate.tokenHash === tokenHash);
    if (session) session.revokedAt = revokedAt;
  }
}
