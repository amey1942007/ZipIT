import { HashRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { AnimatedRoutes } from '@/motion/AnimatedRoutes'
import { ClickBurst } from '@/components/comic/BurstPortal'
import { HudReadout } from '@/components/comic/HudReadout'
import { AppShell } from '@/components/shell/Shell'
import { Toaster } from '@/components/ui/sonner'
import { useAuth, AuthProvider } from '@/lib/auth'
import { AdminPage } from '@/pages/AdminPage'
import { ArenaPage } from '@/pages/ArenaPage'
import { HomePage } from '@/pages/HomePage'
import { LeaderboardPage } from '@/pages/LeaderboardPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { SubmissionsPage } from '@/pages/SubmissionsPage'

function ShellLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

function RequireSession({ admin = false }: { admin?: boolean }) {
  const { configured, ready, session, isAdmin } = useAuth()
  const location = useLocation()
  if (!configured) return <Outlet />
  if (!ready) {
    return (
      <div className="grid min-h-40 place-items-center bg-ink">
        <HudReadout>LOADING…</HudReadout>
      </div>
    )
  }
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  if (admin && !isAdmin) return <Navigate to="/" replace />
  return <Outlet />
}

function RoutedApp() {
  const location = useLocation()
  return (
    <AnimatedRoutes>
      <Routes location={location}>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ShellLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route element={<RequireSession />}>
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/submissions" element={<SubmissionsPage />} />
              <Route path="/arena" element={<ArenaPage />} />
              <Route path="/arena/:submissionId" element={<ArenaPage />} />
            </Route>
            <Route element={<RequireSession admin />}>
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/:tab" element={<AdminPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
      </Routes>
    </AnimatedRoutes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
      <Toaster />
      <RoutedApp />
      <ClickBurst />
      </HashRouter>
    </AuthProvider>
  )
}
