import * as fs from "node:fs";
import * as path from "node:path";
import type { JournalBatch, JournalMove } from "./types";

/**
 * Moves a file or folder. Same drive: an atomic rename. Different drive (the backup
 * folder may live anywhere): copy first, check the copy exists, and only then remove
 * the original, so a failed copy never loses data.
 */
export function movePath(from: string, to: string): void {
  try {
    fs.renameSync(from, to);
    return;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EXDEV") throw err;
  }

  fs.cpSync(from, to, { recursive: true, errorOnExist: true, force: false });
  const src = fs.statSync(from);
  const dst = fs.statSync(to);
  if (src.isFile() && src.size !== dst.size) {
    fs.rmSync(to, { recursive: true, force: true });
    throw new Error(`Copy verification failed for ${from}`);
  }
  fs.rmSync(from, { recursive: true });
}

/** Moves an item into its destination, creating folders as needed. Never overwrites. */
export function applyMove(move: JournalMove): void {
  if (fs.existsSync(move.to)) throw new Error(`Target already exists: ${move.to}`);
  fs.mkdirSync(path.dirname(move.to), { recursive: true });
  movePath(move.from, move.to);
}

/** Append-only log of every sweep so each one can be undone. */
export class Journal {
  constructor(private readonly file: string) {}

  private read(): JournalBatch[] {
    try {
      return JSON.parse(fs.readFileSync(this.file, "utf8")) as JournalBatch[];
    } catch {
      return [];
    }
  }

  private write(batches: JournalBatch[]): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(batches, null, 2), "utf8");
  }

  /**
   * Logs one finished move immediately, so a crash or forced quit in the middle of a sweep
   * still leaves everything undoable. Keeps only the newest 50 sweeps.
   */
  record(batchId: string, move: JournalMove): void {
    const batches = this.read();
    let batch = batches.find((b) => b.id === batchId);
    if (!batch) {
      batch = { id: batchId, time: new Date().toISOString(), moves: [] };
      batches.push(batch);
    }
    batch.moves.push(move);
    this.write(batches.slice(-50));
  }

  commit(moves: JournalMove[]): JournalBatch | undefined {
    if (moves.length === 0) return undefined;
    const batch: JournalBatch = { id: String(Date.now()), time: new Date().toISOString(), moves };
    this.write([...this.read(), batch]);
    return batch;
  }

  /** Restores the newest batch. Items that vanished or whose origin is occupied are reported, not forced. */
  undoLast(): { restored: number; skipped: string[] } | undefined {
    const batches = this.read();
    const last = batches.pop();
    if (!last) return undefined;

    let restored = 0;
    const skipped: string[] = [];
    for (const move of [...last.moves].reverse()) {
      if (!fs.existsSync(move.to) || fs.existsSync(move.from)) {
        skipped.push(move.from);
        continue;
      }
      try {
        movePath(move.to, move.from);
        restored++;
      } catch {
        skipped.push(move.from);
      }
    }
    this.write(batches);
    return { restored, skipped };
  }
}
