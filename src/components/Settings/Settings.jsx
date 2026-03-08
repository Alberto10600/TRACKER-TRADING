import React, { useState, useEffect } from 'react'

export default function Settings({ account, setAccount }) {
  const [form, setForm] = useState({
    account_name: '', initial_balance: 10000, currency: 'EUR',
    risk_per_trade: 1.0, max_daily_loss: 3.0, broker: 'XTB',
  })
  const [setups, setSetups] = useState([])
  const [newSetup, setNewSetup] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (account) setForm({ ...account })
    window.api.setups.getAll().then(setSetups)
  }, [account])

  async function handleSave(e) {
    e.preventDefault()
    await window.api.account.update(form)
    const updated = await window.api.account.get()
    setAccount(updated)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleAddSetup() {
    if (!newSetup.trim()) return
    await window.api.setups.create({ name: newSetup.trim() })
    const s = await window.api.setups.getAll()
    setSetups(s)
    setNewSetup('')
  }

  function set(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 fade-in">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Ajustes</h1>
          <p className="text-text-secondary text-sm">Configura tu cuenta y preferencias</p>
        </div>

        {/* Account */}
        <form onSubmit={handleSave} className="card space-y-4">
          <h2 className="text-text-primary font-semibold border-b border-border pb-2">Cuenta de Trading</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-text-muted text-xs block mb-1">Nombre de la cuenta</label>
              <input className="input w-full" value={form.account_name} onChange={e => set('account_name', e.target.value)} />
            </div>
            <div>
              <label className="text-text-muted text-xs block mb-1">Broker</label>
              <input className="input w-full" value={form.broker} onChange={e => set('broker', e.target.value)} />
            </div>
            <div>
              <label className="text-text-muted text-xs block mb-1">Balance inicial (€)</label>
              <input type="number" step="0.01" className="input w-full font-num" value={form.initial_balance}
                onChange={e => set('initial_balance', parseFloat(e.target.value))} />
            </div>
            <div>
              <label className="text-text-muted text-xs block mb-1">Moneda</label>
              <select className="input w-full" value={form.currency} onChange={e => set('currency', e.target.value)}>
                {['EUR', 'USD', 'GBP', 'CHF', 'JPY'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-text-muted text-xs block mb-1">Riesgo por operación (%)</label>
              <input type="number" step="0.1" min="0.1" max="100" className="input w-full font-num"
                value={form.risk_per_trade} onChange={e => set('risk_per_trade', parseFloat(e.target.value))} />
            </div>
            <div>
              <label className="text-text-muted text-xs block mb-1">Pérdida máxima diaria (%)</label>
              <input type="number" step="0.1" min="0.1" max="100" className="input w-full font-num"
                value={form.max_daily_loss} onChange={e => set('max_daily_loss', parseFloat(e.target.value))} />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary">
              {saved ? '✓ Guardado' : 'Guardar Cambios'}
            </button>
          </div>
        </form>

        {/* Setups */}
        <div className="card space-y-4">
          <h2 className="text-text-primary font-semibold border-b border-border pb-2">Mis Setups</h2>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Nombre del setup..."
              value={newSetup} onChange={e => setNewSetup(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddSetup()} />
            <button onClick={handleAddSetup} className="btn-primary">+ Añadir</button>
          </div>
          <div className="space-y-2">
            {setups.map(s => (
              <div key={s.id} className="flex items-center justify-between px-3 py-2 bg-bg-tertiary rounded-lg border border-border">
                <span className="text-text-primary text-sm font-medium">{s.name}</span>
                {s.description && <span className="text-text-muted text-xs">{s.description}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* App info */}
        <div className="card space-y-2">
          <h2 className="text-text-primary font-semibold border-b border-border pb-2">Información</h2>
          <div className="text-sm space-y-2 text-text-secondary">
            <p>Trading Tracker Pro — Aplicación de escritorio para el seguimiento de operaciones</p>
            <p className="text-text-muted text-xs">Los datos se guardan localmente en tu ordenador. No se envía ningún dato a servidores externos.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
