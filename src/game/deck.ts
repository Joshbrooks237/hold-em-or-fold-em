import type { Card } from './types'
import { RANKS, SUITS } from './types'

export function freshDeck(): Card[] {
  const d: Card[] = []
  for (const s of SUITS) {
    for (const r of RANKS) {
      d.push({ rank: r, suit: s })
    }
  }
  return d
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

export function draw(deck: Card[], n: number): Card[] {
  return deck.splice(0, n)
}
