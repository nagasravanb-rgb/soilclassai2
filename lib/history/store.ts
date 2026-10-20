import { promises as fs } from "fs";
import path from "path";
import { HistoryRecordSchema, type HistoryRecord } from "../schema";

export const MAX_HISTORY_RECORDS = 200;

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
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(records), { encoding: "utf8", mode: 0o600 });
    await fs.rename(tmp, this.filePath);
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
    return this.serialize(async () => {
      const records = (await this.read()).filter(r => r.id !== record.id);
      records.unshift(record);
      records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      await this.write(records.slice(0, MAX_HISTORY_RECORDS));
      return record;
    });
  }

  clear(): Promise<number> {
    return this.serialize(async () => {
      const count = (await this.read()).length;
      await this.write([]);
      return count;
    });
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
