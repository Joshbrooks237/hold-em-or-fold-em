export const SUITS = ['♠', '♥', '♦', '♣'] as const
export type Suit = (typeof SUITS)[number]

export const RANKS = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'T',
  'J',
  'Q',
  'K',
  'A',
] as const
export type Rank = (typeof RANKS)[number]

export interface Card {
  rank: Rank
  suit: Suit
}

export interface Player {
  id: string
  name: string
  stack: number
  hole: [Card, Card] | null
  folded: boolean
  allIn: boolean
  betStreet: number
  totalHand: number
  isHuman: boolean
}

export type Street = 'preflop' | 'flop' | 'turn' | 'river'
export type Phase = 'betting' | 'showdown' | 'between_hands'

export interface GameConfig {
  smallBlind: number
  bigBlind: number
  startingStack: number
  playerNames: string[]
}

export interface PublicGameState {
  players: Player[]
  board: Card[]
  pot: number
  sidePots: number[]
  button: number
  street: Street
  phase: Phase
  currentSeat: number | null
  minRaise: number
  currentBet: number
  lastAggressor: number | null
  handNumber: number
  message: string
}

/** Comparable hand score: higher wins */
export type HandScore = readonly [category: number, ...kickers: number[]]
