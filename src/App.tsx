import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CenteredTableSvg } from './CenteredTableSvg'
import { pickBotAction } from './game/ai'
import {
  applyPlayerAction,
  createEngine,
  dismissShowdown,
  legalActions,
  startHand,
  toPublicState,
  type EngineState,
  type PlayerAction,
} from './game/engine'
import { scoreToLabel, bestHandScore } from './game/evaluate'
import type { Card, GameConfig, Player } from './game/types'
import {
  computeSeatPositions,
  computeTableGeometry,
  type TableGeometry,
} from './tableLayout'

const CONFIG: GameConfig = {
  smallBlind: 10,
  bigBlind: 20,
  startingStack: 2000,
  playerNames: ['You', 'Victor', 'Silas', 'Donovan', 'Marco', 'Enzo'],
}

function suitColor(suit: Card['suit']): string {
  return suit === '♥' || suit === '♦' ? 'var(--ruby)' : '#1a1a1a'
}

function CardFace({ card, variant }: { card: Card; variant: 'board' | 'seat' }) {
  return (
    <div
      className={`card-face card-face--${variant}`}
      style={{ color: suitColor(card.suit) }}
    >
      <span>{card.rank}</span>
      <span className="card-suit">{card.suit}</span>
    </div>
  )
}

function CardBack({ variant }: { variant: 'board' | 'seat' }) {
  return (
    <div className={`card-back card-back--${variant}`}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '42%',
          height: '16%',
          background:
            'linear-gradient(90deg, #8b1e1e 0%, #c9a227 35%, #f3e9d7 50%, #c9a227 65%, #8b1e1e 100%)',
          opacity: 0.9,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 6,
          borderRadius: 4,
          border: '1px dashed rgba(201, 162, 39, 0.25)',
        }}
      />
    </div>
  )
}

function Seat({
  player,
  isButton,
  isTurn,
  x,
  y,
}: {
  player: Player
  isButton: boolean
  isTurn: boolean
  x: number
  y: number
}) {
  const hole = player.hole

  return (
    <div
      className="seat"
      style={{
        left: x,
        top: y,
        zIndex: isTurn ? 2 : 1,
      }}
    >
      <div className="seat-cards">
        {hole
          ? hole.map((c, i) => <CardFace key={i} card={c} variant="seat" />)
          : [0, 1].map((i) => <CardBack key={i} variant="seat" />)}
      </div>
      <div className={`seat-plaque${isTurn ? ' is-turn' : ''}`}>
        <div className="seat-name">{player.name}</div>
        <div className="seat-stack">
          {player.folded ? 'Folded' : `${player.stack} chips`}
        </div>
        {isButton && <div className="seat-dealer">DEALER</div>}
      </div>
    </div>
  )
}

