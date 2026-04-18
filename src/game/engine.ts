import { draw, freshDeck, shuffle } from './deck'
import { compareScores, bestHandScore } from './evaluate'
import type { Card, GameConfig, Phase, Player, PublicGameState, Street } from './types'

export interface EngineState {
  config: GameConfig
  players: Player[]
  board: Card[]
  deck: Card[]
  pot: number
  button: number
  street: Street
  phase: Phase
  currentSeat: number | null
  highBet: number
  lastRaiseIncrement: number
  streetCommit: number[]
  handNumber: number
  message: string
  raisesThisStreet: number
  bbSeat: number
  bbActedPreflop: boolean
}

export type PlayerAction =
  | { kind: 'fold' }
  | { kind: 'check' }
  | { kind: 'call' }
  | { kind: 'raise'; totalStreetBet: number }

function seatCount(state: EngineState): number {
  return state.players.length
}

function sbSeat(state: EngineState): number {
  return (state.button + 1) % seatCount(state)
}

function computeBbSeat(state: EngineState): number {
  return (state.button + 2) % seatCount(state)
}

function copyPlayer(p: Player): Player {
  return {
    ...p,
    hole: p.hole ? [p.hole[0], p.hole[1]] : null,
  }
}

export function createEngine(config: GameConfig): EngineState {
  const n = config.playerNames.length
  const players: Player[] = config.playerNames.map((name, i) => ({
    id: `p-${i}`,
    name,
    stack: config.startingStack,
    hole: null,
    folded: false,
    allIn: false,
    betStreet: 0,
    totalHand: 0,
    isHuman: i === 0,
  }))
  return {
    config,
    players,
    board: [],
    deck: [],
    pot: 0,
    button: n - 1,
    street: 'preflop',
    phase: 'between_hands',
    currentSeat: null,
    highBet: 0,
    lastRaiseIncrement: config.bigBlind,
    streetCommit: players.map(() => 0),
    handNumber: 0,
    message: 'Welcome to the cigar room.',
    raisesThisStreet: 0,
    bbSeat: 0,
    bbActedPreflop: false,
  }
}

function postBlinds(state: EngineState): void {
  const sb = sbSeat(state)
  const bb = computeBbSeat(state)
  state.bbSeat = bb
  const sbAmt = Math.min(state.config.smallBlind, state.players[sb]!.stack)
  const bbAmt = Math.min(state.config.bigBlind, state.players[bb]!.stack)
  state.players[sb]!.stack -= sbAmt
  state.players[bb]!.stack -= bbAmt
  state.streetCommit[sb] = sbAmt
  state.streetCommit[bb] = bbAmt
  state.players[sb]!.betStreet = sbAmt
  state.players[bb]!.betStreet = bbAmt
  state.players[sb]!.totalHand += sbAmt
  state.players[bb]!.totalHand += bbAmt
  state.pot += sbAmt + bbAmt
  state.highBet = bbAmt
  state.lastRaiseIncrement = state.config.bigBlind
  if (state.players[sb]!.stack === 0) state.players[sb]!.allIn = true
  if (state.players[bb]!.stack === 0) state.players[bb]!.allIn = true
}

export function startHand(state: EngineState): EngineState {
  const n = seatCount(state)
  const next: EngineState = {
    ...state,
    players: state.players.map(copyPlayer),
    board: [],
    deck: shuffle(freshDeck()),
    pot: 0,
    button: (state.button + 1) % n,
    street: 'preflop',
    phase: 'betting',
    highBet: 0,
    lastRaiseIncrement: state.config.bigBlind,
    streetCommit: Array(n).fill(0),
    handNumber: state.handNumber + 1,
    raisesThisStreet: 0,
    bbActedPreflop: false,
    message: '',
  }
  for (let i = 0; i < n; i++) {
    const p = next.players[i]!
    p.hole = null
    p.folded = false
    p.allIn = false
    p.betStreet = 0
    p.totalHand = 0
  }
  postBlinds(next)
  for (let i = 0; i < n; i++) {
    const c1 = draw(next.deck, 1)[0]!
    const c2 = draw(next.deck, 1)[0]!
    next.players[i]!.hole = [c1, c2]
  }
  next.bbSeat = computeBbSeat(next)
  next.currentSeat = firstToActPreflop(next)
  next.message = `Hand ${next.handNumber} — blinds posted.`
  return next
}

function firstToActPreflop(state: EngineState): number {
  const n = seatCount(state)
  const bb = state.bbSeat
  return (bb + 1) % n
}

function bettingOrderStart(state: EngineState): number {
  if (state.street === 'preflop') return firstToActPreflop(state)
  return firstToActPostflop(state)
}

function nextSeat(state: EngineState, from: number): number {
  return (from + 1) % seatCount(state)
}

