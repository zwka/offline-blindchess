import { z } from "zod";

export const ATTEMPT_DURATION_MS = 60_000;
export const TrainingModuleSchema = z.enum(["square-colors", "same-color", "coordinates", "diagonals", "quadrant"]);

export type TrainingModule = z.infer<typeof TrainingModuleSchema>;

const files = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const FileSchema = z.enum(files);
const RankSchema = z.number().int().min(1).max(8);

export const QUADRANT_DEFINITIONS = [
  { number: 1, fileRange: ["a", "d"], rankRange: [5, 8], label: "a-d / 5-8" },
  { number: 2, fileRange: ["e", "h"], rankRange: [5, 8], label: "e-h / 5-8" },
  { number: 3, fileRange: ["a", "d"], rankRange: [1, 4], label: "a-d / 1-4" },
  { number: 4, fileRange: ["e", "h"], rankRange: [1, 4], label: "e-h / 1-4" }
] as const;

export type QuadrantNumber = typeof QUADRANT_DEFINITIONS[number]["number"];

export const SquareSchema = z.object({
  file: FileSchema,
  rank: RankSchema
});

export type Square = z.infer<typeof SquareSchema>;
export type SquareColor = "light" | "dark";
export type PairRelation = "same" | "different";
export type SquarePair = readonly [Square, Square];
export type SameColorPrompt = SquarePair;
export type DiagonalPrompt = SquarePair;
export type CoordinatesFeedback = {
  kind: "correct" | "incorrect";
  picked: Square;
  expected: Square;
};

