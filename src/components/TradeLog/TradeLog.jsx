import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatCurrency, pnlClass } from '../../utils/tradeMetrics'

const DIRECTIONS = ['Todos', 'BUY', 'SELL']
const STATUSES = [
  { label: 'Cerradas', value: 'closed' },
  { label: 'Abiertas', value: 'open' },
  { label: 'Todas', value: '' },
]
const SESSIONS = ['Todas', 'Asiática', 'Londres AM', 'Nueva York AM', 'Nueva York PM', 'Pre-Mercado']

const SORT_FIELDS = {
  close_time: 'Fecha',
  symbol: 'Símbolo',
  pnl: 'P&L',
  volume: 'Volumen',
}

export default function TradeLog() {
  const navigate = useNavigate()
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [setups, setSetups] = useState([])
  const [selected, setSelected] = useState(new Set())

  // Filters
  const [search, setSearch] = useState('')
  const [direction, setDirection] = useState('Todos')
  const [status, setStatus] = useState('closed')
  const [session, setSession] = useState('Todas')
  const [setup, setSetup] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [instrType, setInstrType] = useState('')
  const [sortField, setSortField] = useState('close_time')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    loadSetups()
  }, [])

  useEffect(() => {
    loadTrades()
  }, [direction, status, session, setup, dateFrom, dateTo, instrType])

  async function loadSetups() {
    const s = await window.api.setups.getAll()
    setSetups(s)
  }

  async function loadTrades() {
    setLoading(true)
    const filters = {}
    if (direction !== 'Todos') filters.direction = direction
    if (status) filters.status = status
    if (session !== 'Todas') filters.session = session
    if (setup) filters.setup = setup
    if (dateFrom) filters.dateFrom = dateFrom
    if (dateTo) filters.dateTo = dateTo
    if (instrType) filters.instrument_type = instrType

    const data = await window.api.trades.getAll(filters)
    setTrades(data)
    setLoading(false)
  }

  async function handleDelete(ids) {
    if (!confirm(`¿Eliminar ${ids.length} operación(es)?`)) return
    for (const id of ids) await window.api.trades.delete(id)
    setSelected(new Set())
    loadTrades()
  }

  const filtered = trades.filter(t => {
    if (!search) return true
    const q = search.toLowerCase()
    return t.symbol.toLowerCase().includes(q) || (t.setup || '').toLowerCase().includes(q)
  })

  const sorted = [...filtered].sort((a, b) => {
    let av = a[sortField], bv = b[sortField]
    if (av === null) av = sortDir === 'asc' ? Infinity : -Infinity
    if (bv === null) bv = sortDir === 'asc' ? Infinity : -Infinity
    if (typeof av === 'string') av = av.toLowerCase()
    if (typeof bv === 'string') bv = bv.toLowerCase()
    return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
  })

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === sorted.length) setSelected(new Set())
    else setSelected(new Set(sorted.map(t => t.id)))
  }

  const totalPnl = sorted.filter(t => t.pnl !== null).reduce((s, t) => s + t.pnl, 0)
  const winCount = sorted.filter(t => t.pnl > 0).length
  const lossCount = sorted.filter(t => t.pnl < 0).length

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 bg-bg-secondary">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Trade Log</h1>
          <p className="text-text-muted text-xs mt-0.5">{sorted.length} operaciones · P&L: <span className={`font-num font-semibold ${pnlClass(totalPnl)}`}>{totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)} €</span></p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <button onClick={() => handleDelete([...selected])} className="btn-danger">
              <TrashIcon /> Eliminar ({selected.size})
            </button>
          )}
          <Link to="/trades/new" className="btn-primary">
            <PlusIcon /> Nueva Operación
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-border bg-bg-secondary flex flex-wrap gap-2 items-center">
        <input
          className="input w-44"
          placeholder="Buscar símbolo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="input" value={direction} onChange={e => setDirection(e.target.value)}>
          {DIRECTIONS.map(d => <option key={d}>{d}</option>)}
        </select>
        <select className="input" value={session} onChange={e => setSession(e.target.value)}>
          {SESSIONS.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="input" value={setup} onChange={e => setSetup(e.target.value)}>
          <option value="">Todos los Setups</option>
          {setups.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <select className="input" value={instrType} onChange={e => setInstrType(e.target.value)}>
          <option value="">Todos los Tipos</option>
          <option value="forex">Forex</option>
          <option value="commodity">Commodities</option>
          <option value="index">Índices</option>
          <option value="crypto">Crypto</option>
          <option value="stock">Acciones</option>
        </select>
        <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span className="text-text-muted text-xs">—</span>
        <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <button onClick={() => { setSearch(''); setDirection('Todos'); setStatus('closed'); setSession('Todas'); setSetup(''); setInstrType(''); setDateFrom(''); setDateTo('') }}
          className="text-text-muted text-xs hover:text-text-primary transition-colors">
          Limpiar
        </button>
      </div>

      {/* Badges summary */}
      <div className="px-6 py-2 border-b border-border flex gap-3 bg-bg-primary">
        <span className="badge-profit">{winCount} ganadoras</span>
        <span className="badge-loss">{lossCount} perdedoras</span>
        <span className="badge-neutral">{sorted.filter(t=>t.pnl===0).length} breakeven</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-text-muted">
            <span className="text-5xl mb-3">📂</span>
            <p>No hay operaciones. <Link to="/import" className="text-accent-blue hover:underline">Importar desde XTB</Link></p>
          </div>
        ) : (
          <table className="w-full trade-table">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" checked={selected.size === sorted.length && sorted.length > 0}
                    onChange={toggleAll} className="rounded" />
                </th>
                <SortTh field="close_time" current={sortField} dir={sortDir} onSort={toggleSort}>Fecha</SortTh>
                <SortTh field="symbol" current={sortField} dir={sortDir} onSort={toggleSort}>Símbolo</SortTh>
                <th>Dir.</th>
                <th>Setup</th>
                <th>Sesión</th>
                <th>Apertura</th>
                <th>Cierre</th>
                <SortTh field="volume" current={sortField} dir={sortDir} onSort={toggleSort}>Vol.</SortTh>
                <th>SL</th>
                <th>TP</th>
                <th>R:R</th>
                <th>⭐</th>
                <SortTh field="pnl" current={sortField} dir={sortDir} onSort={toggleSort}>P&L</SortTh>
                <th>R-mult</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(t => (
                <tr
                  key={t.id}
                  onClick={() => navigate(`/trades/${t.id}`)}
                  className={`cursor-pointer ${selected.has(t.id) ? 'bg-accent-blue/5' : ''}`}
                >
                  <td onClick={e => { e.stopPropagation(); toggleSelect(t.id) }}>
                    <input type="checkbox" checked={selected.has(t.id)} readOnly className="rounded" />
                  </td>
                  <td className="text-text-secondary text-xs font-num whitespace-nowrap">
                    {t.close_time ? t.close_time.substring(0, 16) : t.open_time?.substring(0, 16)}
                  </td>
                  <td className="font-semibold text-text-primary">
                    <span className="flex items-center gap-1.5">
                      {t.symbol}
                      {t.needs_review && <span className="w-1.5 h-1.5 rounded-full bg-neutral flex-shrink-0" title="Pendiente de revisión" />}
                    </span>
                  </td>
                  <td>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${t.direction === 'BUY' ? 'text-profit bg-profit/10' : 'text-loss bg-loss/10'}`}>
                      {t.direction}
                    </span>
                  </td>
                  <td className="text-text-secondary text-xs">{t.setup || <span className="text-text-muted">—</span>}</td>
                  <td className="text-text-muted text-xs">{t.session || '—'}</td>
                  <td className="font-num text-xs text-text-secondary">{t.open_price?.toFixed(5)}</td>
                  <td className="font-num text-xs text-text-secondary">{t.close_price?.toFixed(5) || '—'}</td>
                  <td className="font-num text-text-secondary">{t.volume}</td>
                  <td className="font-num text-xs text-text-muted">{t.stop_loss || '—'}</td>
                  <td className="font-num text-xs text-text-muted">{t.take_profit || '—'}</td>
                  <td className="font-num text-xs text-text-secondary">{t.risk_reward ? `1:${Number(t.risk_reward).toFixed(1)}` : '—'}</td>
                  <td>{t.rating ? '⭐'.repeat(t.rating) : <span className="text-text-muted">—</span>}</td>
                  <td className={`font-num font-semibold text-right ${pnlClass(t.pnl)}`}>
                    {t.pnl !== null
                      ? `${t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}`
                      : <span className="text-neutral text-xs">Abierta</span>
                    }
                  </td>
                  <td className={`font-num text-xs font-semibold ${pnlClass(t.pnl)}`}>
                    {t.risk_amount > 0 && t.pnl !== null
                      ? `${t.pnl >= 0 ? '+' : ''}${(t.pnl / t.risk_amount).toFixed(1)}R`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function SortTh({ field, current, dir, onSort, children }) {
  const active = current === field
  return (
    <th onClick={() => onSort(field)} className="cursor-pointer select-none hover:text-text-primary">
      <span className="flex items-center gap-1">
        {children}
        <span className="text-text-muted">{active ? (dir === 'asc' ? '↑' : '↓') : '↕'}</span>
      </span>
    </th>
  )
}

function PlusIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
}
function TrashIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
}
