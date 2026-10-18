import { mix } from './color'

/** Base palette supplied by the brief. Everything else is derived from these. */
export const BASE = {
  gold: '#E3D26F',
  caramel: '#CA895F',
  terracotta: '#A15E49',
  brown: '#4E3822',
  plum: '#2F1B25',
  cream: '#F6EFD9',
} as const

/** Derived tokens. Contrast is asserted in src/domain/palette.test.ts. */
export const TOKENS = {
  light: {
    bg: BASE.cream,
    surface: mix(BASE.cream, '#FFFFFF', 0.45),
    ink: BASE.plum,
    inkMuted: '#675249',
    alertInk: '#8A4330',
    alertEdge: BASE.terracotta,
    rule: mix(BASE.cream, BASE.plum, 0.18),
  },
  dark: {
    bg: BASE.plum,
    surface: mix(BASE.plum, BASE.cream, 0.07),
    ink: BASE.cream,
    inkMuted: '#C9BFA8',
    alertInk: '#D9826A',
    alertEdge: BASE.terracotta,
    rule: mix(BASE.plum, BASE.cream, 0.2),
  },
} as const

export type DefaultSplitSeed = { name: string; color: string }

/** Default splits. Each has a distinct color from the palette or a derived tint. */
export const DEFAULT_SPLITS: DefaultSplitSeed[] = [
  { name: 'Homework', color: BASE.caramel },
  { name: 'Tests', color: BASE.terracotta },
  { name: 'Projects', color: BASE.gold },
  { name: 'Tournaments', color: BASE.brown },
  { name: 'Club', color: '#7D5B6E' },
]

/** Split colors that a user can pick from when recoloring. */
export const SPLIT_SWATCHES = [
  BASE.caramel,
  BASE.terracotta,
  BASE.gold,
  BASE.brown,
  '#7D5B6E',
  mix(BASE.caramel, BASE.cream, 0.4),
  mix(BASE.terracotta, BASE.cream, 0.35),
  mix(BASE.plum, BASE.cream, 0.45),
]
