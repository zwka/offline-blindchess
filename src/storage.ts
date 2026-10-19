import { AttemptSchema } from "./domain";
import type { Attempt } from "./domain";

const STORAGE_KEY = "offline-blind-chess.attempts.v1";
const AttemptsSchema = AttemptSchema.array();

function newestFirst(attempts: Attempt[]): Attempt[] {
  return [...attempts].sort((left, right) => right.completedAt.localeCompare(left.completedAt));
}

export function readAttempts(): Attempt[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      return [];
    }

    const parsed: unknown = JSON.parse(stored);
    const result = AttemptsSchema.safeParse(parsed);
    return result.success ? newestFirst(result.data) : [];
  } catch {
    return [];
  }
}

export function saveAttempt(attempt: Attempt): { attempts: Attempt[]; saved: boolean } {
  const attempts = newestFirst([attempt, ...readAttempts().filter((saved) => saved.id !== attempt.id)]);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts));
    return { attempts, saved: true };
  } catch {
    return { attempts, saved: false };
  }
}

export function clearAttemptHistory(): boolean {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
