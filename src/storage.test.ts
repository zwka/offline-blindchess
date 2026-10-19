import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAttempt } from "./domain";
import type { TrainingModule } from "./domain";
import { clearAttemptHistory, readAttempts, saveAttempt } from "./storage";

const values = new Map<string, string>();
const localStorage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key)
};

function attempt(
  id: string,
  completedAt: string,
  score: number,
  training: TrainingModule = "square-colors"
) {
  return createAttempt({
    id,
    completedAt,
    training,
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

  it("keeps attempts from all training modules in the same history", () => {
    const squareColors = attempt("e842882b-e4b0-46bc-8b1d-c7a4ccdf774e", "2026-10-18T12:00:00.000Z", 4);
    const sameColor = attempt(
      "b58aa66b-8b21-4fc6-9182-f86a59129d44",
      "2026-10-19T12:00:00.000Z",
      7,
      "same-color"
    );
    const coordinates = attempt(
      "80db80fb-e633-41ed-82f2-2f1c586a50f3",
      "2026-10-20T12:00:00.000Z",
      9,
      "coordinates"
    );
    const diagonals = attempt(
      "fa46c387-9a54-4319-a227-2975ed078e2d",
      "2026-10-21T12:00:00.000Z",
      11,
      "diagonals"
    );

    saveAttempt(squareColors);
    saveAttempt(sameColor);
    saveAttempt(coordinates);
    const result = saveAttempt(diagonals);

    expect(result.attempts.map(({ training }) => training)).toEqual([
      "diagonals",
      "coordinates",
      "same-color",
      "square-colors"
    ]);
    expect(readAttempts()).toEqual([diagonals, coordinates, sameColor, squareColors]);
  });

  it("reads saved attempts without a module as Square Colors", () => {
    values.set("offline-blind-chess.attempts.v1", JSON.stringify([{
      id: "e842882b-e4b0-46bc-8b1d-c7a4ccdf774e",
      completedAt: "2026-10-18T12:00:00.000Z",
      score: 3,
      answered: 4,
      accuracy: 75
    }]));

    expect(readAttempts()).toMatchObject([{ training: "square-colors", score: 3, accuracy: 75 }]);
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
