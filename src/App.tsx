import { HashRouter, Route, Routes } from 'react-router'
import { AdminPage } from '@/pages/AdminPage'
import { ArenaPage } from '@/pages/ArenaPage'
import { HomePage } from '@/pages/HomePage'
import { LeaderboardPage } from '@/pages/LeaderboardPage'
import { LoginPage } from '@/pages/LoginPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { SubmissionsPage } from '@/pages/SubmissionsPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/submissions" element={<SubmissionsPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/arena" element={<ArenaPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </HashRouter>
  )
}
