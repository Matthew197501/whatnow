import type { ReactNode } from "react";

type Hypothesis = { explanation: string; confidence: number; evidence: string };
type NextAction = { action: string; reason: string; urgency: "low" | "medium" | "high" };

export function Section({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <section className={`case-section ${className}`}><div className="section-label">{label}</div>{children}</section>;
}

export function ItemList({ items, empty = "Nothing has been established yet." }: { items: string[]; empty?: string }) {
  if (!items.length) return <div className="section-empty">{empty}</div>;
  return <ul className="item-list">{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>;
}

export function NextActionBlock({ nextAction }: { nextAction: NextAction }) {
  return <div className="next-action">
    <div className="next-action-main">
      <span className="action-kicker">Recommended next step</span>
      <strong>{nextAction.action}</strong>
      <p>{nextAction.reason}</p>
    </div>
    <span className={`urgency urgency-${nextAction.urgency}`}>{nextAction.urgency} priority</span>
  </div>;
}

export function HypothesisList({ items }: { items: Hypothesis[] }) {
  if (!items.length) return <div className="section-empty">No working explanations yet. More evidence may be needed.</div>;
  return <div className="hypotheses">{items.map((item, index) => {
    const confidence = Number.isFinite(item.confidence) ? Math.round(item.confidence * 100) : 0;
    return <article className="hypothesis" key={`${item.explanation}-${index}`}>
      <div className="hypothesis-heading"><strong>{item.explanation}</strong><span>{confidence}% confidence</span></div>
      <p>{item.evidence}</p>
    </article>;
  })}</div>;
}
