import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const EMOTIONS = [
  'Confiado', 'Ansioso', 'FOMO', 'Tranquilo', 'Estresado',
  'Eufórico', 'Miedoso', 'Neutral', 'Impaciente', 'Disciplinado'
]

export default function NewTrade() {
  const navigate = useNavigate()
  const [setups, setSetups] = useState([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    symbol: '', direction: 'BUY', open_time: '', close_time: '',
    open_price: '', close_price: '', volume: '', stop_loss: '', take_profit: '',
    commission: '0', swap: '0', pnl: '', status: 'closed',
    setup: '', session: '', tags: [], emotions_before: [], emotions_after: [],
    rating: 0, notes: '', mistakes: '', lessons: '', followed_plan: true,
    risk_reward: '', risk_amount: '', account_balance: '',
  })

  useEffect(() => {
    window.api.setups.getAll().then(setSetups)
  }, [])

  function set(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  function toggleTag(list, item, key) {
    setForm(prev => ({
      ...prev,
      [key]: prev[key].includes(item) ? prev[key].filter(x => x !== item) : [...prev[key], item]
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const data = {
      ...form,
      open_price: parseFloat(form.open_price) || 0,
      close_price: form.close_price ? parseFloat(form.close_price) : null,
      volume: parseFloat(form.volume) || 0,
      stop_loss: form.stop_loss ? parseFloat(form.stop_loss) : null,
      take_profit: form.take_profit ? parseFloat(form.take_profit) : null,
      commission: parseFloat(form.commission) || 0,
      swap: parseFloat(form.swap) || 0,
      pnl: form.pnl !== '' ? parseFloat(form.pnl) : null,
      risk_reward: form.risk_reward ? parseFloat(form.risk_reward) : null,
      risk_amount: form.risk_amount ? parseFloat(form.risk_amount) : null,
      account_balance: form.account_balance ? parseFloat(form.account_balance) : null,
      followed_plan: form.followed_plan ? 1 : 0,
      position_id: null,
    }
    const result = await window.api.trades.create(data)
    setSaving(false)
    navigate(`/trades/${result.id}`)
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 fade-in max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="btn-secondary">← Atrás</button>
        <h1 className="text-2xl font-bold text-text-primary">Nueva Operación Manual</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="card space-y-4">
          <h2 className="text-text-primary font-semibold text-lg border-b border-border pb-2">Datos de la Operación</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-text-muted text-xs block mb-1">Símbolo *</label>
              <input required className="input w-full uppercase" placeholder="EURUSD" value={form.symbol}
                onChange={e => set('symbol', e.target.value.toUpperCase())} />
            </div>
            <div>
              <label className="text-text-muted text-xs block mb-1">Dirección *</label>
              <select required className="input w-full" value={form.direction} onChange={e => set('direction', e.target.value)}>
                <option value="BUY">BUY (Largo)</option>
                <option value="SELL">SELL (Corto)</option>
              </select>
            </div>
            <div>
              <label className="text-text-muted text-xs block mb-1">Estado</label>
              <select className="input w-full" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="closed">Cerrada</option>
                <option value="open">Abierta</option>
              </select>
            </div>
            <div>
              <label className="text-text-muted text-xs block mb-1">Volumen (Lotes) *</label>
              <input required type="number" step="0.01" className="input w-full font-num" placeholder="0.01"
                value={form.volume} onChange={e => set('volume', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-text-muted text-xs block mb-1">Hora Apertura *</label>
              <input required type="datetime-local" className="input w-full font-num"
                value={form.open_time} onChange={e => set('open_time', e.target.value)} />
            </div>
            <div>
              <label className="text-text-muted text-xs block mb-1">Hora Cierre</label>
              <input type="datetime-local" className="input w-full font-num"
                value={form.close_time} onChange={e => set('close_time', e.target.value)} />
            </div>
            <div>
              <label className="text-text-muted text-xs block mb-1">Precio Apertura *</label>
              <input required type="number" step="any" className="input w-full font-num" placeholder="1.08500"
                value={form.open_price} onChange={e => set('open_price', e.target.value)} />
            </div>
            <div>
              <label className="text-text-muted text-xs block mb-1">Precio Cierre</label>
              <input type="number" step="any" className="input w-full font-num" placeholder="1.09000"
                value={form.close_price} onChange={e => set('close_price', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-text-muted text-xs block mb-1">Stop Loss</label>
              <input type="number" step="any" className="input w-full font-num"
                value={form.stop_loss} onChange={e => set('stop_loss', e.target.value)} />
            </div>
            <div>
              <label className="text-text-muted text-xs block mb-1">Take Profit</label>
              <input type="number" step="any" className="input w-full font-num"
                value={form.take_profit} onChange={e => set('take_profit', e.target.value)} />
            </div>
            <div>
              <label className="text-text-muted text-xs block mb-1">P&L (€)</label>
              <input type="number" step="0.01" className="input w-full font-num" placeholder="25.50"
                value={form.pnl} onChange={e => set('pnl', e.target.value)} />
            </div>
            <div>
              <label className="text-text-muted text-xs block mb-1">R:R (ej: 2.0)</label>
              <input type="number" step="0.1" className="input w-full font-num" placeholder="2.0"
                value={form.risk_reward} onChange={e => set('risk_reward', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-text-muted text-xs block mb-1">Comisión</label>
              <input type="number" step="0.01" className="input w-full font-num"
                value={form.commission} onChange={e => set('commission', e.target.value)} />
            </div>
            <div>
              <label className="text-text-muted text-xs block mb-1">Swap</label>
              <input type="number" step="0.01" className="input w-full font-num"
                value={form.swap} onChange={e => set('swap', e.target.value)} />
            </div>
            <div>
              <label className="text-text-muted text-xs block mb-1">Riesgo (€)</label>
              <input type="number" step="0.01" className="input w-full font-num"
                value={form.risk_amount} onChange={e => set('risk_amount', e.target.value)} />
            </div>
            <div>
              <label className="text-text-muted text-xs block mb-1">Balance Cuenta</label>
              <input type="number" step="0.01" className="input w-full font-num"
                value={form.account_balance} onChange={e => set('account_balance', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Setup & Context */}
        <div className="card space-y-4">
          <h2 className="text-text-primary font-semibold text-lg border-b border-border pb-2">Setup y Contexto</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-text-muted text-xs block mb-1">Setup</label>
              <select className="input w-full" value={form.setup} onChange={e => set('setup', e.target.value)}>
                <option value="">Sin setup</option>
                {setups.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-text-muted text-xs block mb-1">Sesión</label>
              <select className="input w-full" value={form.session} onChange={e => set('session', e.target.value)}>
                <option value="">Sin sesión</option>
                {['Asiática', 'Londres AM', 'Nueva York AM', 'Nueva York PM', 'Pre-Mercado'].map(s =>
                  <option key={s}>{s}</option>
                )}
              </select>
            </div>
          </div>

          {/* Calidad */}
          <div>
            <label className="text-text-muted text-xs block mb-2">Calidad de la operación</label>
            <div className="flex gap-2">
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button"
                  onClick={() => set('rating', form.rating === n ? 0 : n)}
                  className={`text-2xl transition-opacity ${n <= form.rating ? 'opacity-100' : 'opacity-25'}`}>
                  ⭐
                </button>
              ))}
            </div>
          </div>

          {/* Seguí el plan */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.followed_plan}
              onChange={e => set('followed_plan', e.target.checked)}
              className="w-4 h-4 rounded" />
            <span className="text-text-primary text-sm">Seguí mi plan de trading</span>
          </label>
        </div>

        {/* Emotions */}
        <div className="card space-y-4">
          <h2 className="text-text-primary font-semibold text-lg border-b border-border pb-2">Emociones y Psicología</h2>
          <div>
            <label className="text-text-muted text-xs block mb-2">Emociones ANTES de la operación</label>
            <div className="flex flex-wrap gap-2">
              {EMOTIONS.map(e => (
                <button key={e} type="button"
                  onClick={() => toggleTag(form.emotions_before, e, 'emotions_before')}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    form.emotions_before.includes(e)
                      ? 'bg-accent-purple/20 border-accent-purple/50 text-accent-purple'
                      : 'border-border text-text-muted hover:border-accent-purple/30'
                  }`}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-text-muted text-xs block mb-2">Emociones DESPUÉS de la operación</label>
            <div className="flex flex-wrap gap-2">
              {EMOTIONS.map(e => (
                <button key={e} type="button"
                  onClick={() => toggleTag(form.emotions_after, e, 'emotions_after')}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    form.emotions_after.includes(e)
                      ? 'bg-accent-cyan/20 border-accent-cyan/50 text-accent-cyan'
                      : 'border-border text-text-muted hover:border-accent-cyan/30'
                  }`}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card space-y-4">
          <h2 className="text-text-primary font-semibold text-lg border-b border-border pb-2">Notas y Reflexión</h2>
          <div>
            <label className="text-text-muted text-xs block mb-1">Notas de la operación</label>
            <textarea rows={4} className="input w-full resize-none"
              placeholder="¿Por qué entraste? ¿Qué viste en el mercado?"
              value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-text-muted text-xs block mb-1">Errores cometidos</label>
              <textarea rows={3} className="input w-full resize-none"
                placeholder="¿Qué hiciste mal?"
                value={form.mistakes} onChange={e => set('mistakes', e.target.value)} />
            </div>
            <div>
              <label className="text-text-muted text-xs block mb-1">Lecciones aprendidas</label>
              <textarea rows={3} className="input w-full resize-none"
                placeholder="¿Qué aprendiste?"
                value={form.lessons} onChange={e => set('lessons', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 justify-end pb-6">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary px-8">
            {saving ? 'Guardando...' : 'Guardar Operación'}
          </button>
        </div>
      </form>
    </div>
  )
}
