import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Link, MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import { AnimatedRoutes } from '@/motion/AnimatedRoutes'
import { transitionBus } from '@/motion/pageTurn'

function stuckExitLayers(): HTMLElement[] {
  return [...document.querySelectorAll('div')].filter((el) => el.hasAttribute('inert') || el.style.position === 'fixed')
}

function Pages() {
  const location = useLocation()
  return (
    <AnimatedRoutes>
      <Routes location={location}>
        <Route path="/arena" element={<Navigate to="/login?next=%2Farena" replace />} />
        <Route path="/submissions" element={<Navigate to="/login?next=%2Fsubmissions" replace />} />
        <Route path="/profile" element={<Navigate to="/login?next=%2Fprofile" replace />} />
        <Route path="/admin" element={<Navigate to="/login?next=%2Fadmin" replace />} />
        <Route
          path="/login"
          element={
            <main className="zi-login-main">
              <h1>Login</h1>
            </main>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <main>
              <h1>Leaderboard</h1>
              <Link to="/">Home</Link>
            </main>
          }
        />
        <Route
          path="/"
          element={
            <main id="main">
              <h1>Home</h1>
              <Link to="/leaderboard">Leaderboard</Link>
            </main>
          }
        />
      </Routes>
    </AnimatedRoutes>
  )
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Pages />
    </MemoryRouter>,
  )
}

describe('page turn redirects', () => {
  const originalAnimate = HTMLElement.prototype.animate

  beforeEach(() => {
    transitionBus.navId = ''
    transitionBus.turnKey = ''
    transitionBus.kind = 'none'
    transitionBus.lastStart = Number.NEGATIVE_INFINITY
    transitionBus.active = null
    HTMLElement.prototype.animate = () =>
      ({
        onfinish: null,
        oncancel: null,
        cancel() {},
        finish() {},
        play() {},
        pause() {},
        persist() {},
      }) as unknown as Animation
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
    HTMLElement.prototype.animate = originalAnimate
  })

  it.each(['/arena', '/submissions', '/profile', '/admin'])(
    'drops the exit layer after a logged-out redirect from %s',
    (path) => {
      renderAt(path)
      expect(screen.getByRole('heading', { name: 'Login' })).toBeVisible()
      expect(document.querySelector('.zi-login-main')).toBeVisible()
      expect(stuckExitLayers()).toHaveLength(0)
    },
  )

  it('plays a page turn on a link click and clears the outgoing layer', () => {
    vi.useFakeTimers()
    renderAt('/')
    fireEvent.click(screen.getByRole('link', { name: 'Leaderboard' }))
    const layer = stuckExitLayers()[0]
    expect(layer).toBeTruthy()
    expect(layer?.style.pointerEvents).toBe('none')
    act(() => {
      vi.advanceTimersByTime(900)
    })
    expect(stuckExitLayers()).toHaveLength(0)
    expect(screen.getByRole('heading', { name: 'Leaderboard' })).toBeVisible()
  })

  it('unmounts a turn whose animation callback never fires', () => {
    vi.useFakeTimers()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1)
    renderAt('/')
    fireEvent.click(screen.getByRole('link', { name: 'Leaderboard' }))
    expect(stuckExitLayers()).toHaveLength(1)
    act(() => {
      vi.advanceTimersByTime(899)
    })
    expect(stuckExitLayers()).toHaveLength(1)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(stuckExitLayers()).toHaveLength(0)
    expect(screen.getByRole('heading', { name: 'Leaderboard' })).toBeVisible()
  })

  it('skips the turn under reduced motion', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('prefers-reduced-motion'),
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as MediaQueryList,
    )
    renderAt('/')
    fireEvent.click(screen.getByRole('link', { name: 'Leaderboard' }))
    expect(stuckExitLayers()).toHaveLength(0)
    expect(screen.getByRole('heading', { name: 'Leaderboard' })).toBeVisible()
  })
})
