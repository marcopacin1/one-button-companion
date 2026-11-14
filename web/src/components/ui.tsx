import { type FormEvent, type ReactNode, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { type Board, type PlayerRef, api } from "../api";
import type { Load } from "../hooks";
import { STAT_COPY, agoText, n, statValue, untilText } from "../format";

export function Avatar({ player, size = 40 }: { player: PlayerRef; size?: number }) {
  if (player.avatarUrl) {
    return <img className="avatar" src={player.avatarUrl} alt="" width={size} height={size} loading="lazy" />;
  }
  // No headshot (invented mock players, or Roblox's thumbnail service was slow): an initial.
  return (
    <span className="avatar avatar-initial" style={{ width: size, height: size, fontSize: size * 0.45 }} aria-hidden>
      {player.displayName.slice(0, 1)}
    </span>
  );
}

export function PlayerLink({ player }: { player: PlayerRef }) {
  return (
    <Link className="player-link" to={`/player/${player.userId}`}>
      <Avatar player={player} size={32} />
      <span className="player-name">
        {player.displayName}
        {player.displayName !== player.username && <span className="handle">@{player.username}</span>}
      </span>
    </Link>
  );
}

/** One framed board, styled after the billing boards in the lounge. */
export function BillingBoard({ board, compact = false }: { board: Board; compact?: boolean }) {
  const copy = STAT_COPY[board.stat];
  return (
    <section className={`board board-${board.scope}`} aria-labelledby={`b-${board.scope}-${board.stat}`}>
      <div className="board-frame">
        <h3 id={`b-${board.scope}-${board.stat}`}>{copy.title}</h3>
        {board.rows.length === 0 ? (
          <p className="board-empty">
            {board.scope === "weekly"
              ? "Nobody's on this one yet this week. Press the button."
              : "Nobody has qualified yet."}
          </p>
        ) : (
          <ol className="board-rows">
            {board.rows.map((r) => (
              <li key={r.userId} className={r.rank === 1 ? "top" : undefined}>
                <span className="rank">{r.rank}</span>
                <PlayerLink player={r} />
                <span className="value">
                  {statValue(board.stat, r.value)}
                  {r.sample !== undefined && <span className="sample">of {n(r.sample)}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
        {!compact && board.resetsAt && <p className="board-foot">Resets {untilText(board.resetsAt)}</p>}
      </div>
    </section>
  );
}

export function Loaded<T>({ state, children }: { state: Load<T>; children: (data: T) => ReactNode }) {
  if (state.status === "loading") return <p className="status">Loading…</p>;
  if (state.status === "error") return <p className="status status-error">{state.error.message}</p>;
  return <>{children(state.data)}</>;
}

export function Freshness({ updatedAt, stale }: { updatedAt: string; stale?: boolean }) {
  return (
    <p className="freshness">
      {stale ? "Roblox isn't answering, so this is the last data we got, from " : "Updated "}
      {agoText(updatedAt)}.
    </p>
  );
}

export function PlayerSearch({ autoFocus = false }: { autoFocus?: boolean }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const username = name.trim();
    if (!username) return;
    setBusy(true);
    setError(null);
    try {
      const p = await api.search(username);
      setName("");
      navigate(`/player/${p.userId}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="search" onSubmit={submit} role="search">
      <label htmlFor="player-search" className="visually-hidden">
        Roblox username
      </label>
      <input
        id="player-search"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Find a player by username"
        autoComplete="off"
        spellCheck={false}
        autoFocus={autoFocus}
        aria-describedby={error ? "search-error" : undefined}
      />
      <button type="submit" disabled={busy}>
        {busy ? "Finding…" : "Find"}
      </button>
      {error && (
        <p id="search-error" className="search-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
