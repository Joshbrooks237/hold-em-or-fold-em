import type { Card } from './types'
import { RANKS } from './types'
import type { EngineState, PlayerAction } from './engine'
import { legalActions } from './engine'
import { bestHandScore } from './evaluate'

const RANK_VAL: Record<string, number> = Object.fromEntries(
  RANKS.map((r, i) => [r, i + 2]),
) as Record<string, number>

function preflopStrength(hole: [Card, Card]): number {
  const a = RANK_VAL[hole[0]!.rank]!
  const b = RANK_VAL[hole[1]!.rank]!
  const hi = Math.max(a, b)
  const lo = Math.min(a, b)
  let s = hi * 1.2 + lo * 0.15
  if (hole[0].rank === hole[1].rank) s += 18
  if (hole[0].suit === hole[1].suit) s += 3
  if (hi - lo === 1) s += 2
  return s
}

function madeHandStrength(state: EngineState, seat: number): number {
  const hole = state.players[seat]!.hole
  if (!hole || state.board.length < 3) return 0
  const score = bestHandScore(hole, state.board)
  const cat = score[0]!
  const k1 = score[1] ?? 0
  const k2 = score[2] ?? 0
  return cat * 25 + k1 + k2 * 0.02
}

export function pickBotAction(state: EngineState, seat: number): PlayerAction {
  const options = legalActions(state, seat)
  if (options.length === 0) return { kind: 'check' }
  if (options.length === 1) return options[0]!

  const hole = state.players[seat]!.hole!
  const toCall = state.highBet - state.streetCommit[seat]!
  const pot = state.pot
  const strength =
    state.board.length >= 3 ? madeHandStrength(state, seat) : preflopStrength(hole)
  const facing = toCall > 0
  const potOdds = facing ? toCall / (pot + toCall + 0.01) : 0

  const canCheck = options.some((o) => o.kind === 'check')
  const canCall = options.some((o) => o.kind === 'call')
  const raiseAct = options.find((o) => o.kind === 'raise')

  if (!facing && canCheck) {
    if (raiseAct && strength > 58 && Math.random() < 0.22) return raiseAct
    return { kind: 'check' }
  }

  if (facing) {
    if (strength < 32 && potOdds > 0.38 && Math.random() < 0.55) {
      return { kind: 'fold' }
    }
    if (strength < 24) return { kind: 'fold' }
    if (raiseAct && strength > 72 && Math.random() < 0.18) return raiseAct
    if (canCall) return { kind: 'call' }
    return { kind: 'fold' }
  }

  return options.find((o) => o.kind === 'check') ?? { kind: 'fold' }
}
