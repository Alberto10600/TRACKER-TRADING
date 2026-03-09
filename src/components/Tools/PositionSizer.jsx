import React, { useState, useEffect } from 'react'

// ============================================================
// POSITION SIZER - Professional trading position size calculator
// Supports: Forex, Commodities (Gold/Silver/Oil), Indices, Crypto
// ============================================================

const INSTRUMENT_PRESETS = [
  { label: 'Forex (majors)', value: 'forex', pipSize: 0.0001, pipValuePerLot: 10, contractSize: 100000 },
  { label: 'Forex JPY (USDJPY, etc.)', value: 'forex_jpy', pipSize: 0.01, pipValuePerLot: 1000, contractSize: 100000 },
  { label: 'XAUUSD (Gold)', value: 'gold', pipSize: 0.01, pipValuePerLot: 100, contractSize: 100 },
  { label: 'XAGUSD (Silver)', value: 'silver', pipSize: 0.001, pipValuePerLot: 50, contractSize: 5000 },
  { label: 'USOIL / UKOIL (Petróleo)', value: 'oil', pipSize: 0.01, pipValuePerLot: 100, contractSize: 100 },
  { label: 'US100 (NASDAQ)', value: 'us100', pipSize: 1, pipValuePerLot: 1, contractSize: 1 },
  { label: 'US500 (S&P 500)', value: 'us500', pipSize: 0.1, pipValuePerLot: 10, contractSize: 1 },
  { label: 'US30 (Dow Jones)', value: 'us30', pipSize: 1, pipValuePerLot: 1, contractSize: 1 },
  { label: 'DE40 (DAX)', value: 'de40', pipSize: 1, pipValuePerLot: 1, contractSize: 1 },
  { label: 'UK100 (FTSE)', value: 'uk100', pipSize: 1, pipValuePerLot: 1, contractSize: 1 },
  { label: 'BTCUSD (Bitcoin)', value: 'btc', pipSize: 1, pipValuePerLot: 1, contractSize: 1 },
  { label: 'Personalizado', value: 'custom', pipSize: 0.0001, pipValuePerLot: 10, contractSize: 100000 },
]

