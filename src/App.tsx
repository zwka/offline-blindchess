import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Download,
  History as HistoryIcon,
  House,
  Play,
  RotateCcw,
  Timer,
  Trash2,
  Trophy,
  X
} from "lucide-react";
import {
  advanceCoordinatesRound,
  advanceQuadrantRound,
  advancePairRound,
  advanceRound,
  answerCoordinatesRound,
  answerQuadrantRound,
  answerPairRound,
  answerRound,
  attemptsForTraining,
  finishRound,
  personalBestScore,
  pauseRound,
  prepareRound,
  QUADRANT_DEFINITIONS,
  randomDiagonalPrompt,
  randomSameColorPrompt,
  randomSquare,
  remainingMs,
  resumeRound,
  sameSquare,
  squareColor,
  startRoundClock,
  TrainingModuleSchema
} from "./domain";
import type {
  Attempt,
  CoordinatesFeedback,
  PairRelation,
  QuadrantNumber,
  ReadyRound,
  RoundState,
  Square,
  SquareColor,
  TrainingModule
} from "./domain";
import { clearAttemptHistory, readAttempts, saveAttempt } from "./storage";
import type { ThemePreference } from "./preferences";
import { useThemePreference } from "./useThemePreference";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

type Screen = "home" | "history" | "round" | "results";
type AnswerSubmission =
  | { training: "square-colors"; answer: SquareColor }
  | { training: "same-color"; answer: PairRelation }
  | { training: "coordinates"; answer: Square }
  | { training: "diagonals"; answer: PairRelation }
  | { training: "quadrant"; answer: QuadrantNumber };

const trainingModules = TrainingModuleSchema.options;

const trainingModuleMetadata = {
  "square-colors": {
    title: "Square Colors",
    description: "Name the color of one square at a time"
  },
  "same-color": {
    title: "Same Color",
    description: "Compare the color of two squares"
  },
  coordinates: {
    title: "Coordinates",
    description: "Find the named square on the board"
  },
  diagonals: {
    title: "Diagonals",
    description: "Decide whether two squares share a diagonal"
  },
  quadrant: {
    title: "Quadrant",
    description: "Identify which quadrant contains each square"
  }
} satisfies Record<TrainingModule, { title: string; description: string }>;

function trainingTitle(training: TrainingModule): string {
  return trainingModuleMetadata[training].title;
}

function trainingDescription(training: TrainingModule): string {
  return trainingModuleMetadata[training].description;
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} />
      ))}
    </span>
  );
}

function ThemeControl({
  preference,
  onChange
}: {
  preference: ThemePreference;
  onChange: (preference: ThemePreference) => void;
}) {
  return (
    <fieldset className="theme-control">
      <legend>Color theme</legend>
      <span className="theme-control-label" aria-hidden="true">Theme</span>
      {(["system", "light", "dark"] as const).map((option) => (
        <label className="theme-option" key={option}>
          <input
            type="radio"
            name="color-theme"
            value={option}
            checked={preference === option}
            onChange={() => onChange(option)}
          />
          <span>{option[0]?.toUpperCase()}{option.slice(1)}</span>
        </label>
      ))}
    </fieldset>
  );
}

function SquareBoard({
  anchors = ["a1"],
  label = "Chessboard with a1 marked as a dark square"
}: {
  anchors?: string[];
  label?: string;
}) {
  const files: Square["file"][] = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const squares = [8, 7, 6, 5, 4, 3, 2, 1].flatMap((rank) =>
    files.map((file) => ({ file, rank }))
  );
  const anchorSet = new Set(anchors);

  return (
    <div className="board-frame" role="img" aria-label={label}>
      <div className="board-grid">
        {squares.map((square) => {
          const name = `${square.file}${square.rank}`;
          return (
            <span
              key={name}
              className={`board-square board-square--${squareColor(square)}`}
              aria-hidden="true"
            >
              {anchorSet.has(name) && <span className="board-anchor">{name}</span>}
            </span>
          );
        })}
      </div>
      <div className="board-files" aria-hidden="true">
        {files.map((file) => <span key={file}>{file}</span>)}
      </div>
    </div>
  );
}

