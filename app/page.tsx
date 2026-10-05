"use client";

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

type ActionType =
  | "action"
  | "questions"
  | "escalation"
  | "monitor"
  | "resolved";

type Stage =
  | "home"
  | "idle"
  | "investigating"
  | "action"
  | "awaiting-result"
  | "reassessing"
  | "resolved";

type Hypothesis = {
  explanation: string;
  confidence: number;
  evidence: string;
};

type NextAction = {
  action: string;
  reason: string;
  urgency: "low" | "medium" | "high";
  type?: ActionType;
};

type CaseResult = {
  problem: string;
  summary: string;
  known: string[];
  unknown: string[];
  hypotheses: Hypothesis[];
  questions: string[];
  nextAction: NextAction;
  safety: string[];
  escalation: string | null;
};

type Attachment = {
  name: string;
  type: string;
  size: number;
};

type HistoryCase = {
  id: string;
  situation: string;
  result: CaseResult;
  createdAt: string;
  updatedAt: string;
};

const HISTORY_KEY = "what-now-history";
const THEME_KEY = "what-now-theme";

const QUICK_TIPS = [
  "What changed?",
  "What did you expect?",
  "What have you already tried?",
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function confidenceLabel(result: CaseResult) {
  const values = result.hypotheses
    .map((item) => item.confidence)
    .filter((value) => Number.isFinite(value));

  if (!values.length) return "Unknown";

  const confidence = Math.max(...values);

  if (confidence >= 0.8) return "High";
  if (confidence >= 0.55) return "Medium";

  return "Low";
}

function confidencePercent(value: number) {
  return `${Math.max(0, Math.min(1, value)) * 100}%`;
}

function Section({
  label,
  title,
  description,
  count,
  children,
  className = "",
}: {
  label: string;
  title: string;
  description?: string;
  count?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`case-section ${className}`}>
      <div className="section-heading">
        <div>
          <div className="eyebrow">{label}</div>
          <h3>{title}</h3>

          {description && <p>{description}</p>}
        </div>

        {typeof count === "number" && (
          <span className="section-count">{count}</span>
        )}
      </div>

      {children}
    </section>
  );
}

