import { describe, expect, it } from "vitest";
import {
  advanceCoordinatesRound,
  advanceSameColorRound,
  advanceRound,
  answerCoordinatesRound,
  answerSameColorRound,
  answerRound,
  attemptsForTraining,
  createAttempt,
  finishRound,
  personalBestScore,
  pauseRound,
  prepareRound,
  randomSameColorPrompt,
  randomSquare,
  remainingMs,
  resumeRound,
  sameColor,
  sameSquare,
  squareColor,
  startRoundClock,
} from "./domain";
import type { SameColorPrompt, Square } from "./domain";

const a1: Square = { file: "a", rank: 1 };

describe("training domain", () => {
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

  it("compares square colors by parity", () => {
    expect(sameColor(a1, { file: "c", rank: 3 })).toBe(true);
    expect(sameColor(a1, { file: "b", rank: 1 })).toBe(false);
  });

  it("generates two distinct squares for each comparison", () => {
    const [first, second] = randomSameColorPrompt(() => 0);

    expect(first).toEqual(a1);
    expect(second).toEqual({ file: "b", rank: 1 });
    expect(second).not.toEqual(first);
    expect(randomSameColorPrompt(() => 0.999_999)).toEqual([
      { file: "h", rank: 8 },
      { file: "g", rank: 8 }
    ]);
  });

  it("keeps the full clock until the first answer starts and counts the round", () => {
    const ready = prepareRound({ training: "square-colors", prompt: a1 });

    expect(remainingMs(ready, 55_000)).toBe(60_000);

    const running = startRoundClock(ready, 55_000);
    const answered = answerRound({ state: running, answer: "dark", now: 55_000 });

    expect(answered).toMatchObject({
      kind: "running",
      endsAt: 115_000,
      correct: 1,
      answered: 1,
      feedback: { kind: "correct", expected: "dark" }
    });
  });

  it("counts a wrong answer without awarding a point", () => {
    const ready = prepareRound({ training: "square-colors", prompt: a1 });
    const running = startRoundClock(ready, 100);
    const answered = answerRound({ state: running, answer: "light", now: 100 });

    expect(answered).toMatchObject({
      kind: "running",
      correct: 0,
      answered: 1,
      feedback: { kind: "incorrect", expected: "dark", picked: "light" }
    });
  });

  it("accepts only one answer until the next prompt is ready", () => {
    const ready = prepareRound({ training: "square-colors", prompt: a1 });
    const running = startRoundClock(ready, 100);
    const answered = answerRound({ state: running, answer: "dark", now: 100 });
    const repeated = answerRound({ state: answered, answer: "light", now: 200 });

    expect(repeated).toBe(answered);
    expect(advanceRound(answered, a1)).toMatchObject({ kind: "running", prompt: a1, feedback: null });
  });

  it("scores same-color comparisons and advances to a new pair", () => {
    const ready = prepareRound({ training: "same-color", prompt: [a1, { file: "c", rank: 3 }] });
    const running = startRoundClock(ready, 100);
    const answered = answerSameColorRound({ state: running, answer: "same", now: 100 });
    const advanced = advanceSameColorRound(answered, [a1, { file: "b", rank: 1 }]);

    expect(answered).toMatchObject({
      kind: "running",
      training: "same-color",
      correct: 1,
      answered: 1,
      feedback: { kind: "correct", expected: "same" }
    });
    expect(advanced).toMatchObject({
      kind: "running",
      prompt: [a1, { file: "b", rank: 1 }],
      feedback: null
    });
  });

  it("reveals the expected relation after an incorrect comparison", () => {
    const ready = prepareRound({ training: "same-color", prompt: [a1, { file: "b", rank: 1 }] });
    const running = startRoundClock(ready, 100);
    const answered = answerSameColorRound({ state: running, answer: "same", now: 100 });

    expect(answered).toMatchObject({
      correct: 0,
      answered: 1,
      feedback: { kind: "incorrect", picked: "same", expected: "different" }
    });
  });

  it("pauses and resumes a Same Color round without changing its prompt", () => {
    const prompt: SameColorPrompt = [a1, { file: "c", rank: 3 }];
    const ready = prepareRound({ training: "same-color", prompt });
    const started = startRoundClock(ready, 1_000);
    const running = answerSameColorRound({ state: started, answer: "same", now: 1_000 });
    const paused = pauseRound(running, 11_000);
    const resumed = resumeRound(paused, 90_000);

    expect(paused).toMatchObject({ kind: "paused", training: "same-color", prompt, remainingMs: 50_000 });
    expect(resumed).toMatchObject({ kind: "running", training: "same-color", prompt, endsAt: 140_000 });
  });

  it("freezes remaining time while paused and restores it when resumed", () => {
    const ready = prepareRound({ training: "square-colors", prompt: a1 });
    const started = startRoundClock(ready, 1_000);
    const running = answerRound({ state: started, answer: "dark", now: 1_000 });
    const paused = pauseRound(running, 11_000);
    const resumed = resumeRound(paused, 90_000);

    expect(remainingMs(paused, 90_000)).toBe(50_000);
    expect(resumed).toMatchObject({ kind: "running", endsAt: 140_000 });
  });

  it("does not finish a round before a first answer starts the clock", () => {
    const ready = prepareRound({ training: "square-colors", prompt: a1 });
    const completed = finishRound({
      state: ready,
      now: 600_000,
      id: "4d05fbbf-31eb-4d27-ae94-2bd56ad8d955",
      completedAt: "2026-10-19T12:00:00.000Z"
    });

    expect(completed).toBe(ready);
  });

  it("tags a completed Same Color round with its training module", () => {
    const ready = prepareRound({ training: "same-color", prompt: [a1, { file: "c", rank: 3 }] });
    const started = startRoundClock(ready, 0);
    const running = answerSameColorRound({ state: started, answer: "different", now: 0 });
    const completed = finishRound({
      state: running,
      now: 60_000,
      id: "b58aa66b-8b21-4fc6-9182-f86a59129d44",
      completedAt: "2026-10-19T12:00:00.000Z"
    });

    expect(completed).toMatchObject({
      kind: "finished",
      attempt: { training: "same-color", score: 0, answered: 1, accuracy: 0 }
    });
  });

  it("starts a Coordinates round on the first selected square", () => {
    const target: Square = { file: "f", rank: 6 };
    const ready = prepareRound({ training: "coordinates", prompt: target });

    expect(remainingMs(ready, 90_000)).toBe(60_000);
    expect(sameSquare(target, { file: "f", rank: 6 })).toBe(true);
    expect(sameSquare(target, a1)).toBe(false);

    const running = startRoundClock(ready, 90_000);
    const answered = answerCoordinatesRound({ state: running, answer: target, now: 90_000 });

    expect(answered).toMatchObject({
      kind: "running",
      training: "coordinates",
      endsAt: 150_000,
      correct: 1,
      answered: 1,
      feedback: { kind: "correct", expected: target, picked: target }
    });

    expect(finishRound({
      state: answered,
      now: 150_000,
      id: "b58aa66b-8b21-4fc6-9182-f86a59129d44",
      completedAt: "2026-10-19T12:00:00.000Z"
    })).toMatchObject({
      kind: "finished",
      attempt: { training: "coordinates", score: 1, answered: 1, accuracy: 100 }
    });
  });

  it("reveals the target after a wrong Coordinates selection and advances", () => {
    const target: Square = { file: "f", rank: 6 };
    const ready = prepareRound({ training: "coordinates", prompt: target });
    const running = startRoundClock(ready, 100);
    const answered = answerCoordinatesRound({ state: running, answer: a1, now: 100 });
    const advanced = advanceCoordinatesRound(answered, { file: "g", rank: 2 });

    expect(answered).toMatchObject({
      correct: 0,
      answered: 1,
      feedback: { kind: "incorrect", picked: a1, expected: target }
    });
    expect(advanced).toMatchObject({
      kind: "running",
      prompt: { file: "g", rank: 2 },
      feedback: null
    });
  });

  it("calculates personal best separately for each training module", () => {
    const attempts = [
      createAttempt({
        id: "4d05fbbf-31eb-4d27-ae94-2bd56ad8d955",
        completedAt: "2026-10-18T12:00:00.000Z",
        training: "square-colors",
        score: 12,
        answered: 15
      }),
      createAttempt({
        id: "b58aa66b-8b21-4fc6-9182-f86a59129d44",
        completedAt: "2026-10-19T12:00:00.000Z",
        training: "same-color",
        score: 9,
        answered: 10
      }),
      createAttempt({
        id: "80db80fb-e633-41ed-82f2-2f1c586a50f3",
        completedAt: "2026-10-20T12:00:00.000Z",
        training: "coordinates",
        score: 18,
        answered: 20
      })
    ];

    expect(personalBestScore(attempts, "square-colors")).toBe(12);
    expect(personalBestScore(attempts, "same-color")).toBe(9);
    expect(personalBestScore(attempts, "coordinates")).toBe(18);
    expect(personalBestScore([], "same-color")).toBeNull();
  });

  it("returns attempt history only for the selected training module", () => {
    const attempts = [
      createAttempt({
        id: "4d05fbbf-31eb-4d27-ae94-2bd56ad8d955",
        completedAt: "2026-10-18T12:00:00.000Z",
        training: "square-colors",
        score: 12,
        answered: 15
      }),
      createAttempt({
        id: "b58aa66b-8b21-4fc6-9182-f86a59129d44",
        completedAt: "2026-10-19T12:00:00.000Z",
        training: "same-color",
        score: 9,
        answered: 10
      }),
      createAttempt({
        id: "80db80fb-e633-41ed-82f2-2f1c586a50f3",
        completedAt: "2026-10-20T12:00:00.000Z",
        training: "coordinates",
        score: 18,
        answered: 20
      })
    ];

    expect(attemptsForTraining(attempts, "coordinates").map(({ training, score }) => [training, score]))
      .toEqual([["coordinates", 18]]);
    expect(attemptsForTraining(attempts, "square-colors").map(({ training, score }) => [training, score]))
      .toEqual([["square-colors", 12]]);
    expect(attemptsForTraining(attempts, "same-color").map(({ training, score }) => [training, score]))
      .toEqual([["same-color", 9]]);
  });

  it("rounds accuracy from score and answered count", () => {
    expect(
      createAttempt({
        id: "4d05fbbf-31eb-4d27-ae94-2bd56ad8d955",
        completedAt: "2026-10-19T12:00:00.000Z",
        training: "square-colors",
        score: 2,
        answered: 3
      }).accuracy
    ).toBe(67);
  });
});
