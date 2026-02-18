import fs from "fs/promises";
import path from "path";
import { StoreData } from "./types";

function getDefaultDataPath(): string {
  return path.resolve(__dirname, "..", "data", "data.json");
}

async function ensureFileExists(filePath: string) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const initial: StoreData = {
    counters: { bookId: 1, holdId: 1 },
    books: [],
    holds: [],
  };

  try {
    const fileHandle = await fs.open(filePath, "wx");
    try {
      await fileHandle.writeFile(JSON.stringify(initial, null, 2), "utf-8");
    } finally {
      await fileHandle.close();
    }
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
  }
}

/**
 * Simple in-process mutex: serializes all read-modify-write operations to
 * maintain integrity under concurrent requests. (Req #13, #15)
 */
export class JsonStore {
  private dataPath: string;
  private lock: Promise<void> = Promise.resolve();
  private initPromise?: Promise<void>;

  constructor(dataPath?: string) {
    this.dataPath = dataPath ?? process.env.DATA_PATH ?? getDefaultDataPath();
  }

  getPath() {
    return this.dataPath;
  }

  async init(): Promise<void> {
    this.initPromise ??= ensureFileExists(this.dataPath);
    await this.initPromise;
  }

  private async readUnsafe(): Promise<StoreData> {
    const raw = await fs.readFile(this.dataPath, "utf-8");
    return JSON.parse(raw) as StoreData;
  }

  private async writeUnsafe(data: StoreData): Promise<void> {
    await fs.writeFile(this.dataPath, JSON.stringify(data, null, 2), "utf-8");
  }

  private async executeExclusive<T>(fn: () => Promise<T> | T): Promise<T> {
    let result!: T;
    let error: unknown;

    this.lock = this.lock.then(async () => {
      try {
        result = await fn();
      } catch (e) {
        error = e;
      }
    });

    await this.lock;
    if (error) throw error;
    return result;
  }

  async read(): Promise<StoreData> {
    await this.init();
    return this.executeExclusive(() => this.readUnsafe());
  }

  /**
   * Runs fn inside a single-file serialized critical section.
   */
  async transact<T>(fn: (data: StoreData) => Promise<T> | T): Promise<T> {
    await this.init();
    return this.executeExclusive(async () => {
      const data = await this.readUnsafe();
      const result = await fn(data);
      await this.writeUnsafe(data);
      return result;
    });
  }
}