export const AttemptSchema = z
  .object({
    id: z.string().uuid().brand<"AttemptId">(),
    completedAt: z.string().datetime(),
    training: TrainingModuleSchema.default("square-colors"),
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

export function attemptsForTraining(attempts: readonly Attempt[], training: TrainingModule): Attempt[] {
  return attempts.filter((attempt) => attempt.training === training);
}

export function personalBestScore(attempts: readonly Attempt[], training: TrainingModule): number | null {
  return attemptsForTraining(attempts, training)
    .reduce<number | null>((highest, attempt) =>
      highest === null ? attempt.score : Math.max(highest, attempt.score), null);
}

type Feedback<Answer> = {
  kind: "correct" | "incorrect";
  picked: Answer;
  expected: Answer;
};

function recordAnswer<Answer>(input: {
  answered: number;
  correct: number;
  picked: Answer;
  expected: Answer;
  isCorrect: boolean;
}): { answered: number; correct: number; feedback: Feedback<Answer> } {
  return {
    answered: input.answered + 1,
    correct: input.correct + Number(input.isCorrect),
    feedback: {
      kind: input.isCorrect ? "correct" : "incorrect",
      picked: input.picked,
      expected: input.expected
    }
  };
}

type SquareColorsSnapshot = {
  training: "square-colors";
  prompt: Square;
  correct: number;
  answered: number;
  feedback: Feedback<SquareColor> | null;
};

type SameColorSnapshot = {
  training: "same-color";
  prompt: SameColorPrompt;
  correct: number;
  answered: number;
  feedback: Feedback<PairRelation> | null;
};

type DiagonalsSnapshot = {
  training: "diagonals";
  prompt: DiagonalPrompt;
  correct: number;
  answered: number;
  feedback: Feedback<PairRelation> | null;
};

type QuadrantSnapshot = {
  training: "quadrant";
  prompt: Square;
  correct: number;
  answered: number;
  feedback: Feedback<QuadrantNumber> | null;
};

type CoordinatesSnapshot = {
  training: "coordinates";
  prompt: Square;
  correct: number;
  answered: number;
  feedback: CoordinatesFeedback | null;
};

type RoundSnapshot = SquareColorsSnapshot | SameColorSnapshot | CoordinatesSnapshot | DiagonalsSnapshot | QuadrantSnapshot;

type ReadyRoundFor<Snapshot> = Snapshot extends RoundSnapshot
  ? Omit<Snapshot, "correct" | "answered" | "feedback"> & {
      kind: "ready";
      correct: 0;
      answered: 0;
      feedback: null;
    }
  : never;

type RunningRoundFor<Snapshot> = Snapshot extends RoundSnapshot
  ? Snapshot & { kind: "running"; endsAt: number }
  : never;

type PausedRoundFor<Snapshot> = Snapshot extends RoundSnapshot
  ? Snapshot & { kind: "paused"; remainingMs: number }
  : never;

export type ReadyRound = ReadyRoundFor<RoundSnapshot>;
export type RunningRound = RunningRoundFor<RoundSnapshot>;
export type PausedRound = PausedRoundFor<RoundSnapshot>;

export type RoundState =
  | { kind: "idle" }
  | ReadyRound
  | RunningRound
  | PausedRound
  | { kind: "finished"; attempt: Attempt };

type SquareColorsReadyRound = Extract<ReadyRound, { training: "square-colors" }>;
type SameColorReadyRound = Extract<ReadyRound, { training: "same-color" }>;
type CoordinatesReadyRound = Extract<ReadyRound, { training: "coordinates" }>;
type DiagonalsReadyRound = Extract<ReadyRound, { training: "diagonals" }>;
type QuadrantReadyRound = Extract<ReadyRound, { training: "quadrant" }>;
type SquareColorsRunningRound = Extract<RunningRound, { training: "square-colors" }>;
type SameColorRunningRound = Extract<RunningRound, { training: "same-color" }>;
type CoordinatesRunningRound = Extract<RunningRound, { training: "coordinates" }>;
type DiagonalsRunningRound = Extract<RunningRound, { training: "diagonals" }>;
type QuadrantRunningRound = Extract<RunningRound, { training: "quadrant" }>;
type SquarePromptRunningRound = SquareColorsRunningRound | CoordinatesRunningRound | QuadrantRunningRound;

export function squareColor(square: Square): SquareColor {
  const fileNumber = files.indexOf(square.file) + 1;
  return (fileNumber + square.rank) % 2 === 0 ? "dark" : "light";
}

export function quadrantForSquare(square: Square): QuadrantNumber {
  const fileIndex = files.indexOf(square.file);
  const quadrant = QUADRANT_DEFINITIONS.find(({ fileRange, rankRange }) =>
    fileIndex >= files.indexOf(fileRange[0]) &&
    fileIndex <= files.indexOf(fileRange[1]) &&
    square.rank >= rankRange[0] &&
    square.rank <= rankRange[1]
  );

  if (quadrant === undefined) {
    throw new Error("Square does not belong to a board quadrant.");
  }

  return quadrant.number;
}

export function randomSquare(random = Math.random): Square {
  return squareAt(randomIndex(random, 64));
}

export function randomSameColorPrompt(random = Math.random): SameColorPrompt {
  const firstIndex = randomIndex(random, 64);
  const secondIndex = randomIndex(random, 63);
  const distinctSecondIndex = secondIndex >= firstIndex ? secondIndex + 1 : secondIndex;

  return [squareAt(firstIndex), squareAt(distinctSecondIndex)];
}

function randomIndex(random: () => number, length: number): number {
  return Math.max(0, Math.min(length - 1, Math.floor(random() * length)));
}

function squareAt(index: number): Square {
  const file = files[index % 8];
  const rank = Math.floor(index / 8) + 1;

  if (file === undefined) {
    throw new Error("Random square index was outside the board.");
  }

  return { file, rank };
}

export function sameDiagonal(first: Square, second: Square): boolean {
  return Math.abs(files.indexOf(first.file) - files.indexOf(second.file)) === Math.abs(first.rank - second.rank);
}

function promptsForDiagonalRelation(relation: PairRelation): DiagonalPrompt[] {
  const prompts: DiagonalPrompt[] = [];

  for (let firstIndex = 0; firstIndex < 64; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < 64; secondIndex += 1) {
      const prompt: DiagonalPrompt = [squareAt(firstIndex), squareAt(secondIndex)];
      const promptRelation: PairRelation = sameDiagonal(prompt[0], prompt[1]) ? "same" : "different";
      if (promptRelation === relation) {
        prompts.push(prompt);
      }
    }
  }

  return prompts;
}

const diagonalPrompts = {
  same: promptsForDiagonalRelation("same"),
  different: promptsForDiagonalRelation("different")
} satisfies Record<PairRelation, DiagonalPrompt[]>;

export function randomDiagonalPrompt(random = Math.random): DiagonalPrompt {
  const relation: PairRelation = random() < 0.5 ? "same" : "different";
  const prompts = diagonalPrompts[relation];
  const prompt = prompts[randomIndex(random, prompts.length)];
  if (prompt === undefined) {
    throw new Error("The selected diagonal relation has no valid prompts.");
  }

  return prompt;
}

export function createAttempt(input: {
  id: string;
  completedAt: string;
  training: TrainingModule;
  score: number;
  answered: number;
}): Attempt {
  return AttemptSchema.parse({
    ...input,
    accuracy: input.answered === 0 ? null : Math.round((input.score / input.answered) * 100)
  });
}

type RoundPrompt =
  | { training: "square-colors"; prompt: Square }
  | { training: "same-color"; prompt: SameColorPrompt }
  | { training: "coordinates"; prompt: Square }
  | { training: "diagonals"; prompt: DiagonalPrompt }
  | { training: "quadrant"; prompt: Square };

export function prepareRound(input: { training: "square-colors"; prompt: Square }): SquareColorsReadyRound;
export function prepareRound(input: { training: "same-color"; prompt: SameColorPrompt }): SameColorReadyRound;
export function prepareRound(input: { training: "coordinates"; prompt: Square }): CoordinatesReadyRound;
export function prepareRound(input: { training: "diagonals"; prompt: DiagonalPrompt }): DiagonalsReadyRound;
export function prepareRound(input: { training: "quadrant"; prompt: Square }): QuadrantReadyRound;
export function prepareRound(input: RoundPrompt): ReadyRound {
  return {
    ...input,
    kind: "ready",
    correct: 0,
    answered: 0,
    feedback: null
  };
}

export function remainingMs(state: RoundState, now: number): number {
  switch (state.kind) {
    case "idle":
    case "finished":
      return 0;
    case "ready":
      return ATTEMPT_DURATION_MS;
    case "paused":
      return state.remainingMs;
    case "running":
      return Math.max(0, state.endsAt - now);
  }
}

export function startRoundClock(
  state: SquareColorsReadyRound | SquareColorsRunningRound,
  now: number
): SquareColorsRunningRound;
export function startRoundClock(
  state: SameColorReadyRound | SameColorRunningRound,
  now: number
): SameColorRunningRound;
export function startRoundClock(
  state: CoordinatesReadyRound | CoordinatesRunningRound,
  now: number
): CoordinatesRunningRound;
export function startRoundClock(
  state: DiagonalsReadyRound | DiagonalsRunningRound,
  now: number
): DiagonalsRunningRound;
export function startRoundClock(
  state: QuadrantReadyRound | QuadrantRunningRound,
  now: number
): QuadrantRunningRound;
export function startRoundClock(state: ReadyRound | RunningRound, now: number): RunningRound;
export function startRoundClock(state: RoundState, now: number): RoundState;
export function startRoundClock(state: RoundState, now: number): RoundState {
  if (state.kind !== "ready") {
    return state;
  }

  return { ...state, kind: "running", endsAt: now + ATTEMPT_DURATION_MS };
}

export function answerRound(input: {
  state: SquareColorsRunningRound;
  answer: SquareColor;
  now: number;
}): SquareColorsRunningRound {
  const { state } = input;
  if (state.feedback !== null || input.now >= state.endsAt) {
    return state;
  }

  const expected = squareColor(state.prompt);
  const isCorrect = input.answer === expected;

  return {
    ...state,
    ...recordAnswer({
      answered: state.answered,
      correct: state.correct,
      picked: input.answer,
      expected,
      isCorrect
    })
  };
}

export function answerQuadrantRound(input: {
  state: QuadrantRunningRound;
  answer: QuadrantNumber;
  now: number;
}): QuadrantRunningRound {
  const { state } = input;
  if (state.feedback !== null || input.now >= state.endsAt) {
    return state;
  }

  const expected = quadrantForSquare(state.prompt);
  const isCorrect = input.answer === expected;

  return {
    ...state,
    ...recordAnswer({
      answered: state.answered,
      correct: state.correct,
      picked: input.answer,
      expected,
      isCorrect
    })
  };
}

type PairRunningRound = SameColorRunningRound | DiagonalsRunningRound;

export function answerPairRound(input: {
  state: PairRunningRound;
  answer: PairRelation;
  now: number;
}): PairRunningRound {
  const { state } = input;
  if (state.feedback !== null || input.now >= state.endsAt) {
    return state;
  }

  const pairMatches = state.training === "same-color"
    ? sameColor(state.prompt[0], state.prompt[1])
    : sameDiagonal(state.prompt[0], state.prompt[1]);
  const expected: PairRelation = pairMatches ? "same" : "different";
  const isCorrect = input.answer === expected;

  return {
    ...state,
    ...recordAnswer({
      answered: state.answered,
      correct: state.correct,
      picked: input.answer,
      expected,
      isCorrect
    })
  };
}

export function answerCoordinatesRound(input: {
  state: CoordinatesRunningRound;
  answer: Square;
  now: number;
}): CoordinatesRunningRound {
  const { state } = input;
  if (state.feedback !== null || input.now >= state.endsAt) {
    return state;
  }

  const expected = state.prompt;
  const isCorrect = sameSquare(input.answer, expected);

  return {
    ...state,
    ...recordAnswer({
      answered: state.answered,
      correct: state.correct,
      picked: input.answer,
      expected,
      isCorrect
    })
  };
}

export function advanceSquarePromptRound(
  state: SquarePromptRunningRound,
  nextPrompt: Square
): SquarePromptRunningRound {
  if (state.feedback === null) {
    return state;
  }

  return { ...state, prompt: nextPrompt, feedback: null };
}

export function advancePairRound(
  state: PairRunningRound,
  nextPrompt: SameColorPrompt | DiagonalPrompt
): PairRunningRound {
  if (state.feedback === null) {
    return state;
  }

  return { ...state, prompt: nextPrompt, feedback: null };
}

export function sameColor(first: Square, second: Square): boolean {
  return squareColor(first) === squareColor(second);
}

export function sameSquare(first: Square, second: Square): boolean {
  return first.file === second.file && first.rank === second.rank;
}

export function pauseRound(state: RoundState, now: number): RoundState {
  if (state.kind !== "running") {
    return state;
  }

  const { endsAt, ...snapshot } = state;
  const left = Math.max(0, endsAt - now);
  if (left === 0) {
    return state;
  }

  return { ...snapshot, kind: "paused", remainingMs: left };
}

export function resumeRound(state: RoundState, now: number): RoundState {
  if (state.kind !== "paused") {
    return state;
  }

  const { remainingMs: left, ...snapshot } = state;
  return { ...snapshot, kind: "running", endsAt: now + left };
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
      training: state.training,
      score: state.correct,
      answered: state.answered
    })
  };
}
