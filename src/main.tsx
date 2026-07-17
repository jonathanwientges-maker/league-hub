import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { GatePage } from './gate/GatePage.tsx'
import { RELEASE_DATE_UTC } from './config/release.ts'

const queryClient = new QueryClient()

// A one-time check at load, not reactive state: the gate's own countdown
// handles the within-session T-0 transition, and "Enter the league" reloads
// the page — which re-runs this same check against the real clock and
// naturally renders the real app once RELEASE_DATE_UTC has passed. No
// separate deploy step needed on launch day.
const isPreRelease = Date.now() < Date.parse(RELEASE_DATE_UTC)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {isPreRelease ? <GatePage /> : <App />}
    </QueryClientProvider>
  </StrictMode>,
)
