export interface Admin {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly passwordHash: string;
  readonly active: boolean;
}

export interface AdminSession {
  readonly id: string;
  readonly adminId: string;
  readonly tokenHash: string;
  readonly csrfToken: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  revokedAt: Date | null;
}

export interface PublicAdmin {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
}

export function publicAdmin(admin: Admin): PublicAdmin {
  return { id: admin.id, email: admin.email, displayName: admin.displayName };
}