function ItemList({
  items,
  empty,
  variant = "confirmed",
}: {
  items: string[];
  empty: string;
  variant?: "confirmed" | "unknown";
}) {
  if (!items.length) {
    return <p className="muted">{empty}</p>;
  }

  return (
    <ul className={`item-list ${variant}`}>
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>
          <span className="item-marker" aria-hidden="true">
            {variant === "confirmed" ? "✓" : "?"}
          </span>

          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function HypothesisList({
  items,
}: {
  items: CaseResult["hypotheses"];
}) {
  if (!items.length) {
    return (
      <p className="muted">
        No meaningful explanations identified yet.
      </p>
    );
  }

  return (
    <div className="hypothesis-list">
      {items.map((item, index) => {
        const value = Number.isFinite(item.confidence)
          ? item.confidence
          : 0;

        return (
          <article
            className="hypothesis-row"
            key={`${item.explanation}-${index}`}
          >
            <span className="hypothesis-index">
              {String(index + 1).padStart(2, "0")}
            </span>

            <div className="hypothesis-main">
              <strong>{item.explanation}</strong>

              <span className="confidence-track">
                <i style={{ width: confidencePercent(value) }} />
              </span>
            </div>

            <span className="hypothesis-percent">
              {Math.round(value * 100)}%
            </span>

            <span className="hypothesis-arrow">›</span>

            <div className="hypothesis-evidence">
              {item.evidence}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function getActionType(result: CaseResult | null): ActionType {
  if (!result?.nextAction) return "action";

  return result.nextAction.type || "action";
}

export default function Home() {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [result, setResult] = useState<CaseResult | null>(null);
  const [outcome, setOutcome] = useState("");
  const [questionAnswers, setQuestionAnswers] = useState<
    Record<number, string>
  >({});
  const [history, setHistory] = useState<HistoryCase[]>([]);

  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<Stage>("home");
  const [error, setError] = useState("");
  const [dark, setDark] = useState(true);

  const confidence = useMemo(
    () => (result ? confidenceLabel(result) : "—"),
    [result]
  );

  const actionType = useMemo(
    () => getActionType(result),
    [result]
  );

  /* =========================================================
     INITIALIZATION
     ========================================================= */

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(HISTORY_KEY);

      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);

        if (Array.isArray(parsed)) {
          setHistory(parsed);
        }
      }

      const savedTheme = localStorage.getItem(THEME_KEY);

      if (savedTheme === "light") {
        setDark(false);
      } else {
        setDark(true);
      }
    } catch {
      setDark(true);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle(
      "theme-dark",
      dark
    );

    localStorage.setItem(
      THEME_KEY,
      dark ? "dark" : "light"
    );
  }, [dark]);

  /* =========================================================
     NAVIGATION
     ========================================================= */

  function goHome() {
    setStage("home");
    setError("");
  }

  function newCase() {
    setInput("");
    setAttachments([]);
    setResult(null);
    setOutcome("");
    setQuestionAnswers({});
    setError("");
    setStage("idle");
  }

  /* =========================================================
     HISTORY
     ========================================================= */

  function saveHistory(nextResult: CaseResult) {
    const now = new Date().toISOString();

    const entry: HistoryCase = {
      id: crypto.randomUUID(),
      situation: input.trim(),
      result: nextResult,
      createdAt: now,
      updatedAt: now,
    };

    setHistory((current) => {
      const next = [entry, ...current].slice(0, 20);

      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(next)
      );

      return next;
    });
  }

  function updateLatestHistory(nextResult: CaseResult) {
    setHistory((current) => {
      if (!current.length) return current;

      const next = current.map((item, index) =>
        index === 0
          ? {
              ...item,
              result: nextResult,
              updatedAt: new Date().toISOString(),
            }
          : item
      );

      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(next)
      );

      return next;
    });
  }

  function openHistory(item: HistoryCase) {
    setInput(item.situation);
    setResult(item.result);
    setAttachments([]);
    setOutcome("");
    setQuestionAnswers({});
    setError("");

    if (
      item.result.nextAction?.type === "resolved"
    ) {
      setStage("resolved");
    } else {
      setStage("action");
    }
  }

  /* =========================================================
     FILES
     ========================================================= */

  function addFiles(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(
      event.target.files ?? []
    );

    setAttachments((current) => [
      ...current,
      ...files.map((file) => ({
        name: file.name,
        type: file.type || "unknown",
        size: file.size,
      })),
    ]);

    event.target.value = "";
  }

  function removeFile(index: number) {
    setAttachments((current) =>
      current.filter(
        (_, currentIndex) => currentIndex !== index
      )
    );
  }

  /* =========================================================
     INVESTIGATION
     ========================================================= */

  async function investigate() {
    if (!input.trim() || loading) return;

    setLoading(true);
    setStage("investigating");
    setError("");
    setResult(null);

    try {
      const response = await fetch(
        "/api/investigate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            operation: "investigate",
            situation: input.trim(),
            attachments,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Investigation failed."
        );
      }

      setResult(data);

      saveHistory(data);

      if (
        data.nextAction?.type === "resolved"
      ) {
        setStage("resolved");
      } else {
        setStage("action");
      }
    } catch (cause) {
      setStage("idle");

      setError(
        cause instanceof Error
          ? cause.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     RESULT / REASSESSMENT
     ========================================================= */

  function beginResult() {
    setStage("awaiting-result");
    setOutcome("");
    setError("");
  }

  async function submitOutcome() {
    if (!result || !outcome.trim() || loading) {
      return;
    }

    setLoading(true);
    setStage("reassessing");
    setError("");

    try {
      const response = await fetch(
        "/api/investigate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            operation: "reassess",
            situation: input.trim(),
            actionTaken:
              result.nextAction?.action || "",
            outcome: outcome.trim(),
            context: {
              previousResult: result,
            },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Reassessment failed."
        );
      }

      setResult(data);
      setOutcome("");
      updateLatestHistory(data);

      if (
        data.nextAction?.type === "resolved"
      ) {
        setStage("resolved");
      } else {
        setStage("action");
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Reassessment failed."
      );

      setStage("awaiting-result");
    } finally {
      setLoading(false);
    }
  }

  async function submitQuestionAnswers() {
    if (!result || loading) return;

    const answered = Object.entries(
      questionAnswers
    ).filter(([, value]) => value.trim());

    if (!answered.length) return;

    const answers = answered.map(
      ([index, answer]) => ({
        question:
          result.questions[Number(index)] || "",
        answer,
      })
    );

    setLoading(true);
    setStage("reassessing");
    setError("");

    try {
      const response = await fetch(
        "/api/investigate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            operation: "reassess",
            situation: input.trim(),
            actionTaken:
              result.nextAction?.action || "",
            outcome: answers
              .map(
                (item) =>
                  `Question: ${item.question}\nAnswer: ${item.answer}`
              )
              .join("\n\n"),
            context: {
              previousResult: result,
              questionAnswers: answers,
            },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Reassessment failed."
        );
      }

      setResult(data);
      setQuestionAnswers({});
      updateLatestHistory(data);

      if (
        data.nextAction?.type === "resolved"
      ) {
        setStage("resolved");
      } else {
        setStage("action");
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Reassessment failed."
      );

      setStage("action");
    } finally {
      setLoading(false);
    }
  }

  async function retry() {
    if (loading) return;

    if (
      stage === "awaiting-result" &&
      outcome.trim()
    ) {
      await submitOutcome();
      return;
    }

    if (result && Object.values(questionAnswers).some(
      (value) => value.trim()
    )) {
      await submitQuestionAnswers();
      return;
    }

    await investigate();
  }

  /* =========================================================
     STAGE
     ========================================================= */

  const stageLabel =
    stage === "idle"
      ? "Ready"
      : stage === "investigating"
        ? "Investigating"
        : stage === "action"
          ? "Decision ready"
          : stage === "awaiting-result"
            ? "Awaiting result"
            : stage === "reassessing"
              ? "Reassessing"
              : stage === "resolved"
                ? "Resolved"
                : "Home";

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <main
      className={`app-shell ${
        dark ? "theme-dark" : ""
      }`}
    >
      {/* =====================================================
          SIDEBAR
          ===================================================== */}

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <img
              src="/what-now-favicon.png"
              alt="What Now?"
            />
          </div>

          <div>
            <strong>What Now?</strong>
            <span>Problem resolution engine</span>
          </div>
        </div>

        <button
          className="new-case-button"
          type="button"
          onClick={newCase}
        >
          <span>+</span>
          New case
        </button>

        <nav className="main-nav">
          <button
            type="button"
            className={
              stage === "home" ? "active" : ""
            }
            onClick={goHome}
          >
            <span>⌂</span>
            Home
          </button>
        </nav>

        <div className="nav-label">
          Recent cases
        </div>

        <div className="recent-cases">
          {history.length === 0 ? (
            <div className="empty-history">
              <div className="history-icon">
                ◌
              </div>

              <p>No cases yet</p>

              <small>
                Your recent investigations will
                appear here.
              </small>
            </div>
          ) : (
            history.map((item, index) => (
              <button
                type="button"
                className={`history-item ${
                  index === 0 &&
                  stage !== "home" &&
                  result
                    ? "selected"
                    : ""
                }`}
                key={item.id}
                onClick={() =>
                  openHistory(item)
                }
              >
                <span className="history-title">
                  {item.result.problem ||
                    item.situation ||
                    "Untitled case"}
                </span>

                <span className="history-meta">
                  <i
                    className={
                      item.result.nextAction
                        ?.type === "resolved"
                        ? "resolved"
                        : ""
                    }
                  />

                  {item.result.nextAction
                    ?.type === "resolved"
                    ? "Resolved"
                    : "Open"}

                  <time>
                    {new Date(
                      item.updatedAt
                    ).toLocaleDateString()}
                  </time>
                </span>
              </button>
            ))
          )}
        </div>

        <div className="sidebar-footer">
          <strong>What Now?</strong>
          <span>Problem resolution engine</span>
          <small>
            Created by Samuel Mallo
          </small>
        </div>
      </aside>

      {/* =====================================================
          MAIN
          ===================================================== */}

      <div className="main-content">
        <header className="topbar">
          <div className="topbar-actions">
            <button
              className="icon-button"
              type="button"
              onClick={() =>
                setDark((value) => !value)
              }
              aria-label={
                dark
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              title={
                dark
                  ? "Light mode"
                  : "Dark mode"
              }
            >
              {dark ? "☀" : "◐"}
            </button>

            <button
              className="top-new-case"
              type="button"
              onClick={newCase}
            >
              New case
            </button>
          </div>
        </header>

        {/* ===================================================
            HOME
            =================================================== */}

        {stage === "home" && (
          <section className="home-landing">
            <div className="home-hero">
              <div className="home-logo">
                <img
                  src="/what-now-favicon.png"
                  alt=""
                />
              </div>

              <div className="welcome-eyebrow">
                AI PROBLEM-RESOLUTION ENGINE
              </div>

              <h1>
                Tell it what happened.
                <br />
                <span>
                  It figures out what comes next.
                </span>
              </h1>

              <p>
                What Now? turns confusing situations
                into structured investigations, useful
                next actions, and continuous
                reassessment.
              </p>

              <button
                className="primary-button home-start-button"
                type="button"
                onClick={newCase}
              >
                Start a new case
                <span>→</span>
              </button>
            </div>

            <div className="home-section">
              <div className="home-section-heading">
                <div className="eyebrow">
                  HOW IT WORKS
                </div>

                <h2>
                  From uncertainty to the next step.
                </h2>

                <p>
                  You don't need to know the right
                  terminology or formulate the perfect
                  question.
                </p>
              </div>

              <div className="home-workflow">
                <div className="home-workflow-step">
                  <span>01</span>

                  <strong>Understand</strong>

                  <p>
                    Determine what happened and
                    extract what is actually known.
                  </p>
                </div>

                <div className="home-workflow-step">
                  <span>02</span>

                  <strong>Investigate</strong>

                  <p>
                    Identify uncertainty, possible
                    explanations, and what information
                    matters.
                  </p>
                </div>

                <div className="home-workflow-step featured">
                  <span>03</span>

                  <strong>Act</strong>

                  <p>
                    Give you the most useful next
                    step instead of simply generating
                    more information.
                  </p>
                </div>

                <div className="home-workflow-step">
                  <span>04</span>

                  <strong>Reassess</strong>

                  <p>
                    Feed the result back into the
                    case and determine what should
                    happen next.
                  </p>
                </div>
              </div>
            </div>

            <div className="home-principle">
              <div>
                <div className="eyebrow">
                  THE IDEA
                </div>

                <h2>
                  The goal isn't to answer everything.
                  <br />
                  It's to figure out what matters next.
                </h2>
              </div>

              <p>
                Traditional AI interfaces often
                expect people to already understand
                their problem. What Now? starts from
                the opposite assumption: the person
                may only know that something is wrong.
                <br />
                <br />
                The system progressively turns that
                uncertainty into a structured case,
                investigates what is missing, and
                updates its recommendation as new
                evidence appears.
              </p>
            </div>

            <div className="home-creator">
              <div>
                <div className="eyebrow">
                  CREATED BY
                </div>

                <h2>Samuel Mallo</h2>

                <p>
                  AI Engineer · Developer · Security
                  Researcher
                </p>
              </div>

              <div className="creator-copy">
                <p>
                  What Now? is an independent project
                  exploring how AI can move beyond
                  simply generating answers and instead
                  participate in structured problem
                  solving.
                </p>

                <p>
                  The project is built around a simple
                  idea:
                  <strong>
                    {" "}
                    when something goes wrong, the
                    most useful question is often not
                    "what is the answer?" but "what
                    now?"
                  </strong>
                </p>
              </div>
            </div>

            <footer className="home-footer">
              <span>
                What Now? — Problem resolution engine
              </span>

              <span>
                Created by Samuel Mallo
              </span>
            </footer>
          </section>
        )}

        {/* ===================================================
            NEW CASE
            =================================================== */}

        {stage === "idle" && (
          <section className="welcome-screen">
            <div className="welcome-copy">
              <div className="welcome-eyebrow">
                NEW CASE
              </div>

              <h1>
                What happened?
                <br />
                <span>Start there.</span>
              </h1>

              <p>
                Describe the situation in your own
                words. You don't need to know what
                the problem is called or what to ask.
              </p>
            </div>

            <div className="intake-card">
              <div className="intake-topline">
                <span>
                  SITUATION
                </span>

                <span>
                  {input.length} characters
                </span>
              </div>

              <textarea
                value={input}
                onChange={(event) =>
                  setInput(event.target.value)
                }
                placeholder="Tell me what happened..."
                aria-label="Describe what happened"
              />

              {attachments.length > 0 && (
                <div className="attachment-strip">
                  {attachments.map(
                    (file, index) => (
                      <div
                        className="attachment-chip"
                        key={`${file.name}-${index}`}
                      >
                        <span>
                          {file.name}
                        </span>

                        <small>
                          {formatSize(file.size)}
                        </small>

                        <button
                          type="button"
                          onClick={() =>
                            removeFile(index)
                          }
                          aria-label={`Remove ${file.name}`}
                        >
                          ×
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}

              <div className="intake-actions">
                <label className="secondary-button">
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.txt,.doc,.docx"
                    onChange={addFiles}
                  />
                  Add evidence
                </label>

                <button
                  className="primary-button large"
                  type="button"
                  onClick={investigate}
                  disabled={!input.trim() || loading}
                >
                  Investigate
                  <span>→</span>
                </button>
              </div>

              <div className="intake-note">
                <span>●</span>

                {QUICK_TIPS.map((tip) => (
                  <span
                    key={tip}
                    style={{
                      color: "var(--text-3)",
                      fontWeight: 400,
                    }}
                  >
                    {tip}
                  </span>
                ))}
              </div>

              <div className="privacy-note">
                <span>✓</span>
                Start with whatever information
                you have. The system will identify
                what is missing.
              </div>
            </div>

            {error && (
              <div className="error-banner">
                <div>
                  <strong>
                    Investigation unavailable
                  </strong>

                  <span>{error}</span>
                </div>

                <button
                  type="button"
                  onClick={retry}
                >
                  Retry
                </button>
              </div>
            )}
          </section>
        )}

        {/* ===================================================
            INVESTIGATING
            =================================================== */}

        {stage === "investigating" && (
          <section className="processing-screen">
            <div className="processing-visual">
              <div className="processing-orbit">
                <span />
                <span />
                <span />
              </div>
            </div>

            <div className="processing-copy">
              <div className="eyebrow">
                INVESTIGATING
              </div>

              <h1>
                Figuring out
                <br />
                what happened...
              </h1>

              <p>
                What Now? is turning your description
                into a structured case and determining
                what information matters next.
              </p>

              <div className="processing-steps">
                <div className="processing-step current">
                  <div className="step-dot">
                    01
                  </div>

                  <div>
                    <strong>
                      Understanding the situation
                    </strong>

                    <small>
                      Extracting the important facts.
                    </small>
                  </div>
                </div>

                <div className="processing-step current">
                  <div className="step-dot">
                    02
                  </div>

                  <div>
                    <strong>
                      Identifying what is known
                    </strong>

                    <small>
                      Separating evidence from
                      uncertainty.
                    </small>
                  </div>
                </div>

                <div className="processing-step current">
                  <div className="step-dot">
                    03
                  </div>

                  <div>
                    <strong>
                      Determining what comes next
                    </strong>

                    <small>
                      Finding the most useful next
                      step.
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ===================================================
            REASSESSING
            =================================================== */}

        {stage === "reassessing" && (
          <section className="processing-screen">
            <div className="processing-visual">
              <div className="processing-orbit">
                <span />
                <span />
                <span />
              </div>
            </div>

            <div className="processing-copy">
              <div className="eyebrow">
                REASSESSING CASE
              </div>

              <h1>
                Figuring out
                <br />
                what changed...
              </h1>

              <p>
                The new evidence is being fed back
                into the case so the recommendation
                can be updated.
              </p>

              <div className="processing-steps">
                <div className="processing-step current">
                  <div className="step-dot">
                    01
                  </div>

                  <div>
                    <strong>
                      Analyzing what happened
                    </strong>

                    <small>
                      Comparing the new information
                      with the previous case.
                    </small>
                  </div>
                </div>

                <div className="processing-step current">
                  <div className="step-dot">
                    02
                  </div>

                  <div>
                    <strong>
                      Updating the case
                    </strong>

                    <small>
                      Revising known facts and
                      possible explanations.
                    </small>
                  </div>
                </div>

                <div className="processing-step current">
                  <div className="step-dot">
                    03
                  </div>

                  <div>
                    <strong>
                      Determining the next step
                    </strong>

                    <small>
                      Selecting what should happen
                      now.
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ===================================================
            CASE WORKSPACE
            =================================================== */}

        {(stage === "action" ||
          stage === "awaiting-result" ||
          stage === "resolved") &&
          result && (
            <section className="case-workspace">
              <div className="case-header">
                <div>
                  <div className="eyebrow">
                    CASE
                  </div>

                  <h1>
                    {result.problem}
                  </h1>

                  <p>
                    Case state: {stageLabel}
                    {" · "}
                    Confidence: {confidence}
                  </p>
                </div>

                <div className="case-status">
                  <span
                    className={`status-dot ${
                      stage === "resolved"
                        ? "resolved"
                        : ""
                    }`}
                  />

                  {stage === "resolved"
                    ? "Resolved"
                    : "Active investigation"}
                </div>
              </div>

              {/* Timeline */}

              <div className="case-progress">
                <div className="progress-step complete">
                  <span>01</span>

                  <div>
                    <strong>
                      Situation
                    </strong>

                    <small>
                      Captured
                    </small>
                  </div>
                </div>

                <div className="progress-step complete">
                  <span>02</span>

                  <div>
                    <strong>
                      Investigation
                    </strong>

                    <small>
                      Completed
                    </small>
                  </div>
                </div>

                <div
                  className={`progress-step ${
                    stage === "action" ||
                    stage === "awaiting-result" ||
                    stage === "resolved"
                      ? "current"
                      : ""
                  }`}
                >
                  <span>03</span>

                  <div>
                    <strong>
                      Next action
                    </strong>

                    <small>
                      {stage === "resolved"
                        ? "Completed"
                        : "Current"}
                    </small>
                  </div>
                </div>

                <div
                  className={`progress-step ${
                    stage === "resolved"
                      ? "current"
                      : ""
                  }`}
                >
                  <span>04</span>

                  <div>
                    <strong>
                      Result
                    </strong>

                    <small>
                      {stage === "resolved"
                        ? "Resolved"
                        : "Awaiting"}
                    </small>
                  </div>
                </div>
              </div>

              {/* Next action */}

              <div className="decision-hero">
                <div className="decision-copy">
                  <div className="eyebrow">
                    WHAT NOW?
                  </div>

                  <div className="decision-title-row">
                    <h2>
                      Your next step
                    </h2>

                    <span
                      className={`urgency ${
                        result.nextAction
                          ?.urgency || "low"
                      }`}
                    >
                      {result.nextAction
                        ?.urgency || "low"}{" "}
                      urgency
                    </span>
                  </div>

                  <h3>
                    {result.nextAction?.action}
                  </h3>

                  <p>
                    {result.nextAction?.reason}
                  </p>

                  {actionType === "action" && (
                    <button
                      className="primary-button hero-button"
                      type="button"
                      onClick={beginResult}
                      disabled={
                        stage === "resolved"
                      }
                    >
                      I've done this
                      <span>→</span>
                    </button>
                  )}

                  {actionType === "questions" && (
                    <button
                      className="primary-button hero-button"
                      type="button"
                      onClick={() =>
                        document
                          .getElementById(
                            "questions"
                          )
                          ?.scrollIntoView({
                            behavior: "smooth",
                          })
                      }
                    >
                      Answer questions
                      <span>→</span>
                    </button>
                  )}

                  {actionType ===
                    "escalation" && (
                    <button
                      className="primary-button hero-button"
                      type="button"
                      onClick={() =>
                        document
                          .getElementById(
                            "safety"
                          )
                          ?.scrollIntoView({
                            behavior: "smooth",
                          })
                      }
                    >
                      Review escalation
                      <span>→</span>
                    </button>
                  )}

                  {actionType ===
                    "monitor" && (
                    <button
                      className="secondary-button hero-button-secondary"
                      type="button"
                      onClick={beginResult}
                    >
                      Record what happens
                    </button>
                  )}

                  {actionType ===
                    "resolved" && (
                    <div className="resolved-message">
                      This case currently appears
                      resolved.
                    </div>
                  )}
                </div>

                <div
                  className="decision-symbol"
                  aria-hidden="true"
                >
                  ?
                </div>
              </div>

              {/* Result capture */}

              {stage === "awaiting-result" && (
                <div className="result-capture">
                  <div className="eyebrow">
                    RESULT
                  </div>

                  <h3>
                    What happened after you
                    tried it?
                  </h3>

                  <textarea
                    className="result-input"
                    value={outcome}
                    onChange={(event) =>
                      setOutcome(
                        event.target.value
                      )
                    }
                    placeholder="Describe what happened..."
                  />

                  <button
                    className="primary-button"
                    type="button"
                    onClick={submitOutcome}
                    disabled={
                      !outcome.trim() ||
                      loading
                    }
                  >
                    Reassess case
                    <span>→</span>
                  </button>
                </div>
              )}

              {/* Questions */}

              {result.questions.length > 0 &&
                stage !== "resolved" && (
                  <div
                    className="question-workbench"
                    id="questions"
                  >
                    <div className="question-toolbar">
                      <div>
                        <div className="eyebrow">
                          WHAT WOULD CHANGE
                          THE DECISION?
                        </div>

                        <h3>
                          Questions that matter
                        </h3>
                      </div>

                      <span className="answer-progress">
                        {
                          Object.values(
                            questionAnswers
                          ).filter(
                            (value) =>
                              value.trim()
                                .length > 0
                          ).length
                        }{" "}
                        /{" "}
                        {result.questions.length}
                        answered
                      </span>
                    </div>

                    <div className="question-list">
                      {result.questions.map(
                        (
                          question,
                          index
                        ) => (
                          <div
                            className="question-row"
                            key={`${question}-${index}`}
                          >
                            <span className="question-number">
                              {String(
                                index + 1
                              ).padStart(
                                2,
                                "0"
                              )}
                            </span>

                            <div className="question-content">
                              <span className="question-text">
                                {question}
                              </span>

                              <input
                                type="text"
                                value={
                                  questionAnswers[
                                    index
                                  ] || ""
                                }
                                onChange={(
                                  event
                                ) =>
                                  setQuestionAnswers(
                                    (
                                      current
                                    ) => ({
                                      ...current,
                                      [index]:
                                        event
                                          .target
                                          .value,
                                    })
                                  )
                                }
                                placeholder="Enter what you know..."
                              />
                            </div>
                          </div>
                        )
                      )}
                    </div>

                    <button
                      className="primary-button"
                      type="button"
                      onClick={
                        submitQuestionAnswers
                      }
                      disabled={
                        loading ||
                        !Object.values(
                          questionAnswers
                        ).some(
                          (value) =>
                            value.trim()
                        )
                      }
                    >
                      Update case
                      <span>→</span>
                    </button>
                  </div>
                )}

              {/* Situation summary */}

              <div className="input-summary">
                <div>
                  <div className="eyebrow">
                    UNDERSTANDING
                  </div>

                  <p>
                    {result.summary}
                  </p>
                </div>

                {attachments.length > 0 && (
                  <div className="input-evidence">
                    <div className="eyebrow">
                      EVIDENCE
                    </div>

                    <p>
                      {attachments.length} file
                      {attachments.length ===
                      1
                        ? ""
                        : "s"} attached
                    </p>
                  </div>
                )}
              </div>

              {/* Known / Unknown / Hypotheses */}

              <div className="three-column">
                <Section
                  label="CONFIRMED"
                  title="Known"
                  description="Facts currently supported by the evidence."
                  count={
                    result.known.length
                  }
                >
                  <ItemList
                    items={result.known}
                    empty="Nothing confirmed yet."
                  />
                </Section>

                <Section
                  label="UNCERTAINTY"
                  title="Unknown"
                  description="Information that may change the decision."
                  count={
                    result.unknown.length
                  }
                >
                  <ItemList
                    items={result.unknown}
                    empty="No major unknowns identified."
                    variant="unknown"
                  />
                </Section>

                <Section
                  label="POSSIBILITIES"
                  title="Possible explanations"
                  description="Working hypotheses, not conclusions."
                  count={
                    result.hypotheses.length
                  }
                  className="hypotheses-section"
                >
                  <HypothesisList
                    items={
                      result.hypotheses
                    }
                  />
                </Section>
              </div>

              {/* Safety */}

              <div
                className="safety-bar"
                id="safety"
              >
                <div
                  className="safety-icon"
                  aria-hidden="true"
                >
                  !
                </div>

                <div>
                  <div className="eyebrow">
                    SAFETY
                  </div>

                  <h3>
                    Things to keep in mind
                  </h3>

                  <ItemList
                    items={result.safety}
                    empty="No specific safety considerations identified."
                  />

                  {result.escalation && (
                    <div className="escalation-note">
                      <strong>
                        Escalation
                      </strong>

                      <span>
                        {result.escalation}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <footer className="case-footer">
                <span>
                  What Now? — Problem resolution
                  engine
                </span>

                <span>
                  Created by Samuel Mallo
                </span>
              </footer>
            </section>
          )}

        {/* ===================================================
            ERROR
            =================================================== */}

        {error &&
          stage !== "idle" &&
          stage !== "investigating" &&
          stage !== "reassessing" &&
          stage !== "home" && (
            <div className="error-banner">
              <div>
                <strong>
                  Something went wrong
                </strong>

                <span>{error}</span>
              </div>

              <button
                type="button"
                onClick={retry}
                disabled={loading}
              >
                Retry
              </button>
            </div>
          )}
      </div>
    </main>
  );
}