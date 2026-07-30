export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}

export interface PasswordHasher {
  hash(value: string): Promise<string>;
  verify(value: string, hash: string): Promise<boolean>;
}

export interface Transaction {
  execute<T>(work: () => Promise<T>): Promise<T>;
}

export const systemClock: Clock = { now: () => new Date() };
export const randomIds: IdGenerator = { next: () => crypto.randomUUID() };
