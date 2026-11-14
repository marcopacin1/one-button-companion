import { useState } from "react";
import { Link } from "react-router-dom";
import { type Scope, api } from "../api";
import { TheButton } from "../components/TheButton";
import { BillingBoard, Loaded } from "../components/ui";
import { n, pct } from "../format";
import { useApi } from "../hooks";

export function Home() {
  const overview = useApi((s) => api.overview(s), []);
  const events = useApi((s) => api.events(s), []);
  const [scope, setScope] = useState<Scope>("alltime");
  const boards = useApi((s) => topThree(scope, s), [scope]);

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <h1>Press it and find out.</h1>
          <p className="lede">
            One Button is a Roblox game with one button. Every press sets off something, from a meteor shower to a
            boss fight. This is where the lounge keeps score.
          </p>
          <Loaded state={overview}>
            {(o) => (
              <dl className="hero-facts">
                {o.totalEventsTriggered !== null && (
                  <div>
                    <dt>Events triggered</dt>
                    <dd>{n(o.totalEventsTriggered)}</dd>
                  </div>
                )}
                {o.playersCounted !== null && (
                  <div>
                    <dt>Players</dt>
                    <dd>{n(o.playersCounted)}</dd>
                  </div>
                )}
                {o.deadliestEvent?.survivalRate != null && (
                  <div>
                    <dt>Deadliest event</dt>
                    <dd className="dd-text">
                      {o.deadliestEvent.name}
                      <span className="quiet"> {pct(o.deadliestEvent.survivalRate * 100, 0)} survive</span>
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </Loaded>
        </div>
        {events.status === "ready" ? <TheButton events={events.data.events} /> : <div className="the-button" />}
      </section>

      <section className="boards-section" aria-labelledby="boards-heading">
        <div className="section-head">
          <h2 id="boards-heading">The lounge boards</h2>
          <div className="scope-toggle" role="tablist" aria-label="Board period">
            <button role="tab" aria-selected={scope === "alltime"} onClick={() => setScope("alltime")}>
              All time
            </button>
            <button role="tab" aria-selected={scope === "weekly"} onClick={() => setScope("weekly")}>
              This week
            </button>
          </div>
        </div>
        <Loaded state={boards}>
          {(list) => (
            <div className="board-grid">
              {list.map((b) => (
                <BillingBoard key={b.stat} board={b} compact />
              ))}
            </div>
          )}
        </Loaded>
        <p className="more">
          <Link to={`/leaderboards/${scope}/presses`}>See the top 50 on every board</Link>
        </p>
      </section>
    </>
  );
}

async function topThree(scope: Scope, signal: AbortSignal) {
  const stats = ["presses", "events", "streak", "ratio"] as const;
  const boards = await Promise.all(stats.map((s) => api.board(scope, s, signal)));
  return boards.map((b) => ({ ...b, rows: b.rows.slice(0, 3) }));
}