/** Seats that still owe chips to match highBet */
function pendingSeats(state: EngineState): number[] {
  const n = seatCount(state)
  const start = bettingOrderStart(state)
  const out: number[] = []
  for (let k = 0; k < n; k++) {
    const s = (start + k) % n
    const p = state.players[s]!
    if (p.folded || p.allIn) continue
    if (state.streetCommit[s]! < state.highBet) out.push(s)
  }
  return out
}

function bbPreflopOptionPending(state: EngineState): boolean {
  if (state.street !== 'preflop' || state.raisesThisStreet > 0) return false
  const bb = state.bbSeat
  const p = state.players[bb]!
  if (p.folded || p.allIn || state.bbActedPreflop) return false
  return state.streetCommit[bb]! >= state.highBet
}

function advanceStreet(state: EngineState): void {
  const n = seatCount(state)
  for (let i = 0; i < n; i++) {
    state.players[i]!.betStreet = 0
  }
  state.streetCommit = Array(n).fill(0)
  state.highBet = 0
  state.lastRaiseIncrement = state.config.bigBlind
  state.raisesThisStreet = 0

  if (state.street === 'preflop') {
    state.street = 'flop'
    draw(state.deck, 1)
    state.board.push(...draw(state.deck, 3))
    state.message = 'The flop.'
  } else if (state.street === 'flop') {
    state.street = 'turn'
    draw(state.deck, 1)
    state.board.push(draw(state.deck, 1)[0]!)
    state.message = 'The turn.'
  } else if (state.street === 'turn') {
    state.street = 'river'
    draw(state.deck, 1)
    state.board.push(draw(state.deck, 1)[0]!)
    state.message = 'The river.'
  } else {
    state.phase = 'showdown'
    state.currentSeat = null
    state.message = 'Showdown.'
    resolveShowdown(state)
    return
  }

  state.phase = 'betting'
  state.currentSeat = firstToActPostflop(state)
  state.message += ` ${state.players[state.currentSeat!]!.name} opens.`
}

function firstToActPostflop(state: EngineState): number {
  const n = seatCount(state)
  const start = sbSeat(state)
  for (let k = 0; k < n; k++) {
    const s = (start + k) % n
    const p = state.players[s]!
    if (!p.folded && !p.allIn) return s
  }
  return sbSeat(state)
}

function activeNonFolded(state: EngineState): number[] {
  return state.players.map((p, i) => (p.folded ? -1 : i)).filter((i) => i >= 0)
}

function awardPotToSingle(winner: number, state: EngineState): void {
  state.players[winner]!.stack += state.pot
  state.message = `${state.players[winner]!.name} takes the pot.`
  state.pot = 0
  state.phase = 'showdown'
  state.currentSeat = null
}

function resolveFoldWin(state: EngineState): void {
  const alive = activeNonFolded(state)
  if (alive.length === 1) {
    awardPotToSingle(alive[0]!, state)
  }
}

function resolveShowdown(state: EngineState): void {
  const alive = activeNonFolded(state)
  if (alive.length === 0) {
    state.phase = 'between_hands'
    return
  }
  if (alive.length === 1) {
    awardPotToSingle(alive[0]!, state)
    return
  }
  const board = state.board
  let bestSeat = alive[0]!
  let best = bestHandScore(state.players[bestSeat]!.hole!, board)
  const winners: number[] = [bestSeat]
  for (let i = 1; i < alive.length; i++) {
    const s = alive[i]!
    const sc = bestHandScore(state.players[s]!.hole!, board)
    const cmp = compareScores(sc, best)
    if (cmp > 0) {
      best = sc
      winners.length = 0
      winners.push(s)
    } else if (cmp === 0) {
      winners.push(s)
    }
  }
  const share = Math.floor(state.pot / winners.length)
  const remainder = state.pot - share * winners.length
  for (const s of winners) {
    state.players[s]!.stack += share
  }
  if (remainder > 0 && winners[0] !== undefined) {
    state.players[winners[0]!]!.stack += remainder
  }
  const names = winners.map((s) => state.players[s]!.name).join(' & ')
  const potTotal = state.pot
  state.message =
    winners.length > 1
      ? `Showdown — ${names} split the ${potTotal}-chip pot.`
      : `Showdown — ${names} wins the ${potTotal}-chip pot.`
  state.pot = 0
  state.phase = 'showdown'
  state.currentSeat = null
}

export function dismissShowdown(state: EngineState): EngineState {
  if (state.phase !== 'showdown') return state
  return { ...state, phase: 'between_hands' }
}

function tryCloseBettingRound(state: EngineState): void {
  const pend = pendingSeats(state)
  if (pend.length > 0) {
    state.currentSeat = pend[0]!
    return
  }
  if (bbPreflopOptionPending(state)) {
    state.currentSeat = state.bbSeat
    return
  }

  const alive = activeNonFolded(state)
  if (alive.length < 2) {
    resolveFoldWin(state)
    return
  }

  advanceStreet(state)
}

