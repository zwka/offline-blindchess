import { describe, expect, it } from "vitest";
import {
  advancePairRound,
  advanceSquarePromptRound,
  answerCoordinatesRound,
  answerQuadrantRound,
  answerPairRound,
  answerKnightRound,
  answerRound,
  attemptsForTraining,
  createAttempt,
  finishRound,
  personalBestScore,
  pauseRound,
  prepareRound,
  randomKnightPrompt,
  quadrantForSquare,
  randomDiagonalPrompt,
  randomSameColorPrompt,
  randomSquare,
  remainingMs,
  resumeRound,
  sameColor,
  sameDiagonal,
  isKnightMove,
  sameSquare,
  squareColor,
  startRoundClock,
} from "./domain";
import type { DiagonalPrompt, KnightPrompt, KnightMoveAnswer, QuadrantNumber, SameColorPrompt, Square } from "./domain";

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

  it("maps squares to quadrants using the agreed row-first numbering", () => {
    const examples: [Square, QuadrantNumber][] = [
      [{ file: "a", rank: 8 }, 1],
      [{ file: "d", rank: 5 }, 1],
      [{ file: "e", rank: 8 }, 2],
      [{ file: "h", rank: 5 }, 2],
      [{ file: "a", rank: 4 }, 3],
      [{ file: "d", rank: 1 }, 3],
      [{ file: "e", rank: 4 }, 4],
      [{ file: "h", rank: 1 }, 4]
    ];

    for (const [square, expected] of examples) {
      expect(quadrantForSquare(square)).toBe(expected);
    }
  });

  it("scores quadrant answers and reveals the expected quadrant when wrong", () => {
    const prompt: Square = { file: "e", rank: 5 };
    const ready = prepareRound({ training: "quadrant", prompt });
    const running = startRoundClock(ready, 1_000);
    const answered = answerQuadrantRound({ state: running, answer: 1, now: 1_000 });

    expect(answered).toMatchObject({
      kind: "running",
      training: "quadrant",
      endsAt: 61_000,
      correct: 0,
      answered: 1,
      feedback: { kind: "incorrect", picked: 1, expected: 2 }
    });

    expect(answerQuadrantRound({ state: answered, answer: 2, now: 1_100 })).toBe(answered);
  });

  it("advances to the next square after a Quadrant answer", () => {
    const firstPrompt: Square = { file: "a", rank: 4 };
    const nextPrompt: Square = { file: "e", rank: 4 };
    const ready = prepareRound({ training: "quadrant", prompt: firstPrompt });
    const running = startRoundClock(ready, 100);
    const answered = answerQuadrantRound({ state: running, answer: 3, now: 100 });
    const advanced = advanceSquarePromptRound(answered, nextPrompt);

    expect(answered).toMatchObject({ correct: 1, answered: 1, feedback: { expected: 3 } });
    expect(advanced).toMatchObject({ kind: "running", prompt: nextPrompt, feedback: null });
  });

  it("compares square colors by parity", () => {
    expect(sameColor(a1, { file: "c", rank: 3 })).toBe(true);
    expect(sameColor(a1, { file: "b", rank: 1 })).toBe(false);
  });

  it("recognizes diagonal pairs in either direction and at any distance", () => {
    expect(sameDiagonal(a1, { file: "h", rank: 8 })).toBe(true);
    expect(sameDiagonal({ file: "h", rank: 8 }, a1)).toBe(true);
    expect(sameDiagonal({ file: "c", rank: 3 }, { file: "f", rank: 6 })).toBe(true);
    expect(sameDiagonal(a1, { file: "c", rank: 2 })).toBe(false);
    expect(sameColor(a1, { file: "c", rank: 5 })).toBe(true);
    expect(sameDiagonal(a1, { file: "c", rank: 5 })).toBe(false);
  });

  it("generates distinct diagonal and non-diagonal prompts with balanced answers", () => {
    const values = [0, 0, 0.75, 0, 0.25, 0, 0.5, 0];
    const prompts = Array.from({ length: 4 }, () => randomDiagonalPrompt(() => values.shift() ?? 0));

    expect(prompts.map(([first, second]) => sameDiagonal(first, second))).toEqual([true, false, true, false]);
    expect(prompts.every(([first, second]) => !sameSquare(first, second))).toBe(true);
  });

  it("recognizes a knight move in either direction", () => {
    expect(isKnightMove(a1, { file: "b", rank: 3 })).toBe(true);
    expect(isKnightMove({ file: "b", rank: 3 }, a1)).toBe(true);
    expect(isKnightMove(a1, { file: "c", rank: 2 })).toBe(true);
    expect(isKnightMove({ file: "h", rank: 8 }, { file: "g", rank: 6 })).toBe(true);
    expect(isKnightMove(a1, { file: "b", rank: 2 })).toBe(false);
    expect(isKnightMove(a1, { file: "a", rank: 1 })).toBe(false);
  });

  it("generates distinct Knight prompts with balanced valid and invalid answers", () => {
    const values = [0, 0, 0.75, 0, 0.25, 0, 0.75, 0];
    const prompts = Array.from({ length: 4 }, () => randomKnightPrompt(() => values.shift() ?? 0));

    expect(prompts.map(([first, second]) => isKnightMove(first, second))).toEqual([true, false, true, false]);
    expect(prompts.every(([first, second]) => !sameSquare(first, second))).toBe(true);
  });

  it("scores Knight answers, reveals the correct relation, and records its attempt", () => {
    const prompt: KnightPrompt = [a1, { file: "b", rank: 3 }];
    const ready = prepareRound({ training: "knight", prompt });
    const started = startRoundClock(ready, 1_000);
    const wrongAnswer: KnightMoveAnswer = "invalid";
    const answered = answerKnightRound({ state: started, answer: wrongAnswer, now: 1_000 });

    expect(answered).toMatchObject({
      kind: "running",
      training: "knight",
      endsAt: 61_000,
      correct: 0,
      answered: 1,
      feedback: { kind: "incorrect", picked: "invalid", expected: "valid" }
    });

    expect(finishRound({
      state: answered,
      now: 61_000,
      id: "d254236a-36eb-4284-8b50-4cd0b77bd9b3",
      completedAt: "2026-10-23T12:00:00.000Z"
    })).toMatchObject({
      kind: "finished",
      attempt: { training: "knight", score: 0, answered: 1, accuracy: 0 }
    });
  });

  it("scores a valid Knight move and advances to another pair", () => {
    const firstPrompt: KnightPrompt = [a1, { file: "b", rank: 3 }];
    const nextPrompt: KnightPrompt = [a1, { file: "c", rank: 3 }];
    const ready = prepareRound({ training: "knight", prompt: firstPrompt });
    const running = startRoundClock(ready, 100);
    const answered = answerKnightRound({ state: running, answer: "valid", now: 100 });
    const advanced = advancePairRound(answered, nextPrompt);

    expect(answered).toMatchObject({
      correct: 1,
      answered: 1,
      feedback: { kind: "correct", picked: "valid", expected: "valid" }
    });
    expect(advanced).toMatchObject({ kind: "running", prompt: nextPrompt, feedback: null });
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
    expect(advanceSquarePromptRound(answered, a1)).toMatchObject({ kind: "running", prompt: a1, feedback: null });
  });

  it("scores same-color comparisons and advances to a new pair", () => {
    const ready = prepareRound({ training: "same-color", prompt: [a1, { file: "c", rank: 3 }] });
    const running = startRoundClock(ready, 100);
    const answered = answerPairRound({ state: running, answer: "same", now: 100 });
    const advanced = advancePairRound(answered, [a1, { file: "b", rank: 1 }]);

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
    const answered = answerPairRound({ state: running, answer: "same", now: 100 });

    expect(answered).toMatchObject({
      correct: 0,
      answered: 1,
      feedback: { kind: "incorrect", picked: "same", expected: "different" }
    });
  });

  it("scores a Diagonals answer and records a module-specific attempt", () => {
    const prompt: DiagonalPrompt = [a1, { file: "h", rank: 8 }];
    const ready = prepareRound({ training: "diagonals", prompt });

    expect(remainingMs(ready, 90_000)).toBe(60_000);

    const started = startRoundClock(ready, 0);
    const answered = answerPairRound({ state: started, answer: "same", now: 0 });

    expect(answered).toMatchObject({
      kind: "running",
      training: "diagonals",
      endsAt: 60_000,
      correct: 1,
      answered: 1,
      feedback: { kind: "correct", expected: "same" }
    });
    expect(answerPairRound({ state: answered, answer: "different", now: 100 })).toBe(answered);

    expect(finishRound({
      state: answered,
      now: 60_000,
      id: "80db80fb-e633-41ed-82f2-2f1c586a50f3",
      completedAt: "2026-10-20T12:00:00.000Z"
    })).toMatchObject({
      kind: "finished",
      attempt: { training: "diagonals", score: 1, answered: 1, accuracy: 100 }
    });
  });

  it("reveals the Diagonals answer after a wrong response and advances", () => {
    const firstPrompt: DiagonalPrompt = [a1, { file: "b", rank: 1 }];
    const nextPrompt: DiagonalPrompt = [a1, { file: "c", rank: 3 }];
    const ready = prepareRound({ training: "diagonals", prompt: firstPrompt });
    const started = startRoundClock(ready, 100);
    const answered = answerPairRound({ state: started, answer: "same", now: 100 });
    const advanced = advancePairRound(answered, nextPrompt);

    expect(answered).toMatchObject({
      correct: 0,
      answered: 1,
      feedback: { kind: "incorrect", picked: "same", expected: "different" }
    });
    expect(advanced).toMatchObject({ kind: "running", prompt: nextPrompt, feedback: null });
  });

  it("pauses and resumes Diagonals without changing its prompt or feedback", () => {
    const prompt: DiagonalPrompt = [a1, { file: "h", rank: 8 }];
    const ready = prepareRound({ training: "diagonals", prompt });
    const started = startRoundClock(ready, 1_000);
    const answered = answerPairRound({ state: started, answer: "same", now: 1_000 });
    const paused = pauseRound(answered, 11_000);
    const resumed = resumeRound(paused, 90_000);

    expect(paused).toMatchObject({
      kind: "paused",
      training: "diagonals",
      prompt,
      remainingMs: 50_000,
      feedback: { kind: "correct", expected: "same" }
    });
    expect(resumed).toMatchObject({ kind: "running", prompt, endsAt: 140_000 });
  });

  it("pauses and resumes a Same Color round without changing its prompt", () => {
    const prompt: SameColorPrompt = [a1, { file: "c", rank: 3 }];
    const ready = prepareRound({ training: "same-color", prompt });
    const started = startRoundClock(ready, 1_000);
    const running = answerPairRound({ state: started, answer: "same", now: 1_000 });
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
    const running = answerPairRound({ state: started, answer: "different", now: 0 });
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
    const advanced = advanceSquarePromptRound(answered, { file: "g", rank: 2 });

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
      }),
      createAttempt({
        id: "fa46c387-9a54-4319-a227-2975ed078e2d",
        completedAt: "2026-10-21T12:00:00.000Z",
        training: "diagonals",
        score: 7,
        answered: 9
      }),
      createAttempt({
        id: "63f22914-ff42-4f80-86f5-92f68b3f5400",
        completedAt: "2026-10-22T12:00:00.000Z",
        training: "quadrant",
        score: 11,
        answered: 12
      }),
      createAttempt({
        id: "6d057d74-ae2d-4b49-9e45-c8ae0a99b6f1",
        completedAt: "2026-10-23T12:00:00.000Z",
        training: "knight",
        score: 13,
        answered: 14
      })
    ];

    expect(personalBestScore(attempts, "square-colors")).toBe(12);
    expect(personalBestScore(attempts, "same-color")).toBe(9);
    expect(personalBestScore(attempts, "coordinates")).toBe(18);
    expect(personalBestScore(attempts, "diagonals")).toBe(7);
    expect(personalBestScore(attempts, "quadrant")).toBe(11);
    expect(personalBestScore(attempts, "knight")).toBe(13);
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
      }),
      createAttempt({
        id: "fa46c387-9a54-4319-a227-2975ed078e2d",
        completedAt: "2026-10-21T12:00:00.000Z",
        training: "diagonals",
        score: 7,
        answered: 9
      }),
      createAttempt({
        id: "63f22914-ff42-4f80-86f5-92f68b3f5400",
        completedAt: "2026-10-22T12:00:00.000Z",
        training: "quadrant",
        score: 11,
        answered: 12
      }),
      createAttempt({
        id: "6d057d74-ae2d-4b49-9e45-c8ae0a99b6f1",
        completedAt: "2026-10-23T12:00:00.000Z",
        training: "knight",
        score: 13,
        answered: 14
      })
    ];

    expect(attemptsForTraining(attempts, "coordinates").map(({ training, score }) => [training, score]))
      .toEqual([["coordinates", 18]]);
    expect(attemptsForTraining(attempts, "diagonals").map(({ training, score }) => [training, score]))
      .toEqual([["diagonals", 7]]);
    expect(attemptsForTraining(attempts, "quadrant").map(({ training, score }) => [training, score]))
      .toEqual([["quadrant", 11]]);
    expect(attemptsForTraining(attempts, "knight").map(({ training, score }) => [training, score]))
      .toEqual([["knight", 13]]);
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
