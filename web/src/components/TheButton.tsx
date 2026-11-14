import { useState } from "react";
import type { EventStat } from "../api";
import { n, pct } from "../format";

/**
 * The hero: the game's one button. Pressing it rolls a random event, weighted by
 * how often that event has really fired, and shows how players fare against it.
 */
export function TheButton({ events }: { events: EventStat[] }) {
  const pool = events.filter((e) => e.starts > 0 && e.survivalRate !== null);
  const [rolled, setRolled] = useState<EventStat | null>(null);
  const [presses, setPresses] = useState(0);

  function press() {
    if (pool.length === 0) return;
    const total = pool.reduce((s, e) => s + e.starts, 0);
    let pick = Math.random() * total;
    let chosen = pool[0]!;
    for (const e of pool) {
      pick -= e.starts;
      if (pick <= 0) {
        chosen = e;
        break;
      }
    }
    setRolled(chosen);
    setPresses((p) => p + 1);
  }

  return (
    <div className="the-button">
      <button
        type="button"
        className="button-plinth"
        onClick={press}
        disabled={pool.length === 0}
        aria-describedby="button-result"
      >
        <span className="button-cap" />
        <span className="visually-hidden">Press the button</span>
      </button>
      <div id="button-result" className="button-result" aria-live="polite">
        {rolled ? (
          <>
            {/* key forces the reveal animation to replay on every press */}
            <p key={presses} className="rolled-name">
              {rolled.name}
            </p>
            <p className="rolled-detail">
              {rolled.survivalRate! >= 0.99
                ? "Nobody has died to this one. Yet."
                : `${pct(rolled.survivalRate! * 100, 0)} of players survive it`}
              {" "}
              <span className="quiet">
                ({n(rolled.starts)} times triggered
                {rolled.lowSample ? ", too few to be sure" : ""})
              </span>
            </p>
          </>
        ) : (
          <p className="rolled-detail quiet">
            {pool.length ? "Go on. It only rolls an event." : "No events have been triggered yet."}
          </p>
        )}
      </div>
    </div>
  );
}