function fmt(n, decimals = 2) {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return n.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export default function PositionSizer({ account }) {
  const [balance, setBalance] = useState(account?.initial_balance || 10000)
  const [riskPct, setRiskPct] = useState(account?.risk_per_trade || 1.0)
  const [entryPrice, setEntryPrice] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [instrument, setInstrument] = useState('forex')
  const [customPipSize, setCustomPipSize] = useState(0.0001)
  const [customPipValue, setCustomPipValue] = useState(10)
  const [direction, setDirection] = useState('BUY')
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])

  // Load account balance on mount / account change
  useEffect(() => {
    if (account?.initial_balance) setBalance(account.initial_balance)
    if (account?.risk_per_trade) setRiskPct(account.risk_per_trade)
  }, [account])

  function calculate() {
    const entry = parseFloat(entryPrice)
    const sl = parseFloat(stopLoss)
    if (!entry || !sl || isNaN(entry) || isNaN(sl)) return

    const preset = INSTRUMENT_PRESETS.find(p => p.value === instrument) || INSTRUMENT_PRESETS[0]
    const pipSize = instrument === 'custom' ? parseFloat(customPipSize) : preset.pipSize
    const pipValuePerLot = instrument === 'custom' ? parseFloat(customPipValue) : preset.pipValuePerLot

    // Validate direction alignment
    const slPips = Math.abs(entry - sl) / pipSize
    if (slPips <= 0) {
      setResult({ error: 'El Stop Loss debe ser diferente al precio de entrada.' })
      return
    }

    // BUY: SL should be below entry. SELL: SL above entry.
    if (direction === 'BUY' && sl >= entry) {
      setResult({ error: 'Para una operación LONG, el Stop Loss debe estar POR DEBAJO del precio de entrada.' })
      return
    }
    if (direction === 'SELL' && sl <= entry) {
      setResult({ error: 'Para una operación SHORT, el Stop Loss debe estar POR ENCIMA del precio de entrada.' })
      return
    }

    const riskAmount = (balance * riskPct) / 100
    const lotSize = riskAmount / (slPips * pipValuePerLot)

    // Round to standard lot increments
    const lotRounded = Math.floor(lotSize * 100) / 100 // floor to 0.01 lots

    const actualRisk = lotRounded * slPips * pipValuePerLot
    const actualRiskPct = balance > 0 ? (actualRisk / balance) * 100 : 0

    // Suggest scaling levels
    const conservativeLot = Math.floor(lotSize * 0.5 * 100) / 100
    const aggressiveLot = Math.floor(lotSize * 1.5 * 100) / 100

    const calc = {
      lots: lotRounded,
      conservativeLots: conservativeLot,
      aggressiveLots: aggressiveLot,
      riskAmount,
      actualRisk,
      actualRiskPct,
      slPips: Math.round(slPips * 10) / 10,
      pipValuePerLot,
      pipSize,
      balance,
      riskPct,
      entry,
      sl,
      instrument,
      direction,
      ts: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    }

    setResult(calc)
    setHistory(prev => [calc, ...prev].slice(0, 5))
  }

  const preset = INSTRUMENT_PRESETS.find(p => p.value === instrument)

  return (
    <div className="flex-1 overflow-y-auto p-6 fade-in">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Calculadora de Position Sizing</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            Calcula el tamaño óptimo de tu posición basado en tu riesgo máximo por operación
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-2 space-y-4">
            {/* Account & Risk */}
            <div className="card space-y-4">
              <h2 className="text-text-primary font-semibold border-b border-border pb-2">Parámetros de Riesgo</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-text-muted text-xs block mb-1.5">Balance de Cuenta</label>
                  <div className="relative">
                    <input
                      type="number" step="100" min="0"
                      className="input w-full font-num pr-12"
                      value={balance}
                      onChange={e => setBalance(parseFloat(e.target.value) || 0)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">
                      {account?.currency || 'EUR'}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-text-muted text-xs block mb-1.5">
                    Riesgo por Operación (%)
                    <span className="ml-2 text-accent-blue">= {fmt((balance * riskPct) / 100)} {account?.currency || 'EUR'}</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number" step="0.1" min="0.1" max="10"
                      className="input w-full font-num pr-8"
                      value={riskPct}
                      onChange={e => setRiskPct(parseFloat(e.target.value) || 1)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">%</span>
                  </div>
                  {/* Quick risk buttons */}
                  <div className="flex gap-1 mt-1.5">
                    {[0.5, 1, 1.5, 2, 3].map(r => (
                      <button key={r} onClick={() => setRiskPct(r)}
                        className={`text-xs px-2 py-0.5 rounded transition-all ${
                          riskPct === r
                            ? 'bg-accent-blue text-white'
                            : 'bg-bg-tertiary text-text-muted hover:text-text-primary border border-border'
                        }`}>
                        {r}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Instrument & Trade */}
            <div className="card space-y-4">
              <h2 className="text-text-primary font-semibold border-b border-border pb-2">Datos de la Operación</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-text-muted text-xs block mb-1.5">Instrumento</label>
                  <select className="input w-full" value={instrument} onChange={e => setInstrument(e.target.value)}>
                    {INSTRUMENT_PRESETS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  {preset && instrument !== 'custom' && (
                    <p className="text-text-muted text-xs mt-1">
                      Pip: {preset.pipSize} · Valor/lote: ${preset.pipValuePerLot}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-text-muted text-xs block mb-1.5">Dirección</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDirection('BUY')}
                      className={`flex-1 py-2 rounded-lg font-medium text-sm transition-all border ${
                        direction === 'BUY'
                          ? 'bg-profit/20 border-profit/50 text-profit'
                          : 'border-border text-text-muted hover:border-profit/30'
                      }`}
                    >
                      BUY (Long)
                    </button>
                    <button
                      onClick={() => setDirection('SELL')}
                      className={`flex-1 py-2 rounded-lg font-medium text-sm transition-all border ${
                        direction === 'SELL'
                          ? 'bg-loss/20 border-loss/50 text-loss'
                          : 'border-border text-text-muted hover:border-loss/30'
                      }`}
                    >
                      SELL (Short)
                    </button>
                  </div>
                </div>
              </div>

              {instrument === 'custom' && (
                <div className="grid grid-cols-2 gap-4 p-3 bg-bg-tertiary rounded-lg border border-border">
                  <div>
                    <label className="text-text-muted text-xs block mb-1">Tamaño de 1 pip</label>
                    <input type="number" step="any" className="input w-full font-num text-sm"
                      value={customPipSize} onChange={e => setCustomPipSize(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-text-muted text-xs block mb-1">Valor pip por lote ($)</label>
                    <input type="number" step="any" className="input w-full font-num text-sm"
                      value={customPipValue} onChange={e => setCustomPipValue(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-text-muted text-xs block mb-1.5">Precio de Entrada</label>
                  <input
                    type="number" step="any" placeholder={instrument === 'gold' ? '2350.00' : '1.08500'}
                    className="input w-full font-num"
                    value={entryPrice}
                    onChange={e => setEntryPrice(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && calculate()}
                  />
                </div>
                <div>
                  <label className="text-text-muted text-xs block mb-1.5">
                    Stop Loss
                    {entryPrice && stopLoss && !isNaN(parseFloat(entryPrice)) && !isNaN(parseFloat(stopLoss)) && (
                      <span className="ml-2 text-text-muted">
                        ({fmt(Math.abs(parseFloat(entryPrice) - parseFloat(stopLoss)) / (instrument !== 'custom' ? (INSTRUMENT_PRESETS.find(p => p.value === instrument)?.pipSize || 0.0001) : parseFloat(customPipSize) || 0.0001), 1)} pips)
                      </span>
                    )}
                  </label>
                  <input
                    type="number" step="any" placeholder={instrument === 'gold' ? '2340.00' : '1.08000'}
                    className="input w-full font-num"
                    value={stopLoss}
                    onChange={e => setStopLoss(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && calculate()}
                  />
                </div>
              </div>

              <button onClick={calculate} className="btn-primary w-full py-3 text-base font-semibold">
                Calcular Tamaño de Posición
              </button>
            </div>
          </div>

          {/* Result Panel */}
          <div className="space-y-4">
            {result && (
              <div className={`card space-y-4 ${result.error ? 'border-loss/30' : 'border-accent-blue/30'}`}>
                {result.error ? (
                  <div>
                    <h3 className="text-loss font-semibold mb-2">Error de Cálculo</h3>
                    <p className="text-text-secondary text-sm">{result.error}</p>
                  </div>
                ) : (
                  <>
                    <div className="text-center pb-2 border-b border-border">
                      <p className="text-text-muted text-xs uppercase tracking-wider mb-1">Tamaño Recomendado</p>
                      <p className="text-4xl font-bold font-num text-accent-blue">{fmt(result.lots, 2)}</p>
                      <p className="text-text-secondary text-sm">lotes</p>
                    </div>

                    <div className="space-y-2.5">
                      <ResultRow label="Riesgo en dinero" value={`${fmt(result.actualRisk)} ${account?.currency || 'EUR'}`} highlight />
                      <ResultRow label="Riesgo efectivo %" value={`${fmt(result.actualRiskPct)}%`} />
                      <ResultRow label="Pips de riesgo (SL)" value={`${fmt(result.slPips, 1)} pips`} />
                      <ResultRow label="Valor pip/lote" value={`$${fmt(result.pipValuePerLot)}`} />
                    </div>

                    <div className="pt-2 border-t border-border space-y-2">
                      <p className="text-text-muted text-xs uppercase tracking-wider">Alternativas</p>
                      <div className="flex gap-2">
                        <div className="flex-1 text-center p-2 bg-bg-tertiary rounded-lg border border-border">
                          <p className="text-text-muted text-xs">Conservador</p>
                          <p className="text-profit font-num font-bold">{fmt(result.conservativeLots, 2)}</p>
                          <p className="text-text-muted text-xs">lotes (50%)</p>
                        </div>
                        <div className="flex-1 text-center p-2 bg-bg-tertiary rounded-lg border border-accent-blue/30">
                          <p className="text-accent-blue text-xs">Recomendado</p>
                          <p className="text-accent-blue font-num font-bold">{fmt(result.lots, 2)}</p>
                          <p className="text-accent-blue text-xs">lotes (100%)</p>
                        </div>
                        <div className="flex-1 text-center p-2 bg-bg-tertiary rounded-lg border border-border">
                          <p className="text-text-muted text-xs">Agresivo</p>
                          <p className="text-loss font-num font-bold">{fmt(result.aggressiveLots, 2)}</p>
                          <p className="text-text-muted text-xs">lotes (150%)</p>
                        </div>
                      </div>
                    </div>

                    <RiskWarning riskPct={result.actualRiskPct} />
                  </>
                )}
              </div>
            )}

            {/* How it works */}
            {!result && (
              <div className="card space-y-3 border-border/50">
                <h3 className="text-text-primary font-semibold text-sm">Cómo funciona</h3>
                <div className="space-y-2 text-xs text-text-secondary">
                  <p className="flex gap-2"><span className="text-accent-blue font-bold">1.</span> Define tu balance y % de riesgo máximo</p>
                  <p className="flex gap-2"><span className="text-accent-blue font-bold">2.</span> Introduce precio de entrada y stop loss</p>
                  <p className="flex gap-2"><span className="text-accent-blue font-bold">3.</span> La calculadora determina los lotes óptimos</p>
                  <div className="mt-3 p-3 bg-bg-tertiary rounded-lg border border-border">
                    <p className="text-text-muted font-medium mb-1">Fórmula:</p>
                    <p className="font-mono text-xs text-accent-blue">Lotes = Riesgo$ / (Pips SL × Valor pip)</p>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs">
                  <p className="text-text-muted font-medium">Valores pip por lote estándar:</p>
                  <p className="text-text-secondary">Forex majors: $10/pip · Gold: $100/pip</p>
                  <p className="text-text-secondary">US100: $1/punto · US500: $10/punto</p>
                </div>
              </div>
            )}

            {/* History */}
            {history.length > 1 && (
              <div className="card space-y-2">
                <h3 className="text-text-muted text-xs uppercase tracking-wider">Historial de cálculos</h3>
                {history.slice(1).map((h, i) => (
                  h.lots && (
                    <div key={i} className="flex justify-between items-center text-xs py-1.5 border-b border-border last:border-0">
                      <span className="text-text-secondary">{h.ts} · {INSTRUMENT_PRESETS.find(p => p.value === h.instrument)?.label?.split(' ')[0]}</span>
                      <span className="font-num text-accent-blue font-semibold">{fmt(h.lots, 2)} lotes</span>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Risk education */}
        <div className="card">
          <h2 className="text-text-primary font-semibold mb-4">Guia de Position Sizing por Instrumento</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <InstrumentInfo
              title="Forex (EUR/USD)"
              pip="0.0001"
              pipValue="$10/lote"
              example="1% riesgo, 50 pips SL, $10K balance = 0.20 lotes"
            />
            <InstrumentInfo
              title="Gold (XAUUSD)"
              pip="$0.01"
              pipValue="$100/lote"
              example="1% riesgo, 10$ SL, $10K balance = 0.10 lotes (1000 pips)"
            />
            <InstrumentInfo
              title="US100 (NASDAQ)"
              pip="1 punto"
              pipValue="$1/lote"
              example="1% riesgo, 100 pts SL, $10K balance = 1.00 lote"
            />
            <InstrumentInfo
              title="BTCUSD"
              pip="1 punto"
              pipValue="$1/lote"
              example="1% riesgo, $1000 SL, $10K balance = 0.10 lotes"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function ResultRow({ label, value, highlight = false }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className={`font-num font-semibold ${highlight ? 'text-accent-blue' : 'text-text-primary'}`}>{value}</span>
    </div>
  )
}

function RiskWarning({ riskPct }) {
  if (riskPct <= 1) {
    return (
      <div className="p-2.5 bg-profit/10 border border-profit/30 rounded-lg">
        <p className="text-profit text-xs font-medium">Riesgo conservador ({riskPct.toFixed(2)}%) - Gestion correcta</p>
      </div>
    )
  }
  if (riskPct <= 2) {
    return (
      <div className="p-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <p className="text-yellow-400 text-xs font-medium">Riesgo moderado ({riskPct.toFixed(2)}%) - Aceptable</p>
      </div>
    )
  }
  return (
    <div className="p-2.5 bg-loss/10 border border-loss/30 rounded-lg">
      <p className="text-loss text-xs font-medium">Riesgo alto ({riskPct.toFixed(2)}%) - Considera reducir el tamaño</p>
    </div>
  )
}

function InstrumentInfo({ title, pip, pipValue, example }) {
  return (
    <div className="p-3 bg-bg-tertiary rounded-lg border border-border">
      <p className="text-text-primary font-semibold text-sm mb-2">{title}</p>
      <p className="text-text-muted text-xs">Pip: <span className="text-text-secondary">{pip}</span></p>
      <p className="text-text-muted text-xs">Valor: <span className="text-text-secondary">{pipValue}</span></p>
      <p className="text-text-muted text-xs mt-2 leading-relaxed">{example}</p>
    </div>
  )
}
