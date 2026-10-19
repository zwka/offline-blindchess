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
  advanceRound,
  answerRound,
  finishRound,
  pauseRound,
  randomSquare,
  remainingMs,
  resumeRound,
  squareColor,
  startRound
} from "./domain";
import type { Attempt, RoundState, Square, SquareColor } from "./domain";
import { clearAttemptHistory, readAttempts, saveAttempt } from "./storage";

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

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} />
      ))}
    </span>
  );
}

function SquareBoard() {
  const files: Square["file"][] = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const squares = [8, 7, 6, 5, 4, 3, 2, 1].flatMap((rank) =>
    files.map((file) => ({ file, rank }))
  );

  return (
    <div className="board-frame" role="img" aria-label="Chessboard with a1 marked as a dark square">
      <div className="board-grid">
        {squares.map((square) => {
          const name = `${square.file}${square.rank}`;
          return (
            <span
              key={name}
              className={`board-square board-square--${squareColor(square)}`}
              aria-hidden="true"
            >
              {name === "a1" && <span className="board-anchor">a1</span>}
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

function PersonalBest({ attempts }: { attempts: Attempt[] }) {
  const best = attempts.reduce<number | null>((highest, attempt) =>
    highest === null ? attempt.score : Math.max(highest, attempt.score), null);

  return <>{best === null ? "--" : best}</>;
}

function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [round, setRound] = useState<RoundState>({ kind: "idle" });
  const roundRef = useRef(round);
  const [attempts, setAttempts] = useState<Attempt[]>(readAttempts);
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
      updateRound(advanceRound(current, randomSquare()));
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

  const startAttempt = () => {
    const started = startRound({ now: Date.now(), prompt: randomSquare() });
    updateRound(started);
    setSecondsLeft(60);
    setStorageError(false);
    setScreen("round");
  };

  const submitAnswer = (answer: SquareColor) => {
    const current = roundRef.current;
    if (current.kind !== "running") {
      return;
    }

    const now = Date.now();
    if (remainingMs(current, now) === 0) {
      finishExpiredAttempt(current, now);
      return;
    }

    updateRound(answerRound({ state: current, answer, now }));
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (screen !== "round" || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        submitAnswer("light");
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        submitAnswer("dark");
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
    if (roundRef.current.kind === "running" || roundRef.current.kind === "paused") {
      updateRound({ kind: "idle" });
    }
    setScreen("home");
  };

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
          ) : screen === "history" || screen === "results" ? (
            <button className="text-button" type="button" onClick={() => setScreen("home")}>
              <House size={17} /> <span>Home</span>
            </button>
          ) : (
            <button className="text-button" type="button" onClick={() => setScreen("history")}>
              <HistoryIcon size={17} /> <span>History</span>
            </button>
          )}
          <button className="install-button" type="button" onClick={() => void installApp()}>
            <Download size={16} /> <span>Install</span>
          </button>
        </nav>
      </header>

      {screen === "home" && (
        <main className="home-page page-width">
          <section className="home-copy" aria-labelledby="home-title">
            <p className="eyebrow"><span className="eyebrow-dot" /> FOUNDATIONS <span>01</span></p>
            <h1 id="home-title">Square<br />Colors</h1>
            <div className="home-rule">
              <span className="section-label">THE RULE</span>
              <p><strong>a1 is dark.</strong> Every step to a neighboring square changes its color.</p>
              <button className="inline-link" type="button" onClick={() => setRuleOpen(true)}>
                <BookOpen size={16} /> Full rule
              </button>
            </div>
            <button className="primary-button start-button" type="button" onClick={startAttempt}>
              <Play size={18} fill="currentColor" /> Start <span className="button-detail">60 sec</span>
            </button>
            <div className="home-stats" aria-label="Your Square Colors results">
              <div><span className="section-label">PERSONAL BEST</span><strong><PersonalBest attempts={attempts} /></strong></div>
              <div><span className="section-label">ATTEMPTS</span><strong>{attempts.length}</strong></div>
            </div>
          </section>

          <aside className="home-visual" aria-label="Square color reference">
            <div className="board-caption"><span>CHESSBOARD</span><span>8 × 8</span></div>
            <SquareBoard />
            <p className="visual-note"><span className="dark-swatch" /> <span>a1 anchors the pattern</span></p>
            <button className="home-history-link" type="button" onClick={() => setScreen("history")}>
              <HistoryIcon size={17} /> Review attempts <span>{attempts.length}</span>
            </button>
          </aside>
        </main>
      )}

      {screen === "round" && round.kind !== "idle" && round.kind !== "finished" && (
        <main className="round-page page-width">
          <div className="round-topline">
            <div className="round-progress" role="progressbar" aria-label="Time remaining" aria-valuemin={0} aria-valuemax={60} aria-valuenow={secondsLeft}>
              <span style={{ width: `${(secondsLeft / 60) * 100}%` }} />
            </div>
            <div className="round-metrics">
              <div className="timer-metric"><Timer size={17} /><strong>{String(secondsLeft).padStart(2, "0")}</strong><span>SEC</span></div>
              <div className="score-metric"><span className="section-label">SCORE</span><strong>{round.correct}</strong></div>
            </div>
          </div>

          <section className="question-zone" aria-label="Square color question">
            <p className="question-kicker">WHAT COLOR IS THIS SQUARE?</p>
            <div className="coordinate" aria-live="polite" aria-atomic="true">{round.prompt.file}{round.prompt.rank}</div>
            <div className={`answer-feedback${round.feedback ? ` answer-feedback--${round.feedback.kind}` : ""}`} role="status" aria-live="polite">
              {round.feedback?.kind === "correct" ? (
                <><Check size={17} /> Correct</>
              ) : round.feedback?.kind === "incorrect" ? (
                <><X size={17} /> {`It is ${round.feedback.expected}`}</>
              ) : <span aria-hidden="true">&nbsp;</span>}
            </div>
          </section>

          <div className="answer-controls" aria-label="Choose square color">
            <button className="answer-button answer-button--light" type="button" onClick={() => submitAnswer("light")} disabled={round.feedback !== null}>
              <ArrowLeft className="answer-direction" size={19} aria-hidden="true" /> Light
            </button>
            <button className="answer-button answer-button--dark" type="button" onClick={() => submitAnswer("dark")} disabled={round.feedback !== null}>
              <ArrowRight className="answer-direction" size={19} aria-hidden="true" /> Dark
            </button>
          </div>
        </main>
      )}

      {screen === "results" && round.kind === "finished" && (
        <main className="results-page page-width">
          <div className="results-heading">
            <span className="results-icon"><Trophy size={24} /></span>
            <p className="eyebrow">ATTEMPT COMPLETE</p>
            <h1>Good work.</h1>
            <p className="results-score"><strong>{round.attempt.score}</strong><span>correct</span></p>
          </div>
          <div className="results-stats">
            <div><span className="section-label">ACCURACY</span><strong>{formatAccuracy(round.attempt.accuracy)}</strong></div>
            <div><span className="section-label">ANSWERED</span><strong>{round.attempt.answered}</strong></div>
            <div><span className="section-label">PERSONAL BEST</span><strong><PersonalBest attempts={attempts} /></strong></div>
          </div>
          {storageError && <p className="storage-warning" role="alert">This attempt could not be saved on this device.</p>}
          <div className="result-actions">
            <button className="primary-button" type="button" onClick={startAttempt}><RotateCcw size={17} /> Play again</button>
            <button className="secondary-button" type="button" onClick={() => setScreen("history")}><HistoryIcon size={17} /> History</button>
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
            <button className="primary-button history-start" type="button" onClick={startAttempt}><Play size={17} fill="currentColor" /> Start</button>
          </div>

          <section className="best-strip" aria-label="Personal best score">
            <Trophy size={19} />
            <span className="section-label">PERSONAL BEST</span>
            <strong><PersonalBest attempts={attempts} /></strong>
          </section>

          {attempts.length === 0 ? (
            <div className="empty-history">
              <div className="empty-mark"><HistoryIcon size={22} /></div>
              <h2>No attempts yet</h2>
              <button className="inline-link" type="button" onClick={startAttempt}><Play size={16} fill="currentColor" /> Start Square Colors</button>
            </div>
          ) : (
            <>
              <div className="history-list" role="table" aria-label="Completed attempts">
                <div className="history-row history-row--head" role="row">
                  <span role="columnheader">COMPLETED</span><span role="columnheader">SCORE</span><span role="columnheader">ACCURACY</span><span role="columnheader">ANSWERED</span>
                </div>
                {attempts.map((attempt) => (
                  <div className="history-row" role="row" key={attempt.id}>
                    <span role="cell">{formatDate(attempt.completedAt)}</span>
                    <strong role="cell">{attempt.score}</strong>
                    <span role="cell">{formatAccuracy(attempt.accuracy)}</span>
                    <span role="cell">{attempt.answered}</span>
                  </div>
                ))}
              </div>
              <div className="history-footer">
                <span>{attempts.length} {attempts.length === 1 ? "attempt" : "attempts"}</span>
                <button className="clear-button" type="button" onClick={clearHistory}><Trash2 size={15} /> Clear history</button>
              </div>
            </>
          )}
          {storageError && <p className="storage-warning" role="alert">History could not be updated in this browser.</p>}
        </main>
      )}

      <footer className="app-footer page-width">
        <span>OFFLINE BLIND CHESS</span>
        <button className="footer-rule" type="button" onClick={() => setRuleOpen(true)}><BookOpen size={14} /> Square color rule</button>
      </footer>

      {ruleOpen && (
        <Dialog title="Square color rule" onClose={() => setRuleOpen(false)}>
          <div className="rule-dialog-content">
            <SquareBoard />
            <div className="rule-detail">
              <p><strong>a1 is dark.</strong> Moving one square along a rank or file changes the color. Moving diagonally keeps the same color.</p>
              <p>For a check, number files <strong>a–h</strong> as <strong>1–8</strong> and add the rank. An even sum is dark; an odd sum is light.</p>
            </div>
          </div>
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
