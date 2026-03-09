import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { pnlClass } from '../../utils/tradeMetrics'

export default function TradeCalendar() {
  const navigate = useNavigate()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState(null)
  const [dailyNotes, setDailyNotes] = useState(null)
  const [noteForm, setNoteForm] = useState({ market_conditions: '', pre_market_notes: '', post_market_notes: '', mood: 'neutral' })

  useEffect(() => {
    loadMonth()
  }, [currentDate])

  async function loadMonth() {
    setLoading(true)
    const from = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const to = format(endOfMonth(currentDate), 'yyyy-MM-dd')
    const data = await window.api.trades.getAll({ dateFrom: from, dateTo: to, status: 'closed' })
    setTrades(data)
    setLoading(false)
  }

  async function loadDayNotes(date) {
    const notes = await window.api.dailyNotes.get(date)
    setDailyNotes(notes)
    setNoteForm(notes || { market_conditions: '', pre_market_notes: '', post_market_notes: '', mood: 'neutral' })
  }

  async function saveNotes() {
    await window.api.dailyNotes.save({ ...noteForm, date: selectedDay })
    loadDayNotes(selectedDay)
  }

  function selectDay(date) {
    setSelectedDay(date)
    loadDayNotes(date)
  }

  // Build daily data map
  const dailyMap = {}
  trades.forEach(t => {
    if (!t.close_time) return
    const day = t.close_time.substring(0, 10)
    if (!dailyMap[day]) dailyMap[day] = { pnl: 0, trades: 0, wins: 0, losses: 0 }
    dailyMap[day].pnl += t.pnl || 0
    dailyMap[day].trades++
    if (t.pnl > 0) dailyMap[day].wins++
    else if (t.pnl < 0) dailyMap[day].losses++
  })

  const days = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) })
  const firstDayOffset = (getDay(days[0]) + 6) % 7 // Monday = 0

  const monthPnl = Object.values(dailyMap).reduce((s, d) => s + d.pnl, 0)
  const tradingDays = Object.keys(dailyMap).length
  const profitDays = Object.values(dailyMap).filter(d => d.pnl > 0).length
  const lossDays = Object.values(dailyMap).filter(d => d.pnl < 0).length

  const dayTrades = selectedDay ? trades.filter(t => t.close_time?.startsWith(selectedDay)) : []

  return (
    <div className="flex-1 flex overflow-hidden fade-in">
      {/* Calendar */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-bg-secondary flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary capitalize">
              {format(currentDate, 'MMMM yyyy', { locale: es })}
            </h1>
            <div className="flex gap-4 mt-0.5 text-xs text-text-muted">
              <span>P&L: <span className={`font-num font-semibold ${pnlClass(monthPnl)}`}>{monthPnl >= 0 ? '+' : ''}{monthPnl.toFixed(2)}€</span></span>
              <span>{tradingDays} días operados</span>
              <span className="text-profit">{profitDays} positivos</span>
              <span className="text-loss">{lossDays} negativos</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setCurrentDate(d => subMonths(d, 1))} className="btn-secondary py-1.5 px-3">←</button>
            <button onClick={() => setCurrentDate(new Date())} className="btn-secondary py-1.5 px-3 text-xs">Hoy</button>
            <button onClick={() => setCurrentDate(d => addMonths(d, 1))} className="btn-secondary py-1.5 px-3">→</button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border bg-bg-secondary">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
            <div key={d} className="py-2 text-center text-text-muted text-xs font-medium uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-7 auto-rows-fr min-h-full">
              {/* Empty cells */}
              {Array.from({ length: firstDayOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="border-r border-b border-border bg-bg-primary/30" />
              ))}
              {/* Day cells */}
              {days.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd')
                const dayData = dailyMap[dateStr]
                const isSelected = selectedDay === dateStr
                const isToday = dateStr === format(new Date(), 'yyyy-MM-dd')

                return (
                  <div
                    key={dateStr}
                    onClick={() => selectDay(dateStr)}
                    className={`border-r border-b border-border p-2 cursor-pointer min-h-[90px] transition-all ${
                      isSelected
                        ? 'bg-accent-blue/10 border-accent-blue/30'
                        : dayData
                        ? dayData.pnl > 0
                          ? 'bg-profit/5 hover:bg-profit/10'
                          : 'bg-loss/5 hover:bg-loss/10'
                        : 'hover:bg-bg-hover'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${
                        isToday ? 'bg-accent-blue text-white w-6 h-6 rounded-full flex items-center justify-center text-xs' :
                        dayData ? (dayData.pnl > 0 ? 'text-profit' : 'text-loss') : 'text-text-muted'
                      }`}>
                        {format(day, 'd')}
                      </span>
                      {dayData && (
                        <span className={`text-xs font-num font-semibold ${pnlClass(dayData.pnl)}`}>
                          {dayData.pnl >= 0 ? '+' : ''}{dayData.pnl.toFixed(0)}€
                        </span>
                      )}
                    </div>
                    {dayData && (
                      <div className="mt-1 space-y-0.5">
                        <p className="text-text-muted text-xs">{dayData.trades} op.</p>
                        <div className="flex gap-1">
                          {dayData.wins > 0 && <span className="text-profit text-xs font-num">{dayData.wins}✓</span>}
                          {dayData.losses > 0 && <span className="text-loss text-xs font-num">{dayData.losses}✗</span>}
                        </div>
                        {/* PnL bar */}
                        <div className="h-1 rounded-full bg-bg-tertiary overflow-hidden mt-1">
                          <div
                            className={`h-full rounded-full ${dayData.pnl >= 0 ? 'bg-profit' : 'bg-loss'}`}
                            style={{ width: `${Math.min(Math.abs(dayData.pnl) / 100 * 20, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right panel - Day detail */}
      {selectedDay && (
        <div className="w-80 border-l border-border flex flex-col bg-bg-secondary overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-text-primary font-semibold">{format(new Date(selectedDay + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}</p>
            {dailyMap[selectedDay] && (
              <p className={`text-lg font-bold font-num ${pnlClass(dailyMap[selectedDay]?.pnl)}`}>
                {dailyMap[selectedDay].pnl >= 0 ? '+' : ''}{dailyMap[selectedDay].pnl.toFixed(2)}€
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Weekly Summary */}
            {selectedDay && (() => {
              const selectedDate = new Date(selectedDay + 'T12:00:00')
              const dayOfWeek = selectedDate.getDay() // 0=Sun
              const weekStart = new Date(selectedDate)
              weekStart.setDate(selectedDate.getDate() - dayOfWeek)
              const weekEnd = new Date(weekStart)
              weekEnd.setDate(weekStart.getDate() + 6)
              const fmt = d => d.toISOString().substring(0, 10)
              const weekTrades = trades.filter(t =>
                t.status === 'closed' && t.close_time >= fmt(weekStart) && t.close_time <= fmt(weekEnd) + ' 23:59:59'
              )
              const weekPnl = weekTrades.reduce((s, t) => s + (t.pnl || 0), 0)
              const weekWins = weekTrades.filter(t => t.pnl > 0).length
              if (weekTrades.length === 0) return null
              return (
                <div className="mt-4 p-3 bg-bg-tertiary rounded-xl border border-border">
                  <p className="text-text-muted text-xs font-medium mb-2">Semana del {fmt(weekStart)} al {fmt(weekEnd)}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <p className="font-num text-lg font-bold text-text-primary">{weekTrades.length}</p>
                      <p className="text-text-muted text-xs">trades</p>
                    </div>
                    <div className="text-center">
                      <p className={`font-num text-lg font-bold ${weekPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {weekPnl >= 0 ? '+' : ''}{weekPnl.toFixed(2)}
                      </p>
                      <p className="text-text-muted text-xs">P&L</p>
                    </div>
                    <div className="text-center">
                      <p className={`font-num text-lg font-bold ${weekWins / weekTrades.length >= 0.5 ? 'text-profit' : 'text-loss'}`}>
                        {(weekWins / weekTrades.length * 100).toFixed(0)}%
                      </p>
                      <p className="text-text-muted text-xs">win rate</p>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Day trades */}
            {dayTrades.length > 0 && (
              <div>
                <p className="text-text-muted text-xs uppercase tracking-wider mb-2">Operaciones ({dayTrades.length})</p>
                <div className="space-y-2">
                  {dayTrades.map(t => (
                    <div
                      key={t.id}
                      onClick={() => navigate(`/trades/${t.id}`)}
                      className="p-2 bg-bg-tertiary rounded-lg cursor-pointer hover:bg-bg-hover transition-all border border-border"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-sm">{t.symbol}</span>
                        <span className={`font-num text-sm font-semibold ${pnlClass(t.pnl)}`}>
                          {t.pnl >= 0 ? '+' : ''}{t.pnl?.toFixed(2)}€
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-0.5">
                        <span className={`text-xs ${t.direction === 'BUY' ? 'text-profit' : 'text-loss'}`}>{t.direction}</span>
                        <span className="text-text-muted text-xs">{t.setup || ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Daily notes */}
            <div>
              <p className="text-text-muted text-xs uppercase tracking-wider mb-2">Notas del Día</p>
              <div className="space-y-3">
                <div>
                  <label className="text-text-muted text-xs block mb-1">Humor</label>
                  <select className="input w-full text-xs" value={noteForm.mood}
                    onChange={e => setNoteForm(p => ({ ...p, mood: e.target.value }))}>
                    {['excelente', 'bueno', 'neutral', 'malo', 'muy malo'].map(m =>
                      <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-text-muted text-xs block mb-1">Condiciones de mercado</label>
                  <textarea rows={2} className="input w-full text-xs resize-none"
                    placeholder="Tendencia, volatilidad, noticias..."
                    value={noteForm.market_conditions}
                    onChange={e => setNoteForm(p => ({ ...p, market_conditions: e.target.value }))} />
                </div>
                <div>
                  <label className="text-text-muted text-xs block mb-1">Pre-mercado</label>
                  <textarea rows={2} className="input w-full text-xs resize-none"
                    placeholder="Plan, niveles clave..."
                    value={noteForm.pre_market_notes}
                    onChange={e => setNoteForm(p => ({ ...p, pre_market_notes: e.target.value }))} />
                </div>
                <div>
                  <label className="text-text-muted text-xs block mb-1">Post-mercado</label>
                  <textarea rows={2} className="input w-full text-xs resize-none"
                    placeholder="Reflexión del día..."
                    value={noteForm.post_market_notes}
                    onChange={e => setNoteForm(p => ({ ...p, post_market_notes: e.target.value }))} />
                </div>
                <button onClick={saveNotes} className="btn-primary w-full justify-center text-xs py-2">
                  Guardar Notas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
