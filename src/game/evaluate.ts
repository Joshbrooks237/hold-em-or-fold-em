import type { Card, HandScore } from './types'
import { RANKS } from './types'

const RANK_VAL: Record<string, number> = Object.fromEntries(
  RANKS.map((r, i) => [r, i + 2]),
) as Record<string, number>

function cardValue(c: Card): number {
  return RANK_VAL[c.rank]!
}

function evaluateFive(cards: Card[]): HandScore {
  const vals = cards.map(cardValue).sort((a, b) => b - a)
  const suits = cards.map((c) => c.suit)
  const isFlush = suits.every((s) => s === suits[0])

  const counts = new Map<number, number>()
  for (const v of vals) {
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])

  const uniqueSorted = [...new Set(vals)].sort((a, b) => a - b)
  let straightHigh = 0
  const isWheel =
    uniqueSorted.length >= 5 &&
    uniqueSorted.includes(2) &&
    uniqueSorted.includes(3) &&
    uniqueSorted.includes(4) &&
    uniqueSorted.includes(5) &&
    uniqueSorted.includes(14)
  if (isWheel) straightHigh = 5
  else {
    for (let i = 0; i <= uniqueSorted.length - 5; i++) {
      const slice = uniqueSorted.slice(i, i + 5)
      if (slice[4]! - slice[0]! === 4) straightHigh = slice[4]!
    }
  }

  if (isFlush && straightHigh) {
    return [8, straightHigh] as const
  }

  if (groups[0]![1] === 4) {
    const quad = groups[0]![0]
    const kicker = groups.find((g) => g[0] !== quad)![0]
    return [7, quad, kicker] as const
  }

  if (groups[0]![1] === 3 && groups[1]![1] === 2) {
    return [6, groups[0]![0], groups[1]![0]] as const
  }

  if (isFlush) {
    return [5, ...vals] as const
  }

  if (straightHigh) {
    return [4, straightHigh] as const
  }

  if (groups[0]![1] === 3) {
    const t = groups[0]![0]
    const kickers = vals.filter((v) => v !== t)
    return [3, t, ...kickers.slice(0, 2)] as const
  }

  if (groups[0]![1] === 2 && groups[1]![1] === 2) {
    const p1 = groups[0]![0]
    const p2 = groups[1]![0]
    const hi = Math.max(p1, p2)
    const lo = Math.min(p1, p2)
    const kicker = vals.find((v) => v !== p1 && v !== p2)!
    return [2, hi, lo, kicker] as const
  }

  if (groups[0]![1] === 2) {
    const p = groups[0]![0]
    const kickers = vals.filter((v) => v !== p)
    return [1, p, ...kickers.slice(0, 3)] as const
  }

  return [0, ...vals] as const
}

function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (items.length < k) return []
  const [first, ...rest] = items
  const withFirst = combinations(rest, k - 1).map((c) => [first!, ...c])
  const withoutFirst = combinations(rest, k)
  return [...withFirst, ...withoutFirst]
}

export function bestHandScore(hole: [Card, Card], board: Card[]): HandScore {
  const all = [...hole, ...board]
  if (all.length < 5) {
    throw new Error('Need at least 5 cards')
  }
  let best: HandScore | null = null
  for (const five of combinations(all, 5)) {
    const s = evaluateFive(five)
    if (!best || compareScores(s, best) > 0) best = s
  }
  return best!
}

export function compareScores(a: HandScore, b: HandScore): number {
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0
    const bv = b[i] ?? 0
    if (av !== bv) return av - bv
  }
  return 0
}

export function scoreToLabel(score: HandScore): string {
  const cat = score[0]
  const names = [
    'High card',
    'Pair',
    'Two pair',
    'Three of a kind',
    'Straight',
    'Flush',
    'Full house',
    'Four of a kind',
    'Straight flush',
  ]
  return names[cat] ?? 'Unknown'
}