function moveToNextAfter(state: EngineState, seat: number): void {
  const n = seatCount(state)
  let s = seat
  for (let k = 0; k < n; k++) {
    s = nextSeat(state, s)
    const p = state.players[s]!
    if (p.folded || p.allIn) continue
    if (state.streetCommit[s]! < state.highBet) {
      state.currentSeat = s
      return
    }
  }
  tryCloseBettingRound(state)
}

export function applyPlayerAction(
  state: EngineState,
  seat: number,
  action: PlayerAction,
): EngineState {
  const next: EngineState = {
    ...state,
    players: state.players.map(copyPlayer),
    streetCommit: [...state.streetCommit],
  }
  if (next.phase !== 'betting' || next.currentSeat !== seat) return state

  const p = next.players[seat]!
  if (p.folded || p.allIn) return state

  const toCall = next.highBet - next.streetCommit[seat]!

  if (action.kind === 'fold') {
    p.folded = true
    next.message = `${p.name} folds.`
    moveToNextAfter(next, seat)
    resolveFoldWin(next)
    return next
  }

  if (action.kind === 'check') {
    if (toCall > 0) return state
    if (next.street === 'preflop' && seat === next.bbSeat && next.raisesThisStreet === 0) {
      next.bbActedPreflop = true
    }
    next.message = `${p.name} checks.`
    moveToNextAfter(next, seat)
    resolveFoldWin(next)
    return next
  }

  if (action.kind === 'call') {
    const pay = Math.min(toCall, p.stack)
    p.stack -= pay
    next.streetCommit[seat] = next.streetCommit[seat]! + pay
    p.betStreet += pay
    p.totalHand += pay
    next.pot += pay
    if (p.stack === 0) p.allIn = true
    if (next.street === 'preflop' && seat === next.bbSeat) next.bbActedPreflop = true
    next.message = pay < toCall ? `${p.name} calls all-in.` : `${p.name} calls.`
    moveToNextAfter(next, seat)
    resolveFoldWin(next)
    return next
  }

  if (action.kind === 'raise') {
    const target = action.totalStreetBet
    if (target <= next.highBet) return state
    const add = target - next.streetCommit[seat]!
    const minTotal = next.highBet + next.lastRaiseIncrement
    if (target < minTotal && add < p.stack) return state
    const pay = Math.min(add, p.stack)
    const actualNewCommit = next.streetCommit[seat]! + pay
    p.stack -= pay
    next.streetCommit[seat] = actualNewCommit
    p.betStreet += pay
    p.totalHand += pay
    next.pot += pay
    const increment = actualNewCommit - next.highBet
    next.highBet = actualNewCommit
    next.lastRaiseIncrement = Math.max(next.lastRaiseIncrement, increment)
    next.raisesThisStreet += 1
    if (p.stack === 0) p.allIn = true
    if (next.street === 'preflop' && seat === next.bbSeat) next.bbActedPreflop = true
    next.message = `${p.name} raises to ${actualNewCommit}.`
    moveToNextAfter(next, seat)
    resolveFoldWin(next)
    return next
  }

  return state
}

export function legalActions(state: EngineState, seat: number): PlayerAction[] {
  if (state.phase !== 'betting' || state.currentSeat !== seat) return []
  const p = state.players[seat]!
  if (p.folded || p.allIn) return []
  const toCall = state.highBet - state.streetCommit[seat]!
  const out: PlayerAction[] = [{ kind: 'fold' }]
  if (toCall === 0) {
    out.push({ kind: 'check' })
  }
  if (toCall > 0 && p.stack > 0) {
    out.push({ kind: 'call' })
  }
  if (p.stack > 0) {
    const minRaiseTotal = state.highBet + state.lastRaiseIncrement
    const maxTotal = state.streetCommit[seat]! + p.stack
    if (maxTotal > state.highBet) {
      const target = Math.max(minRaiseTotal, state.streetCommit[seat]! + p.stack)
      if (target > state.highBet) {
        out.push({ kind: 'raise', totalStreetBet: target })
      }
    }
  }
  return out
}

export function toPublicState(state: EngineState, revealAll: boolean): PublicGameState {
  const showHoles = revealAll || state.phase === 'showdown'
  return {
    players: state.players.map((pl) => {
      const base = copyPlayer(pl)
      if (showHoles || pl.isHuman) return base
      return { ...base, hole: null }
    }),
    board: [...state.board],
    pot: state.pot,
    sidePots: [],
    button: state.button,
    street: state.street,
    phase: state.phase,
    currentSeat: state.currentSeat,
    minRaise: state.lastRaiseIncrement,
    currentBet: state.highBet,
    lastAggressor: null,
    handNumber: state.handNumber,
    message: state.message,
  }
}