function CoordinateBoard({
  feedback,
  disabled,
  onSelect
}: {
  feedback: CoordinatesFeedback | null;
  disabled: boolean;
  onSelect: (square: Square) => void;
}) {
  const files: Square["file"][] = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const squares = [8, 7, 6, 5, 4, 3, 2, 1].flatMap((rank) =>
    files.map((file) => ({ file, rank }))
  );

  return (
    <div className="coordinate-board-frame">
      <div className="coordinate-board" role="group" aria-label="Select the square named in the question">
        {squares.map((square) => {
          const name = `${square.file}${square.rank}`;
          const isExpected = feedback !== null && sameSquare(square, feedback.expected);
          const isIncorrectPick = feedback?.kind === "incorrect" && sameSquare(square, feedback.picked);

          return (
            <button
              className={`board-square board-square--${squareColor(square)} coordinate-square${isExpected ? " coordinate-square--expected" : ""}${isIncorrectPick ? " coordinate-square--picked-incorrect" : ""}`}
              type="button"
              key={name}
              aria-label={`Select square ${name}`}
              tabIndex={-1}
              disabled={disabled}
              onKeyDown={(event) => event.preventDefault()}
              onClick={() => onSelect(square)}
            />
          );
        })}
      </div>
    </div>
  );
}

