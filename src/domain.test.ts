import { describe, expect, it } from "vitest";
import {
  advanceRound,
  answerRound,
  createAttempt,
  finishRound,
  pauseRound,
  randomSquare,
  remainingMs,
  resumeRound,
  squareColor,
  startRound
} from "./domain";
import type { Square } from "./domain";

const a1: Square = { file: "a", rank: 1 };

describe("Square Colors domain", () => {
  it("uses a1 as the dark anchor and alternates in both directions", () => {
    expect(squareColor(a1)).toBe("dark");
    expect(squareColor({ file: "b", rank: 1 })).toBe("light");
    expect(squareColor({ file: "a", rank: 2 })).toBe("light");
    expect(squareColor({ file: "h", rank: 8 })).toBe("dark");
  });

  it("maps the ends of the random range to valid board coordinates", () => {
    expect(randomSquare(() => 0)).toEqual(a1);
    expect(randomSquare(() => 0.999_999)).toEqual({ file: "h", rank: 8 });
  });

  it("awards one point for a correct answer and reports immediate feedback", () => {
    const running = startRound({ now: 0, prompt: a1 });
    const answered = answerRound({ state: running, answer: "dark", now: 100 });

    expect(answered).toMatchObject({
      kind: "running",
      correct: 1,
      answered: 1,
      feedback: { kind: "correct", expected: "dark" }
    });
  });

  it("counts a wrong answer without awarding a point", () => {
    const running = startRound({ now: 0, prompt: a1 });
    const answered = answerRound({ state: running, answer: "light", now: 100 });

    expect(answered).toMatchObject({
      kind: "running",
      correct: 0,
      answered: 1,
      feedback: { kind: "incorrect", expected: "dark", picked: "light" }
    });
  });

  it("accepts only one answer until the next prompt is ready", () => {
    const running = startRound({ now: 0, prompt: a1 });
    const answered = answerRound({ state: running, answer: "dark", now: 100 });
    const repeated = answerRound({ state: answered, answer: "light", now: 200 });

    expect(repeated).toBe(answered);
    expect(advanceRound(answered, a1)).toMatchObject({ kind: "running", prompt: a1, feedback: null });
  });

  it("freezes remaining time while paused and restores it when resumed", () => {
    const running = startRound({ now: 1_000, prompt: a1 });
    const paused = pauseRound(running, 11_000);
    const resumed = resumeRound(paused, 90_000);

    expect(remainingMs(paused, 90_000)).toBe(50_000);
    expect(resumed).toMatchObject({ kind: "running", endsAt: 140_000 });
  });

  it("records a completed zero-answer attempt with no accuracy", () => {
    const running = startRound({ now: 0, prompt: a1 });
    const completed = finishRound({
      state: running,
      now: 60_000,
      id: "4d05fbbf-31eb-4d27-ae94-2bd56ad8d955",
      completedAt: "2026-10-19T12:00:00.000Z"
    });

    expect(completed).toMatchObject({
      kind: "finished",
      attempt: { score: 0, answered: 0, accuracy: null }
    });
  });

  it("rounds accuracy from score and answered count", () => {
    expect(
      createAttempt({
        id: "4d05fbbf-31eb-4d27-ae94-2bd56ad8d955",
        completedAt: "2026-10-19T12:00:00.000Z",
        score: 2,
        answered: 3
      }).accuracy
    ).toBe(67);
  });
});
