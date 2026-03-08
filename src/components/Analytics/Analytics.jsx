import React, { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Cell, PieChart, Pie
} from 'recharts'
import { formatCurrency, pnlClass } from '../../utils/tradeMetrics'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const SESSIONS = ['Asiática', 'Londres AM', 'Nueva York AM', 'Nueva York PM', 'Pre-Mercado']

export default function Analytics() {
  const [data, setData] = useState(null)
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => { loadData() }, [dateFrom, dateTo])

  async function loadData() {
    setLoading(true)
    const filters = {}
    if (dateFrom) filters.dateFrom = dateFrom
    if (dateTo) filters.dateTo = dateTo
    const [summary, allTrades] = await Promise.all([
      window.api.stats.getSummary(filters),
      window.api.trades.getAll({ ...filters, status: 'closed' }),
    ])
    setData(summary)
    setTrades(allTrades)
    setLoading(false)
  }

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" /></div>

  const { stats, bySymbol, bySetup, bySession, byDirection, byDayOfWeek, byHour } = data || {}

  const profitFactor = stats?.gross_loss ? Math.abs(stats.gross_profit / stats.gross_loss) : 0
  const winRate = stats?.total_trades ? (stats.winning_trades / stats.total_trades) * 100 : 0

  const hourData = Array.from({ length: 24 }, (_, h) => {
    const found = byHour?.find(x => parseInt(x.hour) === h)
    return { hour: `${String(h).padStart(2,'0')}h`, pnl: found?.total_pnl || 0, trades: found?.trades || 0 }
  })

  const dowData = DAYS.map((d, i) => {
    const found = byDayOfWeek?.find(x => parseInt(x.dow) === i)
    return { day: d, pnl: found?.total_pnl || 0, trades: found?.trades || 0 }
  })

  const pieData = byDirection?.map(d => ({
    name: d.direction, value: d.trades, fill: d.direction === 'BUY' ? '#10b981' : '#ef4444'
  })) || []

  // Distribution histogram
  const buckets = {}
  trades.forEach(t => {
    if (t.pnl === null) return
    const bucket = Math.floor(t.pnl / 50) * 50
    buckets[bucket] = (buckets[bucket] || 0) + 1
  })
  const distribution = Object.entries(buckets)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([bucket, count]) => ({ range: `${Number(bucket) >= 0 ? '+' : ''}${bucket}`, count, bucket: Number(bucket) }))

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Analytics</h1>
          <p className="text-text-secondary text-sm">Análisis profundo de tu operativa</p>
        </div>
        <div className="flex gap-2 items-center">
          <input type="date" className="input text-xs" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span className="text-text-muted text-xs">—</span>
          <input type="date" className="input text-xs" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          <button onClick={() => { setDateFrom(''); setDateTo('') }} className="text-text-muted text-xs hover:text-text-primary">Limpiar</button>
        </div>
      </div>

      {/* Radar Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card">
          <h3 className="text-text-primary font-semibold mb-4">Perfil de Trader</h3>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={[
              { metric: 'Win Rate', value: Math.min(winRate, 100) },
              { metric: 'Prof. Factor', value: Math.min(profitFactor * 20, 100) },
              { metric: 'Avg R:R', value: Math.min((stats?.avg_rr || 0) * 20, 100) },
              { metric: 'Consistencia', value: Math.min(winRate * 0.8, 100) },
              { metric: 'Disciplina', value: trades.filter(t=>t.followed_plan).length / Math.max(trades.length,1) * 100 },
            ]}>
              <PolarGrid stroke="#1e2d45" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} />
              <Radar dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-text-primary font-semibold mb-4">Buy vs Sell</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                  dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                  labelLine={false}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip formatter={(v) => [v, 'Trades']} contentStyle={{ background: '#141d2e', border: '1px solid #1e2d45', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>

        <div className="card space-y-3">
          <h3 className="text-text-primary font-semibold">Métricas Clave</h3>
          <MetricRow label="Total Operaciones" value={stats?.total_trades || 0} />
          <MetricRow label="Ganadoras" value={<span className="text-profit">{stats?.winning_trades || 0}</span>} />
          <MetricRow label="Perdedoras" value={<span className="text-loss">{stats?.losing_trades || 0}</span>} />
          <MetricRow label="Win Rate" value={`${winRate.toFixed(1)}%`} />
          <MetricRow label="Profit Factor" value={profitFactor > 0 ? profitFactor.toFixed(2) : '—'} />
          <MetricRow label="Avg Ganadora" value={<span className="text-profit font-num">{formatCurrency(stats?.avg_win)}</span>} />
          <MetricRow label="Avg Perdedora" value={<span className="text-loss font-num">{formatCurrency(stats?.avg_loss)}</span>} />
          <MetricRow label="Comisiones" value={<span className="font-num text-neutral">{formatCurrency(stats?.total_commission)}</span>} />
        </div>
      </div>

      {/* By Symbol */}
      <div className="card">
        <h3 className="text-text-primary font-semibold mb-4">P&L por Símbolo</h3>
        {bySymbol?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full trade-table">
              <thead>
                <tr>
                  <th>Símbolo</th>
                  <th>Trades</th>
                  <th>Win Rate</th>
                  <th>P&L Total</th>
                  <th>P&L Medio</th>
                  <th>Performance</th>
                </tr>
              </thead>
              <tbody>
                {bySymbol.map(s => (
                  <tr key={s.symbol}>
                    <td className="font-semibold">{s.symbol}</td>
                    <td className="font-num">{s.trades}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                          <div className="h-full bg-profit rounded-full" style={{ width: `${s.win_rate}%` }} />
                        </div>
                        <span className="font-num text-xs">{s.win_rate?.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className={`font-num font-semibold ${pnlClass(s.total_pnl)}`}>
                      {s.total_pnl >= 0 ? '+' : ''}{s.total_pnl?.toFixed(2)}€
                    </td>
                    <td className={`font-num ${pnlClass(s.avg_pnl)}`}>{s.avg_pnl?.toFixed(2)}€</td>
                    <td>
                      <div className="w-24 h-2 bg-bg-tertiary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${s.total_pnl >= 0 ? 'bg-profit' : 'bg-loss'}`}
                          style={{ width: `${Math.min(Math.abs(s.total_pnl) / Math.max(...bySymbol.map(x=>Math.abs(x.total_pnl))) * 100, 100)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyChart label="Sin datos" />}
      </div>

      {/* By Setup */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-text-primary font-semibold mb-4">P&L por Setup</h3>
          {bySetup?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bySetup} layout="vertical" margin={{ left: 80, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="setup" tick={{ fontSize: 11 }} width={80} />
                <Tooltip contentStyle={{ background: '#141d2e', border: '1px solid #1e2d45', borderRadius: 8 }}
                  formatter={v => [`${v?.toFixed(2)}€`, 'P&L']} />
                <Bar dataKey="total_pnl" radius={[0, 3, 3, 0]}>
                  {bySetup.map((s, i) => <Cell key={i} fill={s.total_pnl >= 0 ? '#10b981' : '#ef4444'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>

        <div className="card">
          <h3 className="text-text-primary font-semibold mb-4">P&L por Sesión</h3>
          {bySession?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bySession} layout="vertical" margin={{ left: 100, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="session" tick={{ fontSize: 11 }} width={100} />
                <Tooltip contentStyle={{ background: '#141d2e', border: '1px solid #1e2d45', borderRadius: 8 }}
                  formatter={v => [`${v?.toFixed(2)}€`, 'P&L']} />
                <Bar dataKey="total_pnl" radius={[0, 3, 3, 0]}>
                  {bySession.map((s, i) => <Cell key={i} fill={s.total_pnl >= 0 ? '#10b981' : '#ef4444'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>
      </div>

      {/* By Hour & Day of week */}
      <div className="card">
        <h3 className="text-text-primary font-semibold mb-4">P&L por Hora del Día</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={hourData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" />
            <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#141d2e', border: '1px solid #1e2d45', borderRadius: 8 }}
              formatter={(v, n) => [n === 'pnl' ? `${v?.toFixed(2)}€` : v, n === 'pnl' ? 'P&L' : 'Trades']} />
            <ReferenceLine y={0} stroke="#475569" />
            <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
              {hourData.map((h, i) => <Cell key={i} fill={h.pnl >= 0 ? '#10b981' : '#ef4444'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-text-primary font-semibold mb-4">P&L por Día de la Semana</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dowData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#141d2e', border: '1px solid #1e2d45', borderRadius: 8 }}
                formatter={v => [`${v?.toFixed(2)}€`, 'P&L']} />
              <ReferenceLine y={0} stroke="#475569" />
              <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
                {dowData.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? '#10b981' : '#ef4444'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-text-primary font-semibold mb-4">Distribución de P&L</h3>
          {distribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={distribution} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" />
                <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#141d2e', border: '1px solid #1e2d45', borderRadius: 8 }}
                  formatter={v => [v, 'Trades']} />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {distribution.map((d, i) => <Cell key={i} fill={d.bucket >= 0 ? '#10b981' : '#ef4444'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>
      </div>
    </div>
  )
}

function MetricRow({ label, value }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function EmptyChart({ label = 'Sin datos suficientes' }) {
  return <div className="h-32 flex items-center justify-center text-text-muted text-sm">{label}</div>
}

// ReferenceLine needs to be imported
