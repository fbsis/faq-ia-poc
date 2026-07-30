import type { Admin, AdminSession } from "../domain/admin.js";

export interface AdminRepository {
  findAdminByEmail(email: string): Promise<Admin | null>;
  findAdminById(id: string): Promise<Admin | null>;
}

export interface SessionRepository {
  createSession(session: AdminSession): Promise<void>;
  findSessionByTokenHash(tokenHash: string, now: Date): Promise<AdminSession | null>;
  revokeSession(tokenHash: string, revokedAt: Date): Promise<void>;
}
