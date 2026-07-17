import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Shell } from "./components/layout/Shell";
import { SeasonProvider } from "./context/SeasonContext";
import { Home } from "./pages/Home";
import { Standings } from "./pages/Standings";
import { Playoffs } from "./pages/Playoffs";
import { PickRace } from "./pages/PickRace";
import { Teams } from "./pages/Teams";
import { Team } from "./pages/Team";
import { History } from "./pages/History";
import { HistorySeason } from "./pages/HistorySeason";
import { HistorySeasonLayout } from "./pages/HistorySeasonLayout";

function App() {
  return (
    <BrowserRouter>
      <SeasonProvider>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<Home />} />
            <Route path="/standings" element={<Standings />} />
            <Route path="/playoffs" element={<Playoffs />} />
            <Route path="/pick-race" element={<PickRace />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/team/:rosterId" element={<Team />} />
            <Route path="/history" element={<History />} />
            <Route path="/history/:season" element={<HistorySeasonLayout />}>
              <Route index element={<HistorySeason />} />
              <Route path="standings" element={<Standings />} />
              <Route path="playoffs" element={<Playoffs />} />
              <Route path="pick-race" element={<PickRace />} />
              <Route path="teams" element={<Teams />} />
              <Route path="team/:rosterId" element={<Team />} />
            </Route>
          </Route>
        </Routes>
      </SeasonProvider>
    </BrowserRouter>
  );
}

export default App;
