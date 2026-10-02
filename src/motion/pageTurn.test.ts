import { describe, expect, it } from 'vitest'
import { curlPolygons, dMax, decideKind, FOLD_N, turnKey } from '@/motion/pageTurn'

const base = {
  first: false,
  reduced: false,
  active: false,
  sinceLastMs: 1000,
  sameKey: false,
  navType: 'PUSH' as const,
  key: 'login',
  prevKey: 'home',
  ziTurn: false,
  mobile: false,
}

describe('page turn decisions', () => {
  it('follows the first matching rule', () => {
    expect(decideKind({ ...base, first: true })).toBe('none')
    expect(decideKind({ ...base, reduced: true })).toBe('cut')
    expect(decideKind({ ...base, sinceLastMs: 100 })).toBe('cut')
    expect(decideKind({ ...base, sameKey: true })).toBe('none')
    expect(decideKind({ ...base, navType: 'POP' })).toBe('fade')
    expect(decideKind({ ...base, key: 'admin' })).toBe('fade')
    expect(decideKind({ ...base, key: 'notfound' })).toBe('fade')
    expect(decideKind({ ...base, navType: 'REPLACE' })).toBe('cut')
    expect(decideKind({ ...base, navType: 'REPLACE', prevKey: 'admin', key: 'login' })).toBe('cut')
    expect(decideKind({ ...base, navType: 'REPLACE', ziTurn: true })).toBe('turn')
    expect(decideKind({ ...base, mobile: true })).toBe('slide')
    expect(decideKind(base)).toBe('turn')
  })

  it('groups arena and admin paths', () => {
    expect(turnKey('/arena/abc')).toBe('arena')
    expect(turnKey('/admin/audit')).toBe('admin')
    expect(turnKey('/nope')).toBe('notfound')
  })
})

describe('curl geometry', () => {
  it('keeps the whole viewport before the fold starts', () => {
    const c = dMax(1280, 720) + 2
    const { keep, flap } = curlPolygons(1280, 720, c)
    expect(keep).toHaveLength(4)
    expect(flap).toHaveLength(0)
    expect(FOLD_N.x).toBeCloseTo(0.8115, 3)
    expect(FOLD_N.y).toBeCloseTo(0.5843, 3)
  })
})
