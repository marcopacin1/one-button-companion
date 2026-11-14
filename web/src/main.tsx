import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, NavLink, Route, Routes } from "react-router-dom";
import { api } from "./api";
import { PlayerSearch } from "./components/ui";
import { useApi } from "./hooks";
import { Events } from "./pages/Events";
import { Home } from "./pages/Home";
import { Leaderboards } from "./pages/Leaderboards";
import { Player } from "./pages/Player";
import { Titles } from "./pages/Titles";
import "@fontsource/big-shoulders-display/600";
import "@fontsource/big-shoulders-display/800";
import "@fontsource/big-shoulders-display/900";
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "./styles.css";

function Layout() {
  const health = useApi((s) => api.health(s), []);
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="site-head">
        <Link to="/" className="wordmark" aria-label="One Button Lounge, home">
          <span className="wordmark-dot" aria-hidden />
          One Button
        </Link>
        <nav aria-label="Main">
          <NavLink to="/leaderboards/alltime/presses">Leaderboards</NavLink>
          <NavLink to="/events">Events</NavLink>
          <NavLink to="/titles">Titles</NavLink>
        </nav>
        <PlayerSearch />
      </header>
      {health.status === "ready" && health.data.mode === "mock" && (
        <p className="demo-banner">Demo data: these players are invented. Connect an API key to show the real game.</p>
      )}
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/leaderboards/:scope/:stat" element={<Leaderboards />} />
          <Route path="/player/:userId" element={<Player />} />
          <Route path="/events" element={<Events />} />
          <Route path="/titles" element={<Titles />} />
          <Route
            path="*"
            element={
              <div className="page">
                <h1>Nothing here</h1>
                <p>
                  That page doesn't exist. <Link to="/">Go to the lounge</Link>.
                </p>
              </div>
            }
          />
        </Routes>
      </main>
      <footer className="site-foot">
        <p>
          Stats are read from One Button's live data and refresh about once a minute.{" "}
          <a href="https://www.roblox.com/games/121388633171828" rel="noopener">
            Play One Button on Roblox
          </a>
          .
        </p>
      </footer>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  </StrictMode>,
);
