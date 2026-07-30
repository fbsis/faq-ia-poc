import type { DatabasePool } from "../../../../infrastructure/database/client.js";
import type { AdminRepository, SessionRepository } from "../../application/ports.js";
import type { Admin, AdminSession } from "../../domain/admin.js";

interface AdminRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  active: boolean;
}

interface SessionRow {
  id: string;
  admin_id: string;
  token_hash: string;
  csrf_token: string;
  created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
}

export class PostgresAuthRepository implements AdminRepository, SessionRepository {
  constructor(private readonly pool: DatabasePool) {}

  async findAdminByEmail(email: string): Promise<Admin | null> {
    const result = await this.pool.query<AdminRow>(
      `SELECT id, email, display_name, password_hash, active
       FROM administrators WHERE lower(email) = lower($1) LIMIT 1`,
      [email]
    );
    return result.rows[0] ? mapAdmin(result.rows[0]) : null;
  }

  async findAdminById(id: string): Promise<Admin | null> {
    const result = await this.pool.query<AdminRow>(
      `SELECT id, email, display_name, password_hash, active
       FROM administrators WHERE id = $1 LIMIT 1`,
      [id]
    );
    return result.rows[0] ? mapAdmin(result.rows[0]) : null;
  }

  async createSession(session: AdminSession): Promise<void> {
    await this.pool.query(
      `INSERT INTO admin_sessions
       (id, admin_id, token_hash, csrf_token, created_at, expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        session.id,
        session.adminId,
        session.tokenHash,
        session.csrfToken,
        session.createdAt,
        session.expiresAt,
        session.revokedAt
      ]
    );
  }

  async findSessionByTokenHash(tokenHash: string, now: Date): Promise<AdminSession | null> {
    const result = await this.pool.query<SessionRow>(
      `SELECT id, admin_id, token_hash, csrf_token, created_at, expires_at, revoked_at
       FROM admin_sessions
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > $2
       LIMIT 1`,
      [tokenHash, now]
    );
    return result.rows[0] ? mapSession(result.rows[0]) : null;
  }

  async revokeSession(tokenHash: string, revokedAt: Date): Promise<void> {
    await this.pool.query(
      "UPDATE admin_sessions SET revoked_at = $2 WHERE token_hash = $1 AND revoked_at IS NULL",
      [tokenHash, revokedAt]
    );
  }
}

function mapAdmin(row: AdminRow): Admin {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    active: row.active
  };
}

function mapSession(row: SessionRow): AdminSession {
  return {
    id: row.id,
    adminId: row.admin_id,
    tokenHash: row.token_hash,
    csrfToken: row.csrf_token,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at
  };
}
