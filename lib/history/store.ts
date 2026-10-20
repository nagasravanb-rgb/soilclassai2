import { promises as fs } from "fs";
import path from "path";
import { HistoryRecordSchema, type HistoryRecord } from "../schema";

export const MAX_HISTORY_RECORDS = 200;
const LOCK_TIMEOUT_MS = 5_000;
const LOCK_STALE_MS = 15_000;

export interface HistoryStore {
  list(): Promise<HistoryRecord[]>;
  get(id: string): Promise<HistoryRecord | null>;
  add(record: HistoryRecord): Promise<HistoryRecord>;
  clear(): Promise<number>;
}

/**
 * JSON-file history store for single-user / self-hosted deployments.
 * Not suitable for serverless platforms with ephemeral filesystems (use browser storage there).
 */
export class FileHistoryStore implements HistoryStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private async read(): Promise<HistoryRecord[]> {
    let text: string;
    try {
      text = await fs.readFile(this.filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return [];
    }
    if (!Array.isArray(data)) return [];
    return data.flatMap(item => {
      const parsed = HistoryRecordSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  }

  private async write(records: HistoryRecord[]): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(records), { encoding: "utf8", mode: 0o600 });
    await fs.rename(tmp, this.filePath);
  }

  /** Inter-process lock (lock file created with O_EXCL) around read-modify-write sequences. */
  private async withLock<T>(task: () => Promise<T>): Promise<T> {
    const lockPath = `${this.filePath}.lock`;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const started = Date.now();
    for (;;) {
      try {
        await (await fs.open(lockPath, "wx")).close();
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        const stat = await fs.stat(lockPath).catch(() => null);
        if (stat && Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
          await fs.rm(lockPath, { force: true });
          continue;
        }
        if (Date.now() - started > LOCK_TIMEOUT_MS) throw new Error("History file is busy. Please try again.");
        await new Promise(resolve => setTimeout(resolve, 15 + Math.random() * 25));
      }
    }
    try {
      return await task();
    } finally {
      await fs.rm(lockPath, { force: true });
    }
  }

  private serialize<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task);
    this.queue = next.catch(() => undefined);
    return next;
  }

  list(): Promise<HistoryRecord[]> {
    return this.serialize(async () => (await this.read()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  get(id: string): Promise<HistoryRecord | null> {
    return this.serialize(async () => (await this.read()).find(r => r.id === id) ?? null);
  }

  add(record: HistoryRecord): Promise<HistoryRecord> {
    return this.serialize(() => this.withLock(async () => {
      const records = (await this.read()).filter(r => r.id !== record.id);
      records.unshift(record);
      records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      await this.write(records.slice(0, MAX_HISTORY_RECORDS));
      return record;
    }));
  }

  clear(): Promise<number> {
    return this.serialize(() => this.withLock(async () => {
      const count = (await this.read()).length;
      await this.write([]);
      return count;
    }));
  }
}

const stores = new Map<string, FileHistoryStore>();
export function getFileHistoryStore(filePath: string): FileHistoryStore {
  const resolved = path.resolve(filePath);
  let store = stores.get(resolved);
  if (!store) {
    store = new FileHistoryStore(resolved);
    stores.set(resolved, store);
  }
  return store;
}
