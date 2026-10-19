import { z } from "zod";

export const ATTEMPT_DURATION_MS = 60_000;

const files = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const FileSchema = z.enum(files);
const RankSchema = z.number().int().min(1).max(8);

export const SquareSchema = z.object({
  file: FileSchema,
  rank: RankSchema
});

export type Square = z.infer<typeof SquareSchema>;
export type SquareColor = "light" | "dark";

export const AttemptSchema = z
  .object({
    id: z.string().uuid().brand<"AttemptId">(),
    completedAt: z.string().datetime(),
    score: z.number().int().nonnegative(),
    answered: z.number().int().nonnegative(),
    accuracy: z.number().min(0).max(100).nullable()
  })
  .superRefine((attempt, context) => {
    if (attempt.score > attempt.answered) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Score cannot exceed answers." });
    }

    if ((attempt.answered === 0) !== (attempt.accuracy === null)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Accuracy is empty only when no answers were given." });
    }

    if (attempt.answered > 0 && attempt.accuracy !== Math.round((attempt.score / attempt.answered) * 100)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Accuracy must match the score and answer count." });
    }
  });

export type Attempt = z.infer<typeof AttemptSchema>;

type Feedback =
  | { kind: "correct"; picked: SquareColor; expected: SquareColor }
  | { kind: "incorrect"; picked: SquareColor; expected: SquareColor };

type RoundCounts = {
  prompt: Square;
  correct: number;
  answered: number;
  feedback: Feedback | null;
};

export type RoundState =
  | { kind: "idle" }
  | (RoundCounts & { kind: "running"; endsAt: number })
  | (RoundCounts & { kind: "paused"; remainingMs: number })
  | { kind: "finished"; attempt: Attempt };

export function squareColor(square: Square): SquareColor {
  const fileNumber = files.indexOf(square.file) + 1;
  return (fileNumber + square.rank) % 2 === 0 ? "dark" : "light";
}

export function randomSquare(random = Math.random): Square {
  const index = Math.max(0, Math.min(63, Math.floor(random() * 64)));
  const file = files[index % 8];
  const rank = Math.floor(index / 8) + 1;

  if (file === undefined) {
    throw new Error("Random square index was outside the board.");
  }

  return { file, rank };
}

export function createAttempt(input: {
  id: string;
  completedAt: string;
  score: number;
  answered: number;
}): Attempt {
  return AttemptSchema.parse({
    ...input,
    accuracy: input.answered === 0 ? null : Math.round((input.score / input.answered) * 100)
  });
}

export function startRound(input: { now: number; prompt: Square }): RoundState {
  return {
    kind: "running",
    prompt: input.prompt,
    correct: 0,
    answered: 0,
    feedback: null,
    endsAt: input.now + ATTEMPT_DURATION_MS
  };
}

export function remainingMs(state: RoundState, now: number): number {
  switch (state.kind) {
    case "idle":
    case "finished":
      return 0;
    case "paused":
      return state.remainingMs;
    case "running":
      return Math.max(0, state.endsAt - now);
  }
}

export function answerRound(input: {
  state: RoundState;
  answer: SquareColor;
  now: number;
}): RoundState {
  const { state } = input;
  if (state.kind !== "running" || state.feedback !== null || input.now >= state.endsAt) {
    return state;
  }

  const expected = squareColor(state.prompt);
  const isCorrect = input.answer === expected;

  return {
    ...state,
    answered: state.answered + 1,
    correct: state.correct + Number(isCorrect),
    feedback: {
      kind: isCorrect ? "correct" : "incorrect",
      picked: input.answer,
      expected
    }
  };
}

export function advanceRound(state: RoundState, nextPrompt: Square): RoundState {
  if (state.kind !== "running" || state.feedback === null) {
    return state;
  }

  return { ...state, prompt: nextPrompt, feedback: null };
}

export function pauseRound(state: RoundState, now: number): RoundState {
  if (state.kind !== "running") {
    return state;
  }

  const left = Math.max(0, state.endsAt - now);
  if (left === 0) {
    return state;
  }

  return {
    kind: "paused",
    prompt: state.prompt,
    correct: state.correct,
    answered: state.answered,
    feedback: state.feedback,
    remainingMs: left
  };
}

export function resumeRound(state: RoundState, now: number): RoundState {
  if (state.kind !== "paused") {
    return state;
  }

  return {
    kind: "running",
    prompt: state.prompt,
    correct: state.correct,
    answered: state.answered,
    feedback: state.feedback,
    endsAt: now + state.remainingMs
  };
}

export function finishRound(input: {
  state: RoundState;
  now: number;
  id: string;
  completedAt: string;
}): RoundState {
  const { state } = input;
  if (state.kind !== "running" || input.now < state.endsAt) {
    return state;
  }

  return {
    kind: "finished",
    attempt: createAttempt({
      id: input.id,
      completedAt: input.completedAt,
      score: state.correct,
      answered: state.answered
    })
  };
}
