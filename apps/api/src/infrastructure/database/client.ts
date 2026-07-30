import pg from "pg";

const { Pool } = pg;
export type DatabasePool = pg.Pool;

export function createDatabasePool(connectionString: string): DatabasePool {
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000
  });
}
