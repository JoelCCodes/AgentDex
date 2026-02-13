import { writeFileSync, renameSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';

/**
 * Write a file atomically by writing to a temp file then renaming.
 * Atomic on POSIX (rename is atomic within the same filesystem).
 */
export function writeFileAtomic(
  filePath: string,
  data: string,
  options?: { mode?: number },
): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const tmpPath = join(dir, `.tmp-${process.pid}-${Date.now()}`);
  try {
    writeFileSync(tmpPath, data, { mode: options?.mode });
    renameSync(tmpPath, filePath);
  } catch (err) {
    // Clean up temp file on failure
    try {
      const { unlinkSync } = require('fs');
      unlinkSync(tmpPath);
    } catch {
      // Best effort cleanup
    }
    throw err;
  }
}
