import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n, dec = 2) => (n == null ? '—' : Number(n).toFixed(dec))
const fmtPct = n => (n == null ? '—' : `${Number(n).toFixed(1)}%`)
const fmtPnl = n => {
  if (n == null) return '—'
  return `${n >= 0 ? '+' : ''}${Number(n).toFixed(2)}`
}
const pnlCls = n => (n > 0 ? 'pos' : n < 0 ? 'neg' : 'neu')
const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const fmtMonth = m => { // "2024-03" → "Mar 2024"
  if (!m) return ''
  const [y, mo] = m.split('-')
  return `${MONTH_NAMES[parseInt(mo,10)-1]} ${y}`
}
const fmtMinutes = m => {
  if (!m) return '—'
  if (m < 60) return `${Math.round(m)}m`
  const h = Math.floor(m / 60), min = Math.round(m % 60)
  return min > 0 ? `${h}h ${min}m` : `${h}h`
}

export default function PerformanceReport() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [account, setAccount] = useState(null)
  const printRef = useRef()

  const dateFrom = searchParams.get('from') || ''
  const dateTo   = searchParams.get('to')   || ''

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [summaryData, acc] = await Promise.all([
        window.api.stats.getSummary({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
        window.api.account.get(),
      ])
      setData(summaryData)
      setAccount(acc)
      setLoading(false)
    }
    load()
  }, [dateFrom, dateTo])

  function handlePrint() {
    window.print()
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) return null

  const { stats, bySymbol, bySetup, bySession, monthlyStats } = data
  const generatedAt = new Date().toLocaleDateString('es-ES', { day:'2-digit', month:'long', year:'numeric' })
  const periodLabel = dateFrom && dateTo
    ? `${dateFrom} — ${dateTo}`
    : dateFrom ? `Desde ${dateFrom}` : dateTo ? `Hasta ${dateTo}` : 'Todo el historial'

  // Top/bottom 5 trades
  const allTrades = data.dailyPnl // not individual trades — we'll use bySymbol for the top table
  const topSymbols  = [...(bySymbol  || [])].sort((a,b) => b.total_pnl - a.total_pnl).slice(0,8)
  const topSetups   = [...(bySetup   || [])].sort((a,b) => b.total_pnl - a.total_pnl)
  const topSessions = [...(bySession || [])].sort((a,b) => b.total_pnl - a.total_pnl)

  return (
    <>
      {/* ── Print styles injected via style tag ── */}
      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { background: #ffffff !important; color: #111 !important; margin: 0; }
          aside, .no-print { display: none !important; }
          main { overflow: visible !important; }
          .report-page { padding: 0 !important; background: white !important; }
          .report-wrap { max-width: 100% !important; box-shadow: none !important; padding: 20px 32px !important; }
          .page-break { page-break-before: always; }
          .avoid-break { page-break-inside: avoid; }
        }
        .report-page { background: #f5f4f2; min-height: 100vh; padding: 24px; overflow-y: auto; flex: 1; }
        .report-wrap { max-width: 900px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 40px 48px; box-shadow: 0 4px 24px rgba(0,0,0,.12); color: #1a1a1a; font-family: 'Inter', system-ui, sans-serif; }

        /* typography */
        .r-h1 { font-size: 24px; font-weight: 700; color: #111; margin-bottom: 2px; }
        .r-h2 { font-size: 14px; font-weight: 600; color: #333; margin: 28px 0 12px; border-bottom: 1.5px solid #e5e4e2; padding-bottom: 6px; text-transform: uppercase; letter-spacing: .05em; }
        .r-meta { font-size: 12px; color: #777; }

        /* kpi grid */
        .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 4px; }
        .kpi-card { background: #f8f7f5; border: 1px solid #e5e4e2; border-radius: 8px; padding: 12px 14px; }
        .kpi-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 4px; }
        .kpi-value { font-size: 20px; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
        .kpi-sub { font-size: 11px; color: #777; margin-top: 2px; }

        /* colors */
        .pos { color: #16a34a; }
        .neg { color: #dc2626; }
        .neu { color: #d97706; }

        /* table */
        .r-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .r-table th { text-align: left; padding: 6px 10px; background: #f3f2f0; color: #555; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid #e5e4e2; }
        .r-table td { padding: 7px 10px; border-bottom: 1px solid #f0efed; color: #333; }
        .r-table tr:last-child td { border-bottom: none; }
        .r-table .num { font-family: 'JetBrains Mono', monospace; text-align: right; }

        /* bar */
        .bar-wrap { display: flex; align-items: center; gap: 6px; }
        .bar-bg { flex: 1; height: 5px; background: #ece9e5; border-radius: 3px; overflow: hidden; min-width: 40px; }
        .bar-fill { height: 100%; border-radius: 3px; }

        /* monthly pnl row colors */
        .month-pos { background: #f0fdf4; }
        .month-neg { background: #fef2f2; }

        /* divider */
        .r-divider { border: none; border-top: 1px solid #e5e4e2; margin: 24px 0; }

        /* stat row */
        .stat-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #ece9e5; font-size: 13px; }
        .stat-row:last-child { border-bottom: none; }
        .stat-label { color: #666; }
        .stat-value { font-family: 'JetBrains Mono', monospace; font-weight: 600; color: #111; }
      `}</style>

      {/* ── Top bar (no-print) ── */}
      <div className="no-print flex items-center gap-3 px-6 py-3 border-b border-border bg-bg-secondary">
        <button onClick={() => navigate('/export')} className="btn-secondary py-1.5 px-3 text-xs">
          ← Volver
        </button>
        <span className="text-text-muted text-xs flex-1">Previsualización del informe · {periodLabel}</span>
        <button onClick={handlePrint} className="btn-primary py-1.5 px-4 text-xs">
          Imprimir / Guardar PDF
        </button>
      </div>

      {/* ── Report body ── */}
      <div className="report-page" ref={printRef}>
        <div className="report-wrap">

          {/* HEADER */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
            <div>
              <div className="r-h1">Informe de Rendimiento</div>
              <div className="r-meta" style={{marginTop:4}}>
                {account?.account_name} · {account?.broker} · {account?.currency}
              </div>
              <div className="r-meta" style={{marginTop:2}}>Período: {periodLabel}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontWeight:700, fontSize:18, color:'#6366f1'}}>Trading Tracker</div>
              <div className="r-meta" style={{marginTop:4}}>Generado el {generatedAt}</div>
            </div>
          </div>

          <hr className="r-divider" style={{marginTop:0}} />

          {/* KPI GRID — row 1 */}
          <div className="r-h2">Resumen general</div>
          <div className="kpi-grid avoid-break">
            <KpiCard label="P&L Total" value={fmtPnl(stats.total_pnl)} unit={account?.currency || '€'}
              cls={pnlCls(stats.total_pnl)} sub={`${stats.total_trades} operaciones`} />
            <KpiCard label="Win Rate" value={fmtPct(stats.win_rate)}
              cls={stats.win_rate >= 50 ? 'pos' : 'neg'}
              sub={`${stats.winning_trades}W / ${stats.losing_trades}L`} />
            <KpiCard label="Profit Factor" value={isFinite(stats.profit_factor) ? fmt(stats.profit_factor) : '∞'}
              cls={stats.profit_factor >= 1.5 ? 'pos' : stats.profit_factor >= 1 ? 'neu' : 'neg'}
              sub="ganancia bruta / pérdida bruta" />
            <KpiCard label="Expectativa" value={fmtPnl(stats.expected_value)}
              cls={pnlCls(stats.expected_value)} sub="por operación" />
          </div>
          <div className="kpi-grid avoid-break" style={{marginTop:10}}>
            <KpiCard label="Max Drawdown" value={`-${fmt(stats.max_drawdown)}`} cls="neg"
              sub={fmtPct(stats.max_drawdown_pct)} />
            <KpiCard label="Recovery Factor" value={isFinite(stats.recovery_factor) ? fmt(stats.recovery_factor) : '∞'}
              cls={stats.recovery_factor >= 1 ? 'pos' : 'neg'} sub="PnL total / Max DD" />
            <KpiCard label="Avg R:R" value={stats.avg_rr ? `1:${fmt(stats.avg_rr)}` : '—'} cls=""
              sub="promedio risk:reward" />
            <KpiCard label="Tiempo Medio" value={fmtMinutes(stats.avg_holding_time_minutes)} cls=""
              sub={`${fmt(stats.trades_per_day, 1)} trades/día`} />
          </div>

          {/* DETAIL STATS */}
          <div className="r-h2" style={{marginTop:28}}>Estadísticas detalladas</div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24}} className="avoid-break">
            <div>
              <StatRow label="Ganancia bruta" value={`+${fmt(stats.gross_profit)} ${account?.currency||'€'}`} cls="pos" />
              <StatRow label="Pérdida bruta"  value={`${fmt(stats.gross_loss)} ${account?.currency||'€'}`}   cls="neg" />
              <StatRow label="Mejor trade"    value={`+${fmt(stats.best_trade)} ${account?.currency||'€'}`}  cls="pos" />
              <StatRow label="Peor trade"     value={`${fmt(stats.worst_trade)} ${account?.currency||'€'}`}  cls="neg" />
              <StatRow label="Promedio ganadora" value={`+${fmt(stats.avg_win)} ${account?.currency||'€'}`} cls="pos" />
              <StatRow label="Promedio perdedora" value={`${fmt(stats.avg_loss)} ${account?.currency||'€'}`} cls="neg" />
            </div>
            <div>
              <StatRow label="Comisiones totales" value={`${fmt(stats.total_commission)} ${account?.currency||'€'}`} />
              <StatRow label="Swaps totales"       value={`${fmt(stats.total_swap)} ${account?.currency||'€'}`} />
              <StatRow label="Racha ganadora máx." value={`${stats.consecutive_wins} operaciones`} cls="pos" />
              <StatRow label="Racha perdedora máx." value={`${stats.consecutive_losses} operaciones`} cls="neg" />
              <StatRow label="Días activos"   value={`${Math.round(stats.total_trades / Math.max(stats.trades_per_day,0.1))} días`} />
              <StatRow label="Trades totales" value={stats.total_trades} />
            </div>
          </div>

          {/* MONTHLY BREAKDOWN */}
          {monthlyStats?.length > 0 && (
            <div className="page-break">
              <div className="r-h2">Desglose mensual</div>
              <table className="r-table avoid-break">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th className="num">Trades</th>
                    <th className="num">Win Rate</th>
                    <th className="num">P&L</th>
                    <th style={{width:'30%'}}>Barra</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyStats.map(m => {
                    const maxAbs = Math.max(...monthlyStats.map(x => Math.abs(x.pnl)), 1)
                    const barPct = Math.abs(m.pnl) / maxAbs * 100
                    return (
                      <tr key={m.month} className={m.pnl >= 0 ? 'month-pos' : 'month-neg'}>
                        <td style={{fontWeight:600}}>{fmtMonth(m.month)}</td>
                        <td className="num">{m.trades}</td>
                        <td className={`num ${m.win_rate >= 50 ? 'pos' : 'neg'}`}>{fmtPct(m.win_rate)}</td>
                        <td className={`num ${pnlCls(m.pnl)}`} style={{fontWeight:700}}>{fmtPnl(m.pnl)}</td>
                        <td>
                          <div className="bar-wrap">
                            <div className="bar-bg">
                              <div className="bar-fill" style={{
                                width:`${barPct}%`,
                                background: m.pnl >= 0 ? '#16a34a' : '#dc2626'
                              }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* BY SYMBOL */}
          {topSymbols.length > 0 && (
            <>
              <div className="r-h2" style={{marginTop:28}}>Rendimiento por símbolo</div>
              <table className="r-table avoid-break">
                <thead>
                  <tr>
                    <th>Símbolo</th>
                    <th className="num">Trades</th>
                    <th className="num">Win Rate</th>
                    <th className="num">P&L Medio</th>
                    <th className="num">P&L Total</th>
                  </tr>
                </thead>
                <tbody>
                  {topSymbols.map(s => (
                    <tr key={s.symbol}>
                      <td style={{fontWeight:600}}>{s.symbol}</td>
                      <td className="num">{s.trades}</td>
                      <td className={`num ${s.win_rate >= 50 ? 'pos' : 'neg'}`}>{fmtPct(s.win_rate)}</td>
                      <td className={`num ${pnlCls(s.avg_pnl)}`}>{fmtPnl(s.avg_pnl)}</td>
                      <td className={`num ${pnlCls(s.total_pnl)}`} style={{fontWeight:700}}>{fmtPnl(s.total_pnl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* BY SETUP + BY SESSION side by side */}
          {(topSetups.length > 0 || topSessions.length > 0) && (
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, marginTop:28}} className="avoid-break">
              {topSetups.length > 0 && (
                <div>
                  <div className="r-h2" style={{marginTop:0}}>Por setup</div>
                  <table className="r-table">
                    <thead>
                      <tr>
                        <th>Setup</th>
                        <th className="num">WR%</th>
                        <th className="num">P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topSetups.map(s => (
                        <tr key={s.setup}>
                          <td>{s.setup}</td>
                          <td className={`num ${s.win_rate >= 50 ? 'pos' : 'neg'}`}>{fmtPct(s.win_rate)}</td>
                          <td className={`num ${pnlCls(s.total_pnl)}`} style={{fontWeight:600}}>{fmtPnl(s.total_pnl)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {topSessions.length > 0 && (
                <div>
                  <div className="r-h2" style={{marginTop:0}}>Por sesión</div>
                  <table className="r-table">
                    <thead>
                      <tr>
                        <th>Sesión</th>
                        <th className="num">WR%</th>
                        <th className="num">P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topSessions.map(s => (
                        <tr key={s.session}>
                          <td>{s.session}</td>
                          <td className={`num ${s.win_rate >= 50 ? 'pos' : 'neg'}`}>{fmtPct(s.win_rate)}</td>
                          <td className={`num ${pnlCls(s.total_pnl)}`} style={{fontWeight:600}}>{fmtPnl(s.total_pnl)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* FOOTER */}
          <hr className="r-divider" style={{marginTop:32}} />
          <div style={{display:'flex', justifyContent:'space-between', fontSize:11, color:'#aaa'}}>
            <span>Trading Tracker Pro · {account?.account_name}</span>
            <span>Generado el {generatedAt}</span>
          </div>

        </div>
      </div>
    </>
  )
}

function KpiCard({ label, value, unit, cls, sub }) {
  return (
    <div className="kpi-card avoid-break">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${cls}`}>{value} <span style={{fontSize:12,fontWeight:500}}>{unit}</span></div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}

function StatRow({ label, value, cls }) {
  return (
    <div className="stat-row">
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${cls||''}`}>{value}</span>
    </div>
  )
}
