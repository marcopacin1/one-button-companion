import { NavLink, useParams } from "react-router-dom";
import { type Scope, type StatId, api } from "../api";
import { BillingBoard, Freshness, Loaded } from "../components/ui";
import { STAT_COPY } from "../format";
import { useApi } from "../hooks";

const STATS: StatId[] = ["presses", "events", "streak", "ratio"];

export function Leaderboards() {
  const params = useParams();
  const scope: Scope = params.scope === "weekly" ? "weekly" : "alltime";
  const stat: StatId = STATS.includes(params.stat as StatId) ? (params.stat as StatId) : "presses";
  const board = useApi((s) => api.board(scope, stat, s), [scope, stat]);

  return (
    <div className="page">
      <h1>Leaderboards</h1>
      <nav className="tabs" aria-label="Period">
        <NavLink to={`/leaderboards/alltime/${stat}`}>All time</NavLink>
        <NavLink to={`/leaderboards/weekly/${stat}`}>This week</NavLink>
      </nav>
      <nav className="tabs tabs-quiet" aria-label="Stat">
        {STATS.map((s) => (
          <NavLink key={s} to={`/leaderboards/${scope}/${s}`}>
            {STAT_COPY[s].title}
          </NavLink>
        ))}
      </nav>
      {stat === "ratio" && (
        <p className="note">
          Share of timed events survived. You need {scope === "weekly" ? "8 events this week" : "25 events"} to
          qualify, and ties go to whoever has faced more.
        </p>
      )}
      <Loaded state={board}>
        {(b) => (
          <>
            <BillingBoard board={b} />
            <Freshness updatedAt={b.updatedAt} stale={b.stale} />
          </>
        )}
      </Loaded>
    </div>
  );
}
