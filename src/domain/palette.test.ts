import { describe, expect, it } from 'vitest'
import { contrastRatio } from './color'
import { BASE, DEFAULT_SPLITS, TOKENS } from './palette'

describe('palette contrast', () => {
  it('meets 4.5:1 for body text on every surface', () => {
    const light = TOKENS.light
    const dark = TOKENS.dark
    expect(contrastRatio(light.ink, light.bg)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(light.inkMuted, light.bg)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(light.alertInk, light.bg)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(light.ink, light.surface)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(dark.ink, dark.bg)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(dark.inkMuted, dark.bg)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(dark.alertInk, dark.bg)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(dark.ink, dark.surface)).toBeGreaterThanOrEqual(4.5)
  })

  it('meets 3:1 for alert edges and non-text markers on light surfaces', () => {
    expect(contrastRatio(TOKENS.light.alertEdge, TOKENS.light.bg)).toBeGreaterThanOrEqual(3)
    for (const s of DEFAULT_SPLITS) {
      // Caramel and gold markers are drawn with an ink ring for the 3:1 boundary.
      if (s.color === BASE.gold || s.color === BASE.caramel) continue
      expect(contrastRatio(s.color, TOKENS.light.bg), s.name).toBeGreaterThanOrEqual(3)
    }
  })

  it('never puts cream text on gold', () => {
    expect(contrastRatio(BASE.cream, BASE.gold)).toBeLessThan(4.5)
    // Gold surfaces use plum text instead.
    expect(contrastRatio(BASE.plum, BASE.gold)).toBeGreaterThanOrEqual(4.5)
  })

  it('gives every default split a distinct color', () => {
    const colors = new Set(DEFAULT_SPLITS.map((s) => s.color))
    expect(colors.size).toBe(DEFAULT_SPLITS.length)
  })
})
