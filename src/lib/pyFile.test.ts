import { describe, expect, it } from 'vitest'
import { validateAvatar } from '@/lib/image'
import { validatePy } from '@/lib/pyFile'

const text = (source: string) => new TextEncoder().encode(source)

describe('validatePy', () => {
  it('accepts a small utf-8 heuristic and warns when next_move is missing', () => {
    const ok = validatePy({
      name: 'heuristic.py',
      type: 'text/x-python',
      bytes: text('def next_move(grid, path, cost_map):\n    return path[-1]\n'),
    })
    expect(ok.ok).toBe(true)
    expect(ok.warnings).toEqual([])

    const warn = validatePy({
      name: 'note.py',
      type: '',
      bytes: text('# just a comment\n'),
    })
    expect(warn.ok).toBe(true)
    expect(warn.warnings).toEqual(['no def next_move'])
  })

  it('rejects the wrong extension, a disguised image, and files over 256 KB', () => {
    expect(validatePy({ name: 'Heuristic.PY', type: 'text/plain', bytes: text('x') }).errors).toContain(
      'extension',
    )
    expect(validatePy({ name: 'notes.md', type: 'text/markdown', bytes: text('# hi') }).ok).toBe(false)
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(validatePy({ name: 'fake.py', type: 'text/plain', bytes: png }).errors).toContain('content')
    const big = new Uint8Array(262_145)
    big.fill(97)
    expect(validatePy({ name: 'big.py', type: 'text/plain', bytes: big }).errors).toContain('size')
  })
})

describe('validateAvatar', () => {
  it('accepts png, jpeg, and webp under 2 MB', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00])
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00])
    const webp = new Uint8Array(12)
    webp.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
    expect(validateAvatar({ name: 'a.png', type: 'image/png', bytes: png }).ok).toBe(true)
    expect(validateAvatar({ name: 'a.jpg', type: 'image/jpeg', bytes: jpeg }).ok).toBe(true)
    expect(validateAvatar({ name: 'a.webp', type: 'image/webp', bytes: webp }).ok).toBe(true)
  })

  it('rejects other types and files over 2 MB', () => {
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
    expect(validateAvatar({ name: 'a.gif', type: 'image/gif', bytes: gif }).ok).toBe(false)
    const png = new Uint8Array(2_097_153)
    png.set([0x89, 0x50, 0x4e, 0x47])
    expect(validateAvatar({ name: 'big.png', type: 'image/png', bytes: png }).errors).toContain('size')
  })
})
