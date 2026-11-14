import { Link, useParams } from "react-router-dom";
import { type MasteryTier, type StatId, api } from "../api";
import { Avatar, Freshness, Loaded, PlayerSearch } from "../components/ui";
import { n, pct } from "../format";
import { useApi } from "../hooks";

const MEDAL: Record<MasteryTier, string> = { bronze: "🥉", silver: "🥈", gold: "🥇" };
const RANK_LABEL: Record<StatId, string> = {
  presses: "presses",
  events: "events survived",
  streak: "streak",
  ratio: "survival ratio",
};

export function Player() {
  const id = Number(useParams().userId);
  const profile = useApi((s) => api.player(id, s), [id]);

  return (
    <div className="page">
      <Loaded state={profile}>
        {(p) => {
          const ranks = (Object.entries(p.ranks) as [StatId, number | null][]).filter(([, r]) => r !== null);
          const levelPct = p.expToNext > 0 ? (p.expIntoLevel / p.expToNext) * 100 : 100;
          return (
            <>
              <header className="profile-head">
                <Avatar player={p} size={112} />
                <div>
                  <h1>{p.displayName}</h1>
                  {p.displayName !== p.username && <p className="handle">@{p.username}</p>}
                  <div className="level" aria-label={`Level ${p.level}`}>
                    <span className="level-num">Level {n(p.level)}</span>
                    <span className="level-bar" role="progressbar" aria-valuenow={Math.round(levelPct)} aria-valuemin={0} aria-valuemax={100}>
                      <span style={{ width: `${levelPct}%` }} />
                    </span>
                    {p.expToNext > 0 && (
                      <span className="quiet">
                        {n(p.expIntoLevel)} / {n(p.expToNext)} XP
                      </span>
                    )}
                  </div>
                  {ranks.length > 0 && (
                    <p className="ranks">
                      {ranks.map(([stat, r]) => (
                        <Link key={stat} to={`/leaderboards/alltime/${stat}`} className="rank-chip">
                          #{r} in {RANK_LABEL[stat]}
                        </Link>
                      ))}
                    </p>
                  )}
                </div>
              </header>

              <dl className="stat-grid">
                <Stat label="Button presses" value={n(p.stats.presses)} />
                <Stat label="Events survived" value={n(p.stats.eventsSurvived)} />
                <Stat label="Best streak" value={n(p.stats.bestStreak)} />
                <Stat
                  label="Survival ratio"
                  value={p.stats.ratio ? pct(p.stats.ratio.percent) : "–"}
                  detail={p.stats.ratio ? `${n(p.stats.ratio.survived)} of ${n(p.stats.ratio.faced)}` : "No timed events yet"}
                />
                <Stat label="Deaths" value={n(p.stats.deaths)} />
                <Stat label="Coins earned, ever" value={n(p.stats.lifetimeCoins)} />
              </dl>

              {p.thisWeek && (
                <p className="note">
                  This week: {n(p.thisWeek.presses)} presses, a best streak of {n(p.thisWeek.bestStreak)}, and{" "}
                  {n(p.thisWeek.survived)} of {n(p.thisWeek.faced)} events survived.
                </p>
              )}

              <section aria-labelledby="titles-h">
                <h2 id="titles-h">
                  Titles <span className="count">{p.titles.length}</span>
                </h2>
                <ul className="title-list">
                  {p.titles.map((t) => (
                    <li key={t.id}>
                      <span className="title-name">{t.id}</span>
                      {t.reason && <span className="quiet">{t.reason}</span>}
                      {t.rarityPercent !== null && (
                        <span className="rarity">
                          {t.rarityPercent < 1 ? "<1" : Math.round(t.rarityPercent)}% have it
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              <section aria-labelledby="mastery-h">
                <h2 id="mastery-h">
                  Event mastery{" "}
                  <span className="count">
                    {MEDAL.gold} {p.mastery.gold} {MEDAL.silver} {p.mastery.silver} {MEDAL.bronze} {p.mastery.bronze}
                  </span>
                </h2>
                <p className="note">
                  {p.mastery.discovered} events discovered. Medals come at 1, 5 and 15 completions.
                </p>
                <ul className="mastery-grid">
                  {p.mastery.events.map((e) => (
                    <li key={e.id} className={e.tier ? `tier-${e.tier}` : "tier-none"}>
                      <span className="medal" aria-label={e.tier ?? "no medal yet"}>
                        {e.tier ? MEDAL[e.tier] : "·"}
                      </span>
                      <span className="mastery-name">{e.name}</span>
                      <span className="quiet">{n(e.progress)}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <Freshness updatedAt={p.updatedAt} stale={p.stale} />
            </>
          );
        }}
      </Loaded>
      {profile.status === "error" && (
        <div className="empty-action">
          <p>Try another username.</p>
          <PlayerSearch />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
      {detail && <dd className="stat-detail">{detail}</dd>}
    </div>
  );
}
