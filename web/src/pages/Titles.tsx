import { api } from "../api";
import { Freshness, Loaded } from "../components/ui";
import { n } from "../format";
import { useApi } from "../hooks";

export function Titles() {
  const data = useApi((s) => api.titles(s), []);
  return (
    <div className="page">
      <h1>Titles</h1>
      <Loaded state={data}>
        {(d) => (
          <>
            <p className="lede">
              Rarest first. Percentages are of the {n(d.players)} players counted since title tracking began.
            </p>
            <ul className="title-list title-list-wide">
              {d.titles.map((t) => (
                <li key={t.id}>
                  <span className="title-name">{t.id}</span>
                  <span className="quiet">{t.reason ?? "How to earn this one is a secret"}</span>
                  <span className="rarity-bar" aria-hidden>
                    <span style={{ width: `${Math.max(t.percent, 1)}%` }} />
                  </span>
                  <span className="rarity">
                    {t.percent < 1 ? "<1" : t.percent.toFixed(0)}%
                    <span className="quiet"> ({n(t.holders)})</span>
                  </span>
                </li>
              ))}
            </ul>
            <Freshness updatedAt={d.updatedAt} />
          </>
        )}
      </Loaded>
    </div>
  );
}