function QuadrantAnswerControls({
  disabled,
  onSelect
}: {
  disabled: boolean;
  onSelect: (quadrant: QuadrantNumber) => void;
}) {
  return (
    <div className="quadrant-answer-controls" role="group" aria-label="Choose the quadrant containing the square">
      {QUADRANT_DEFINITIONS.map(({ number }) => (
        <button
          className="quadrant-answer-button"
          type="button"
          key={number}
          disabled={disabled}
          onClick={() => onSelect(number)}
        >
          Quadrant {number}
        </button>
      ))}
    </div>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog !== null && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="dialog-heading">
        <h2 id="dialog-title">{title}</h2>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog" title="Close">
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function formatAccuracy(accuracy: number | null): string {
  return accuracy === null ? "--" : `${accuracy}%`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function PersonalBest({ attempts, training }: { attempts: Attempt[]; training: TrainingModule }) {
  const best = personalBestScore(attempts, training);

  return <>{best === null ? "--" : best}</>;
}

function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedTraining, setSelectedTraining] = useState<TrainingModule>("square-colors");
  const [historyTraining, setHistoryTraining] = useState<TrainingModule>("square-colors");
  const [round, setRound] = useState<RoundState>({ kind: "idle" });
  const roundRef = useRef(round);
  const [attempts, setAttempts] = useState<Attempt[]>(readAttempts);
  const { preference: themePreference, setPreference: selectTheme } = useThemePreference();
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [storageError, setStorageError] = useState(false);

  const updateRound = (next: RoundState) => {
    roundRef.current = next;
    setRound(next);
  };

  const finishExpiredAttempt = (current: RoundState, now: number): void => {
    const completed = finishRound({
      state: current,
      now,
      id: crypto.randomUUID(),
      completedAt: new Date(now).toISOString()
    });
    if (completed.kind !== "finished") {
      return;
    }

    updateRound(completed);
    setScreen("results");
  };

  useEffect(() => {
    const handleInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      const current = roundRef.current;
      const now = Date.now();

      if (document.hidden && current.kind === "running") {
        if (remainingMs(current, now) === 0) {
          finishExpiredAttempt(current, now);
          return;
        }
        updateRound(pauseRound(current, now));
      } else if (!document.hidden && current.kind === "paused") {
        updateRound(resumeRound(current, now));
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    if (screen !== "round" || round.kind !== "running") {
      return;
    }

    const tick = () => {
      const current = roundRef.current;
      if (current.kind !== "running") {
        return;
      }

      const now = Date.now();
      const left = remainingMs(current, now);
      setSecondsLeft((previous) => {
        const next = Math.ceil(left / 1_000);
        return previous === next ? previous : next;
      });

      if (left === 0) {
        finishExpiredAttempt(current, now);
      }
    };

    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [round.kind, screen]);

  useEffect(() => {
    if (screen !== "round" || round.kind !== "running" || round.feedback === null) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const current = roundRef.current;
      if (current.kind !== "running") {
        return;
      }

      if (current.training === "square-colors") {
        updateRound(advanceRound(current, randomSquare()));
      } else if (current.training === "same-color") {
        updateRound(advancePairRound(current, randomSameColorPrompt()));
      } else if (current.training === "coordinates") {
        updateRound(advanceCoordinatesRound(current, randomSquare()));
      } else if (current.training === "diagonals") {
        updateRound(advancePairRound(current, randomDiagonalPrompt()));
      } else {
        updateRound(advanceQuadrantRound(current, randomSquare()));
      }
    }, 430);

    return () => window.clearTimeout(timeout);
  }, [round, screen]);

  useEffect(() => {
    if (round.kind !== "finished") {
      return;
    }

    const saved = saveAttempt(round.attempt);
    setAttempts(saved.attempts);
    setStorageError(!saved.saved);
  }, [round]);

  const prepareAttempt = (training: TrainingModule) => {
    setSelectedTraining(training);
    let ready: ReadyRound;
    switch (training) {
      case "square-colors":
        ready = prepareRound({ training, prompt: randomSquare() });
        break;
      case "same-color":
        ready = prepareRound({ training, prompt: randomSameColorPrompt() });
        break;
      case "coordinates":
        ready = prepareRound({ training, prompt: randomSquare() });
        break;
      case "diagonals":
        ready = prepareRound({ training, prompt: randomDiagonalPrompt() });
        break;
      case "quadrant":
        ready = prepareRound({ training, prompt: randomSquare() });
        break;
      default: {
        const _exhaustive: never = training;
        return _exhaustive;
      }
    }

    updateRound(ready);
    setSecondsLeft(60);
    setStorageError(false);
    setScreen("round");
  };

  const selectTraining = (training: TrainingModule) => {
    prepareAttempt(training);
  };

  const openHistory = (training: TrainingModule = historyTraining) => {
    setHistoryTraining(training);
    setScreen("history");
  };

  const submitAnswer = (submission: AnswerSubmission) => {
    const current = roundRef.current;
    if (
      (current.kind !== "ready" && current.kind !== "running") ||
      current.training !== submission.training
    ) {
      return;
    }

    const now = Date.now();
    if (current.kind === "running" && remainingMs(current, now) === 0) {
      finishExpiredAttempt(current, now);
      return;
    }

    const running = startRoundClock(current, now);
    if (running.kind !== "running") {
      return;
    }

    switch (submission.training) {
      case "square-colors":
        if (running.training !== "square-colors") {
          return;
        }
        updateRound(answerRound({ state: running, answer: submission.answer, now }));
        break;
      case "same-color":
      case "diagonals":
        if (running.training !== submission.training) {
          return;
        }
        updateRound(answerPairRound({ state: running, answer: submission.answer, now }));
        break;
      case "coordinates":
        if (running.training !== "coordinates") {
          return;
        }
        updateRound(answerCoordinatesRound({ state: running, answer: submission.answer, now }));
        break;
      case "quadrant":
        if (running.training !== "quadrant") {
          return;
        }
        updateRound(answerQuadrantRound({ state: running, answer: submission.answer, now }));
        break;
      default: {
        const _exhaustive: never = submission;
        return _exhaustive;
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (screen !== "round" || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const current = roundRef.current;
      if (
        (current.kind !== "ready" && current.kind !== "running") ||
        current.training === "coordinates" ||
        current.training === "quadrant"
      ) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        submitAnswer(current.training === "square-colors"
          ? { training: "square-colors", answer: "light" }
          : current.training === "same-color"
            ? { training: "same-color", answer: "different" }
            : { training: "diagonals", answer: "different" });
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        submitAnswer(current.training === "square-colors"
          ? { training: "square-colors", answer: "dark" }
          : current.training === "same-color"
            ? { training: "same-color", answer: "same" }
            : { training: "diagonals", answer: "same" });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [screen]);

  const installApp = async () => {
    if (installPrompt === null) {
      setInstallHelpOpen(true);
      return;
    }

    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const clearHistory = () => {
    if (!window.confirm("Clear all saved attempts on this device?")) {
      return;
    }

    if (clearAttemptHistory()) {
      setAttempts([]);
      setStorageError(false);
    } else {
      setStorageError(true);
    }
  };

  const leaveRound = () => {
    if (
      roundRef.current.kind === "ready" ||
      roundRef.current.kind === "running" ||
      roundRef.current.kind === "paused"
    ) {
      updateRound({ kind: "idle" });
    }
    setScreen("home");
  };

  const historyAttempts = attemptsForTraining(attempts, historyTraining);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#home" onClick={(event) => { event.preventDefault(); leaveRound(); }}>
          <BrandMark />
          <span className="brand-label"><strong>OFFLINE</strong><span>BLIND CHESS</span></span>
        </a>
        <nav className="topbar-actions" aria-label="Main navigation">
          {screen === "round" ? (
            <button className="text-button" type="button" onClick={leaveRound}>
              <ArrowLeft size={17} /> <span>Exit</span>
            </button>
          ) : screen === "home" ? (
            <button className="text-button" type="button" onClick={() => openHistory()}>
              <HistoryIcon size={17} /> <span>History</span>
            </button>
          ) : (
            <button className="text-button" type="button" onClick={() => setScreen("home")}>
              <House size={17} /> <span>Home</span>
            </button>
          )}
          <button className="install-button" type="button" onClick={() => void installApp()}>
            <Download size={16} /> <span>Install</span>
          </button>
        </nav>
        <ThemeControl preference={themePreference} onChange={selectTheme} />
      </header>

      {screen === "home" && (
        <main className="training-hub page-width">
          <header className="training-hub-heading">
            <p className="eyebrow"><span className="eyebrow-dot" /> FOUNDATIONS <span>{trainingModules.length} DRILLS</span></p>
            <h1>Choose a drill</h1>
          </header>
          <section className="training-options" aria-label="Training modules">
            {trainingModules.map((training, index) => {
              const moduleAttempts = attempts.filter((attempt) => attempt.training === training);

              return (
                <button
                  className="training-option"
                  type="button"
                  key={training}
                  onClick={() => selectTraining(training)}
                >
                  <span className="training-option-index">0{index + 1}</span>
                  <span className="training-option-copy">
                    <strong>{trainingTitle(training)}</strong>
                    <span>{trainingDescription(training)}</span>
                  </span>
                  <span className="training-option-stats">
                    <span><span className="section-label">PERSONAL BEST</span><strong><PersonalBest attempts={attempts} training={training} /></strong></span>
                    <span><span className="section-label">ATTEMPTS</span><strong>{moduleAttempts.length}</strong></span>
                  </span>
                  <ArrowRight size={19} aria-hidden="true" />
                </button>
              );
            })}
          </section>
        </main>
      )}

      {screen === "round" && round.kind !== "idle" && round.kind !== "finished" && (
        <main className={`round-page page-width${round.training === "coordinates" ? " coordinate-round-page" : ""}`}>
          <div className="round-topline">
            <div className="round-progress" role="progressbar" aria-label="Time remaining" aria-valuemin={0} aria-valuemax={60} aria-valuenow={secondsLeft}>
              <span style={{ width: `${(secondsLeft / 60) * 100}%` }} />
            </div>
            <div className="round-metrics">
              <div className="timer-metric"><Timer size={17} /><strong>{String(secondsLeft).padStart(2, "0")}</strong><span>SEC</span></div>
              <div className="score-metric"><span className="section-label">SCORE</span><strong>{round.correct}</strong></div>
            </div>
          </div>

          <section
            className={`question-zone${round.training === "coordinates" ? " coordinate-question-zone" : ""}`}
            aria-label={
              round.training === "square-colors" ? "Square color question" :
                round.training === "same-color" ? "Same color question" :
                  round.training === "diagonals" ? "Diagonals question" :
                    round.training === "quadrant" ? "Quadrant question" : "Coordinates question"
            }
          >
            <p className="question-kicker">
              {round.training === "square-colors" ? "WHAT COLOR IS THIS SQUARE?" :
                round.training === "same-color" ? "DO THESE SQUARES SHARE A COLOR?" :
                  round.training === "diagonals" ? "DO THESE SQUARES SHARE A DIAGONAL?" :
                    round.training === "quadrant" ? "WHICH QUADRANT CONTAINS THIS SQUARE?" : "FIND THIS SQUARE"}
            </p>
            {round.training === "same-color" || round.training === "diagonals" ? (
              <div className="coordinate-pair" aria-live="polite" aria-atomic="true">
                <span className="coordinate">{round.prompt[0].file}{round.prompt[0].rank}</span>
                <span className="coordinate-pair-divider" aria-hidden="true">?</span>
                <span className="coordinate">{round.prompt[1].file}{round.prompt[1].rank}</span>
              </div>
            ) : (
              <div className="coordinate" aria-live="polite" aria-atomic="true">{round.prompt.file}{round.prompt.rank}</div>
            )}
            <div className={`answer-feedback${round.feedback ? ` answer-feedback--${round.feedback.kind}` : ""}`} role="status" aria-live="polite">
              {round.feedback?.kind === "correct" ? (
                <><Check size={17} /> Correct</>
              ) : round.feedback?.kind === "incorrect" ? (
                <>
                  <X size={17} />
                  {round.training === "square-colors" ? `It is ${round.feedback.expected}` :
                    round.training === "same-color" || round.training === "diagonals"
                      ? round.training === "diagonals"
                        ? round.feedback.expected === "same" ? "They share a diagonal" : "They do not share a diagonal"
                        : round.feedback.expected === "same" ? "They are the same color" : "They are different colors"
                      : round.training === "quadrant"
                        ? `That square is in Quadrant ${round.feedback.expected}`
                      : `That square is ${round.feedback.expected.file}${round.feedback.expected.rank}`}
                </>
              ) : <span aria-hidden="true">&nbsp;</span>}
            </div>
          </section>

          {round.training === "quadrant" ? (
            <QuadrantAnswerControls
              disabled={round.feedback !== null || round.kind === "paused"}
              onSelect={(answer) => submitAnswer({ training: "quadrant", answer })}
            />
          ) : round.training === "coordinates" ? (
            <CoordinateBoard
              feedback={round.feedback}
              disabled={round.feedback !== null || round.kind === "paused"}
              onSelect={(square) => submitAnswer({ training: "coordinates", answer: square })}
            />
          ) : (
            <div className="answer-controls" aria-label={
              round.training === "square-colors" ? "Choose square color" :
                round.training === "diagonals" ? "Choose whether the squares share a diagonal" :
                  "Choose whether the squares share a color"
            }>
              <button
                className="answer-button answer-button--light"
                type="button"
                onClick={() => submitAnswer(round.training === "square-colors"
                  ? { training: "square-colors", answer: "light" }
                  : round.training === "same-color"
                    ? { training: "same-color", answer: "different" }
                    : { training: "diagonals", answer: "different" })}
                disabled={round.feedback !== null || round.kind === "paused"}
              >
                <ArrowLeft className="answer-direction" size={19} aria-hidden="true" />
                {round.training === "square-colors" ? "Light" : "Different"}
              </button>
              <button
                className="answer-button answer-button--dark"
                type="button"
                onClick={() => submitAnswer(round.training === "square-colors"
                  ? { training: "square-colors", answer: "dark" }
                  : round.training === "same-color"
                    ? { training: "same-color", answer: "same" }
                    : { training: "diagonals", answer: "same" })}
                disabled={round.feedback !== null || round.kind === "paused"}
              >
                <ArrowRight className="answer-direction" size={19} aria-hidden="true" />
                {round.training === "square-colors" ? "Dark" : "Same"}
              </button>
            </div>
          )}
        </main>
      )}

      {screen === "results" && round.kind === "finished" && (
        <main className="results-page page-width">
          <div className="results-heading">
            <span className="results-icon"><Trophy size={24} /></span>
            <p className="eyebrow">{trainingTitle(round.attempt.training).toUpperCase()} COMPLETE</p>
            <h1>Good work.</h1>
            <p className="results-score"><strong>{round.attempt.score}</strong><span>correct</span></p>
          </div>
          <div className="results-stats">
            <div><span className="section-label">ACCURACY</span><strong>{formatAccuracy(round.attempt.accuracy)}</strong></div>
            <div><span className="section-label">ANSWERED</span><strong>{round.attempt.answered}</strong></div>
            <div><span className="section-label">PERSONAL BEST</span><strong><PersonalBest attempts={attempts} training={round.attempt.training} /></strong></div>
          </div>
          {storageError && <p className="storage-warning" role="alert">This attempt could not be saved on this device.</p>}
          <div className="result-actions">
            <button className="primary-button" type="button" onClick={() => prepareAttempt(round.attempt.training)}><RotateCcw size={17} /> Play again</button>
            <button className="secondary-button" type="button" onClick={() => openHistory(round.attempt.training)}><HistoryIcon size={17} /> History</button>
          </div>
          <button className="inline-link result-home-link" type="button" onClick={() => setScreen("home")}>
            <House size={16} /> Home
          </button>
        </main>
      )}

      {screen === "history" && (
        <main className="history-page page-width">
          <div className="history-title-row">
            <div>
              <p className="eyebrow"><span className="eyebrow-dot" /> PRACTICE LOG</p>
              <h1>Attempt history</h1>
            </div>
          </div>

          <nav className="history-tabs" aria-label="Training module history">
            {trainingModules.map((training) => (
              <button
                className={`history-tab${historyTraining === training ? " history-tab--selected" : ""}`}
                type="button"
                key={training}
                aria-pressed={historyTraining === training}
                onClick={() => setHistoryTraining(training)}
              >
                {trainingTitle(training)}
              </button>
            ))}
          </nav>

          <section className="best-strip" aria-label={`${trainingTitle(historyTraining)} personal best`}>
            <Trophy size={19} />
            <span className="section-label">{trainingTitle(historyTraining).toUpperCase()} PERSONAL BEST</span>
            <strong><PersonalBest attempts={attempts} training={historyTraining} /></strong>
          </section>

          {historyAttempts.length === 0 ? (
            <div className="empty-history">
              <div className="empty-mark"><HistoryIcon size={22} /></div>
              <h2>No {trainingTitle(historyTraining)} attempts yet</h2>
              <button className="inline-link" type="button" onClick={() => prepareAttempt(historyTraining)}>
                <Play size={16} fill="currentColor" /> Start {trainingTitle(historyTraining)}
              </button>
            </div>
          ) : (
            <>
              <div className="history-list" role="table" aria-label={`Completed ${trainingTitle(historyTraining)} attempts`}>
                <div className="history-row history-row--head" role="row">
                  <span role="columnheader">COMPLETED</span><span role="columnheader">SCORE</span><span role="columnheader">ACCURACY</span><span role="columnheader">ANSWERED</span>
                </div>
                {historyAttempts.map((attempt) => (
                  <div className="history-row" role="row" key={attempt.id}>
                    <span role="cell">{formatDate(attempt.completedAt)}</span>
                    <strong role="cell">{attempt.score}</strong>
                    <span role="cell">{formatAccuracy(attempt.accuracy)}</span>
                    <span role="cell">{attempt.answered}</span>
                  </div>
                ))}
              </div>
              <div className="history-footer">
                <span>{historyAttempts.length} {historyAttempts.length === 1 ? "attempt" : "attempts"}</span>
                <button className="clear-button" type="button" onClick={clearHistory}><Trash2 size={15} /> Clear all history</button>
              </div>
            </>
          )}
          {storageError && <p className="storage-warning" role="alert">History could not be updated in this browser.</p>}
        </main>
      )}

      <footer className="app-footer page-width">
        <span>OFFLINE BLIND CHESS</span>
        {screen === "round" && (
          <button className="footer-rule" type="button" onClick={() => setRuleOpen(true)}>
            <BookOpen size={14} /> {trainingTitle(selectedTraining)} rule
          </button>
        )}
      </footer>

      {ruleOpen && (
        <Dialog
          title={`${trainingTitle(selectedTraining)} rule`}
          onClose={() => setRuleOpen(false)}
        >
          {selectedTraining === "square-colors" ? (
            <div className="rule-dialog-content">
              <SquareBoard />
              <div className="rule-detail">
                <p><strong>a1 is dark.</strong> Moving one square along a rank or file changes the color. Moving diagonally keeps the same color.</p>
                <p>For a check, number files <strong>a–h</strong> as <strong>1–8</strong> and add the rank. An even sum is dark; an odd sum is light.</p>
              </div>
            </div>
          ) : selectedTraining === "same-color" ? (
            <div className="rule-dialog-content">
              <SquareBoard anchors={["a1", "c3"]} label="Chessboard with a1 and c3 marked as dark squares" />
              <div className="rule-detail">
                <p><strong>a1 and c3 are both dark.</strong> Two squares share a color when their file-plus-rank totals have the same parity.</p>
                <p>For example, a1 and c3 match, while a1 and b1 differ. A diagonal step changes both file and rank, so it stays on the same color.</p>
              </div>
            </div>
          ) : selectedTraining === "diagonals" ? (
            <div className="rule-detail coordinate-rule-detail">
              <p><strong>Diagonal squares share a color.</strong> They lie on the same diagonal when their file and rank differences are equal in magnitude.</p>
              <p>Same color alone does not prove that two squares lie on the same diagonal.</p>
            </div>
          ) : selectedTraining === "quadrant" ? (
            <div className="quadrant-rule-content">
              <div className="quadrant-map" role="group" aria-label="Quadrant number ranges">
                {QUADRANT_DEFINITIONS.map(({ number, label }) => (
                  <div className="quadrant-map-cell" key={number}>
                    <strong>Quadrant {number}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <div className="rule-detail">
                <p>Files <strong>a-d</strong> are on the left and <strong>e-h</strong> on the right. Ranks <strong>5-8</strong> are above ranks <strong>1-4</strong>.</p>
                <p>Practice one quadrant range at a time. Move to the next when its squares come to mind quickly.</p>
              </div>
            </div>
          ) : (
            <div className="rule-detail coordinate-rule-detail">
              <p>Files run from left to right. Ranks run from bottom to top.</p>
              <p>Use the coordinate in the question to locate its square on the board.</p>
            </div>
          )}
        </Dialog>
      )}

      {installHelpOpen && (
        <Dialog title="Install Offline Blind Chess" onClose={() => setInstallHelpOpen(false)}>
          <div className="install-instructions">
            <section><h3>Desktop or Android</h3><p>In Chrome, open the menu and choose <strong>Install app</strong> or <strong>Install page as app</strong>.</p></section>
            <section><h3>iPhone</h3><p>In Chrome, tap <strong>Share</strong>, choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</p></section>
            <p className="install-note">Open this app once while online so its files are available offline.</p>
          </div>
        </Dialog>
      )}
    </div>
  );
}

export default App;
