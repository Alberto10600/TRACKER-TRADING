import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts'
import { calcMetrics, buildEquityCurve, buildDailyPnl, formatCurrency, pnlClass } from '../../utils/tradeMetrics'

const PERIODS = [
  { label: 'Hoy', value: 'today' },
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: '3M', value: '3m' },
  { label: 'Este Año', value: 'year' },
  { label: 'Todo', value: 'all' },
]

function getPeriodDates(period) {
  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
  if (period === 'today') return { dateFrom: fmt(now), dateTo: fmt(now) }
  if (period === '7d') { const d = new Date(now); d.setDate(d.getDate()-7); return { dateFrom: fmt(d) } }
  if (period === '30d') { const d = new Date(now); d.setDate(d.getDate()-30); return { dateFrom: fmt(d) } }
  if (period === '3m') { const d = new Date(now); d.setMonth(d.getMonth()-3); return { dateFrom: fmt(d) } }
  if (period === 'year') return { dateFrom: `${now.getFullYear()}-01-01` }
  return {}
}

export default function Dashboard({ account }) {
  const [period, setPeriod] = useState('30d')
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [period])

  async function loadData() {
    setLoading(true)
    const filters = getPeriodDates(period)
    const all = await window.api.trades.getAll(filters)
    setTrades(all)
    setLoading(false)
  }

  const metrics = calcMetrics(trades)
  const equityCurve = buildEquityCurve(trades, account?.initial_balance || 10000)
  const dailyPnl = buildDailyPnl(trades)
  const currency = account?.currency || 'EUR'

  const recentTrades = [...trades]
    .filter(t => t.status === 'closed')
    .sort((a, b) => new Date(b.close_time) - new Date(a.close_time))
    .slice(0, 8)

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {account?.account_name} · {account?.broker}
          </p>
        </div>
        {/* Period selector */}
        <div className="flex gap-1 bg-bg-secondary border border-border rounded-lg p-1">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                period === p.value
                  ? 'bg-accent-blue text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI Cards Row 1 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              label="P&L Total"
              value={formatCurrency(metrics.totalPnl, currency)}
              sub={`${metrics.totalTrades} operaciones`}
              positive={metrics.totalPnl >= 0}
              icon="💰"
            />
            <KPICard
              label="Win Rate"
              value={`${metrics.winRate.toFixed(1)}%`}
              sub={`${metrics.winningTrades}W / ${metrics.losingTrades}L`}
              positive={metrics.winRate >= 50}
              icon="🎯"
            />
            <KPICard
              label="Profit Factor"
              value={metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)}
              sub="Bruto / Pérdidas"
              positive={metrics.profitFactor >= 1.5}
              icon="⚡"
            />
            <KPICard
              label="Expectativa"
              value={formatCurrency(metrics.expectancy, currency)}
              sub="Por operación"
              positive={metrics.expectancy >= 0}
              icon="📊"
            />
          </div>

          {/* KPI Cards Row 2 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              label="Mejor Trade"
              value={formatCurrency(metrics.bestTrade, currency)}
              sub="Operación ganadora"
              positive={true}
              icon="🚀"
            />
            <KPICard
              label="Peor Trade"
              value={formatCurrency(metrics.worstTrade, currency)}
              sub="Operación perdedora"
              positive={false}
              icon="💔"
            />
            <KPICard
              label="Avg R:R"
              value={metrics.avgRR > 0 ? `1:${metrics.avgRR.toFixed(2)}` : '—'}
              sub="Riesgo / Beneficio medio"
              positive={metrics.avgRR >= 1.5}
              icon="⚖️"
            />
            <KPICard
              label="Max Drawdown"
              value={formatCurrency(metrics.maxDrawdown, currency)}
              sub="Caída máxima"
              positive={false}
              icon="📉"
            />
          </div>

          {/* Equity Curve */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-text-primary font-semibold">Curva de Equity</h2>
              <span className="text-text-muted text-xs">{equityCurve.length} operaciones cerradas</span>
            </div>
            {equityCurve.length > 1 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={equityCurve} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.substring(5)} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip
                    contentStyle={{ background: '#141d2e', border: '1px solid #1e2d45', borderRadius: 8 }}
                    formatter={(v) => [formatCurrency(v, currency), 'Balance']}
                    labelStyle={{ color: '#94a3b8', fontSize: 12 }}
                  />
                  <Area
                    type="monotone" dataKey="balance" stroke="#3b82f6" fill="url(#equityGrad)"
                    strokeWidth={2} dot={false}
                  />
                  <ReferenceLine y={account?.initial_balance || 10000} stroke="#475569" strokeDasharray="4 4" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="No hay suficientes datos" />
            )}
          </div>

          {/* Daily PnL + Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 card">
              <h2 className="text-text-primary font-semibold mb-4">P&L Diario</h2>
              {dailyPnl.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyPnl} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.substring(5)} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#141d2e', border: '1px solid #1e2d45', borderRadius: 8 }}
                      formatter={(v) => [formatCurrency(v, currency), 'P&L']}
                      labelStyle={{ color: '#94a3b8', fontSize: 12 }}
                    />
                    <ReferenceLine y={0} stroke="#475569" />
                    <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                      {dailyPnl.map((entry, i) => (
                        <Cell key={i} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="Sin datos de P&L diario" />
              )}
            </div>

            {/* Stats summary */}
            <div className="card space-y-3">
              <h2 className="text-text-primary font-semibold">Resumen</h2>
              <StatRow label="Racha actual" value={
                metrics.currentStreak > 0
                  ? <span className="text-profit font-num">+{metrics.currentStreak} ✓</span>
                  : metrics.currentStreak < 0
                  ? <span className="text-loss font-num">{metrics.currentStreak} ✗</span>
                  : <span className="text-text-muted">—</span>
              } />
              <StatRow label="Racha ganadora" value={<span className="text-profit font-num">{metrics.maxWinStreak}</span>} />
              <StatRow label="Racha perdedora" value={<span className="text-loss font-num">{metrics.maxLossStreak}</span>} />
              <StatRow label="Avg ganadora" value={<span className="text-profit font-num">{formatCurrency(metrics.avgWin, currency)}</span>} />
              <StatRow label="Avg perdedora" value={<span className="text-loss font-num">{formatCurrency(-metrics.avgLoss, currency)}</span>} />
              <StatRow label="Comisiones" value={<span className="text-neutral font-num">{formatCurrency(trades.reduce((s,t)=>s+(t.commission||0),0), currency)}</span>} />
              <StatRow label="Swaps" value={<span className="font-num text-text-secondary">{formatCurrency(trades.reduce((s,t)=>s+(t.swap||0),0), currency)}</span>} />
            </div>
          </div>

          {/* Recent Trades */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-text-primary font-semibold">Operaciones Recientes</h2>
              <Link to="/trades" className="text-accent-blue text-sm hover:underline">Ver todas →</Link>
            </div>
            {recentTrades.length > 0 ? (
              <table className="w-full trade-table">
                <thead>
                  <tr>
                    <th>Símbolo</th>
                    <th>Dir.</th>
                    <th>Apertura</th>
                    <th>Cierre</th>
                    <th>Volumen</th>
                    <th>Setup</th>
                    <th className="text-right">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTrades.map(t => (
                    <Link key={t.id} to={`/trades/${t.id}`} className="contents">
                      <tr className="cursor-pointer">
                        <td className="font-medium text-text-primary">{t.symbol}</td>
                        <td>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${t.direction === 'BUY' ? 'text-profit bg-profit/10' : 'text-loss bg-loss/10'}`}>
                            {t.direction}
                          </span>
                        </td>
                        <td className="text-text-secondary font-num text-xs">{t.open_price?.toFixed(5)}</td>
                        <td className="text-text-secondary font-num text-xs">{t.close_price?.toFixed(5)}</td>
                        <td className="text-text-secondary font-num">{t.volume}</td>
                        <td className="text-text-muted text-xs">{t.setup || '—'}</td>
                        <td className={`text-right font-num font-semibold ${pnlClass(t.pnl)}`}>
                          {t.pnl !== null ? (t.pnl >= 0 ? '+' : '') + t.pnl.toFixed(2) : '—'}
                        </td>
                      </tr>
                    </Link>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12 text-text-muted">
                <p className="text-4xl mb-3">📊</p>
                <p>No hay operaciones. Importa tus trades desde XTB.</p>
                <Link to="/import" className="mt-3 inline-block btn-primary text-sm">Importar XTB</Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function KPICard({ label, value, sub, positive, icon }) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-text-muted text-xs font-medium uppercase tracking-wider">{label}</p>
          <p className={`text-2xl font-bold font-num mt-1 ${positive ? 'text-profit' : 'text-loss'}`}>{value}</p>
          <p className="text-text-muted text-xs mt-1">{sub}</p>
        </div>
        <span className="text-2xl opacity-60">{icon}</span>
      </div>
    </div>
  )
}

function StatRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-text-secondary">{label}</span>
      <span>{value}</span>
    </div>
  )
}

function EmptyChart({ label }) {
  return (
    <div className="h-40 flex items-center justify-center text-text-muted text-sm">{label}</div>
  )
}