export default function App() {
  const [engine, setEngine] = useState<EngineState>(() => createEngine(CONFIG))
  const stageRef = useRef<HTMLDivElement>(null)
  const [geom, setGeom] = useState<TableGeometry | null>(null)
  const feltGradId = useId().replace(/:/g, '')

  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      const w = r.width
      const h = r.height
      if (w < 24 || h < 24) return
      setGeom(computeTableGeometry(w, h))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const seatPositions = useMemo(() => (geom ? computeSeatPositions(geom) : []), [geom])

  const publicState = useMemo(() => toPublicState(engine, false), [engine])

  const humanHole = engine.players[0]!.hole
  const boardLen = engine.board.length
  const heroLabel = useMemo(() => {
    if (!humanHole || boardLen < 3) return null
    try {
      const s = bestHandScore(humanHole, engine.board)
      return scoreToLabel(s)
    } catch {
      return null
    }
  }, [humanHole, boardLen, engine.board])

  const dispatch = useCallback((seat: number, action: PlayerAction) => {
    setEngine((prev) => applyPlayerAction(prev, seat, action))
  }, [])

  useEffect(() => {
    if (engine.phase !== 'betting' || engine.currentSeat === null) return
    const seat = engine.currentSeat
    const p = engine.players[seat]!
    if (p.isHuman) return
    const t = window.setTimeout(() => {
      const act = pickBotAction(engine, seat)
      setEngine((prev) => applyPlayerAction(prev, seat, act))
    }, 520 + Math.random() * 380)
    return () => clearTimeout(t)
  }, [engine])

  useEffect(() => {
    if (engine.phase !== 'showdown') return
    const t = window.setTimeout(() => {
      setEngine((prev) => dismissShowdown(prev))
    }, 2800)
    return () => clearTimeout(t)
  }, [engine.phase, engine.handNumber])

  const humanSeat = 0
  const legal = legalActions(engine, humanSeat)
  const toCall = engine.highBet - engine.streetCommit[humanSeat]!
  const canStart =
    engine.phase === 'between_hands' &&
    engine.players.some((p) => p.stack > 0)

  const raiseAction = legal.find((a) => a.kind === 'raise')

  return (
    <div className="app-shell">
      <div className="smoke-bg" aria-hidden />
      <main className="app-main">
        <header className="app-header">
          <h1 className="brand brand-title">Cigar Room</h1>
          <p className="brand-sub">TEXAS HOLD&apos;EM</p>
        </header>

        <div className="table-stage" ref={stageRef}>
          {geom ? <CenteredTableSvg geom={geom} gradientId={`felt-${feltGradId}`} /> : null}
          <div className="center-board">
            <div className="pot-label">POT</div>
            <div className="pot-value">{publicState.pot}</div>
            <div className="board-row">
              {publicState.board.length === 0 ? (
                <span style={{ opacity: 0.35, fontSize: '0.8rem' }}>Shuffle & deal</span>
              ) : (
                publicState.board.map((c, i) => <CardFace key={i} card={c} variant="board" />)
              )}
            </div>
          </div>

          {CONFIG.playerNames.map((_, i) => {
            const pos = seatPositions[i]
            if (!pos) return null
            return (
              <Seat
                key={i}
                player={publicState.players[i]!}
                isButton={publicState.button === i}
                isTurn={publicState.currentSeat === i}
                x={pos.x}
                y={pos.y}
              />
            )
          })}
        </div>
      </main>

      <div className="hud-panel">
        <div className="hud-message">
          {publicState.message || `Street: ${publicState.street}`}
        </div>
        {heroLabel && <div className="hero-hand">Your hand — {heroLabel}</div>}

        {engine.phase === 'between_hands' && (
          <button
            type="button"
            className="btn btn--primary btn--full"
            onClick={() => setEngine((e) => startHand(e))}
            disabled={!canStart}
          >
            Next hand
          </button>
        )}

        {engine.phase === 'betting' && engine.currentSeat === humanSeat && (
          <div className="action-row">
            {legal.some((a) => a.kind === 'fold') && (
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => dispatch(humanSeat, { kind: 'fold' })}
              >
                Fold
              </button>
            )}
            {legal.some((a) => a.kind === 'check') && (
              <button
                type="button"
                className="btn"
                onClick={() => dispatch(humanSeat, { kind: 'check' })}
              >
                Check
              </button>
            )}
            {legal.some((a) => a.kind === 'call') && (
              <button type="button" className="btn" onClick={() => dispatch(humanSeat, { kind: 'call' })}>
                Call {toCall > 0 ? `(${toCall})` : ''}
              </button>
            )}
            {raiseAction && (
              <button
                type="button"
                className="btn btn--gold btn--full"
                onClick={() => dispatch(humanSeat, raiseAction)}
              >
                Raise to {raiseAction.totalStreetBet}
              </button>
            )}
          </div>
        )}

        {engine.phase === 'showdown' && (
          <p style={{ fontSize: '0.85rem', opacity: 0.8, margin: 0 }}>
            Cards on the table — next hand in a moment.
          </p>
        )}
      </div>
    </div>
  )
}
