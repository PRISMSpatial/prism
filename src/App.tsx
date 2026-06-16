import { lazy, Suspense, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from './store'
import { useAuthStore } from './store/auth'
import { Rail } from './components/Rail'
import { Topbar } from './components/Topbar'
import { Statusbar } from './components/Statusbar'
import { CommandPalette } from './components/CommandPalette'
import { TweaksPanel } from './components/TweaksPanel'
import { LoginPage } from './components/LoginPage'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { moduleVariants } from './motion'

const CompassView  = lazy(() => import('./modules/compass/CompassView'))
const TraceView    = lazy(() => import('./modules/trace/TraceView'))
const StreamView   = lazy(() => import('./modules/stream/StreamView'))
const VisorView    = lazy(() => import('./modules/visor/VisorView'))
const ForecastView = lazy(() => import('./modules/forecast/ForecastView'))
const VirsiftView  = lazy(() => import('./modules/virsift/VirsiftView'))
const ReportView   = lazy(() => import('./modules/report/ReportView'))

function ModuleFallback() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
      <span className="mute mono caps">Loading…</span>
    </div>
  )
}

function ActiveModule({ module }: { module: string }) {
  return (
    <Suspense fallback={<ModuleFallback />}>
      {module === 'compass'   && <CompassView />}
      {module === 'signals'   && <TraceView />}
      {module === 'phylogeny' && <StreamView />}
      {module === 'molecule'  && <VisorView />}
      {module === 'forecast'  && <ForecastView />}
      {module === 'sources'   && <VirsiftView />}
      {module === 'report'    && <ReportView />}
    </Suspense>
  )
}

export default function App() {
  const { module } = useAppStore()
  const { user, loading, hydrate } = useAuthStore()
  useKeyboardShortcuts()

  useEffect(() => { hydrate() }, [hydrate])

  if (loading) {
    return (
      <div className="app" style={{ display: 'grid', placeItems: 'center' }}>
        <span className="mute mono caps">Initialising…</span>
      </div>
    )
  }

  if (!user) return <LoginPage />

  return (
    <div className="app">
      <Topbar />
      <Rail />

      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={module}
          className="view"
          role="main"
          variants={moduleVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <ActiveModule module={module} />
        </motion.main>
      </AnimatePresence>

      <Statusbar />
      <CommandPalette />
      <TweaksPanel />
    </div>
  )
}
