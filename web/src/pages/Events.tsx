import { useMemo, useState } from "react";
import { type EventStat, api } from "../api";
import { Freshness, Loaded } from "../components/ui";
import { n, pct } from "../format";
import { useApi } from "../hooks";

type SortKey = "starts" | "survival" | "name";

export function Events() {
  const data = useApi((s) => api.events(s), []);
  const [sort, setSort] = useState<SortKey>("starts");
  const [category, setCategory] = useState("all");

  return (
    <div className="page">
      <h1>Events</h1>
      <p className="lede">
        Every event the button has rolled, across every server, and how many players lived through it.
      </p>
      <Loaded state={data}>
        {(d) => (
          <EventTable events={d.events} sort={sort} setSort={setSort} category={category} setCategory={setCategory}>
            <Freshness updatedAt={d.updatedAt} stale={d.stale} />
          </EventTable>
        )}
      </Loaded>
    </div>
  );
}

function EventTable(props: {
  events: EventStat[];
  sort: SortKey;
  setSort: (s: SortKey) => void;
  category: string;
  setCategory: (c: string) => void;
  children: React.ReactNode;
}) {
  const { events, sort, setSort, category, setCategory } = props;
  const categories = useMemo(
    () => [...new Set(events.map((e) => e.category).filter((c): c is string => !!c))].sort(),
    [events],
  );
  const rows = useMemo(() => {
    const list = events.filter((e) => category === "all" || e.category === category);
    const by: Record<SortKey, (a: EventStat, b: EventStat) => number> = {
      starts: (a, b) => b.starts - a.starts,
      // Deadliest first; events with no data sink to the bottom.
      survival: (a, b) => (a.survivalRate ?? 2) - (b.survivalRate ?? 2),
      name: (a, b) => a.name.replace(/^\P{L}+/u, "").localeCompare(b.name.replace(/^\P{L}+/u, "")),
    };
    return [...list].sort(by[sort]);
  }, [events, sort, category]);

  return (
    <>
      <div className="controls">
        <label>
          Sort by{" "}
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="starts">Most triggered</option>
            <option value="survival">Deadliest</option>
            <option value="name">Name</option>
          </select>
        </label>
        <label>
          Category{" "}
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="table-wrap">
        <table className="event-table">
          <thead>
            <tr>
              <th scope="col">Event</th>
              <th scope="col" className="num">Triggered</th>
              <th scope="col">Players who survive</th>
              <th scope="col" className="num">Avg. time to die</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <th scope="row">
                  {e.name}
                  {e.category && <span className="quiet cat">{e.category}</span>}
                </th>
                <td className="num">{n(e.starts)}</td>
                <td>
                  {e.survivalRate === null ? (
                    <span className="quiet">No players yet</span>
                  ) : (
                    <span className={`survival${e.lowSample ? " low" : ""}`}>
                      <span className="survival-bar" aria-hidden>
                        <span style={{ width: `${e.survivalRate * 100}%` }} />
                      </span>
                      {pct(e.survivalRate * 100, 0)}
                      {e.lowSample && <span className="quiet"> (few players)</span>}
                    </span>
                  )}
                </td>
                <td className="num">{e.avgSecondsToDeath === null ? "–" : `${e.avgSecondsToDeath.toFixed(0)} s`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {props.children}
    </>
  );
}
