import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAttempt } from "./domain";
import { clearAttemptHistory, readAttempts, saveAttempt } from "./storage";

const values = new Map<string, string>();
const localStorage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key)
};

function attempt(id: string, completedAt: string, score: number) {
  return createAttempt({
    id,
    completedAt,
    score,
    answered: score
  });
}

describe("attempt history storage", () => {
  beforeEach(() => {
    values.clear();
    vi.stubGlobal("window", { localStorage });
  });

  it("keeps completed attempts newest first", () => {
    const older = attempt("e842882b-e4b0-46bc-8b1d-c7a4ccdf774e", "2026-10-18T12:00:00.000Z", 4);
    const newer = attempt("b58aa66b-8b21-4fc6-9182-f86a59129d44", "2026-10-19T12:00:00.000Z", 7);

    saveAttempt(older);
    const result = saveAttempt(newer);

    expect(result.attempts.map(({ id }) => id)).toEqual([newer.id, older.id]);
    expect(readAttempts()).toEqual([newer, older]);
  });

  it("does not duplicate an attempt when the same completion is saved again", () => {
    const completed = attempt("e842882b-e4b0-46bc-8b1d-c7a4ccdf774e", "2026-10-18T12:00:00.000Z", 4);

    saveAttempt(completed);
    const result = saveAttempt(completed);

    expect(result.attempts).toEqual([completed]);
  });

  it("clears all saved attempts", () => {
    saveAttempt(attempt("e842882b-e4b0-46bc-8b1d-c7a4ccdf774e", "2026-10-18T12:00:00.000Z", 4));

    expect(clearAttemptHistory()).toBe(true);
    expect(readAttempts()).toEqual([]);
  });

  it("ignores a malformed history value instead of exposing invalid attempts", () => {
    values.set("offline-blind-chess.attempts.v1", "{broken json");

    expect(readAttempts()).toEqual([]);
  });
});
