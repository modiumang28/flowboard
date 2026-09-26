import type { AccentColor, Priority } from '../types'

/*
  Tailwind scans source statically, so class names cannot be built at runtime
  (`text-accent-${color}` would never be generated). These maps hold the full
  class strings instead.

  Priority and status share the same five accents deliberately — one palette,
  so an urgent task and an "Open" status read as the same red everywhere.
*/

export const ACCENT_TEXT: Record<AccentColor, string> = {
  red: 'text-accent-red',
  amber: 'text-accent-amber',
  blue: 'text-accent-blue',
  green: 'text-accent-green',
  slate: 'text-accent-slate',
}

/** 10% tint of the accent, for badge and avatar backgrounds. */
export const ACCENT_TINT: Record<AccentColor, string> = {
  red: 'bg-accent-red/10',
  amber: 'bg-accent-amber/10',
  blue: 'bg-accent-blue/10',
  green: 'bg-accent-green/10',
  slate: 'bg-accent-slate/10',
}

/** Solid fill, for the status dot on a column header. */
export const ACCENT_FILL: Record<AccentColor, string> = {
  red: 'bg-accent-red',
  amber: 'bg-accent-amber',
  blue: 'bg-accent-blue',
  green: 'bg-accent-green',
  slate: 'bg-accent-slate',
}

export const PRIORITY_ACCENT: Record<Priority, AccentColor> = {
  urgent: 'red',
  high: 'amber',
  normal: 'blue',
  low: 'slate',
  none: 'slate',
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: 'Urgent',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
  none: 'None',
}
