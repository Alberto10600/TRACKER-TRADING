import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { pnlClass, formatCurrency } from '../../utils/tradeMetrics'

const EMOTIONS = [
  'Confiado', 'Ansioso', 'FOMO', 'Tranquilo', 'Estresado',
  'Eufórico', 'Miedoso', 'Neutral', 'Impaciente', 'Disciplinado'
]
const IMAGE_TYPES = ['chart', 'entry', 'exit', 'analysis', 'other']
const IMAGE_TYPE_LABELS = { chart: 'Gráfico', entry: 'Entrada', exit: 'Salida', analysis: 'Análisis', other: 'Otro' }
const TIMEFRAMES = ['1M', '5M', '15M', '30M', '1H', '4H', 'D1', 'W1']

export default function TradeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [trade, setTrade] = useState(null)
  const [setups, setSetups] = useState([])
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({})
  const [uploadingImage, setUploadingImage] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePaths, setImagePaths] = useState({})

  useEffect(() => {
    loadTrade()
    window.api.setups.getAll().then(setSetups)
  }, [id])

  async function loadTrade() {
    const t = await window.api.trades.getById(parseInt(id))
    if (!t) { navigate('/trades'); return }
    setTrade(t)
    setForm({
      ...t,
      tags: Array.isArray(t.tags) ? t.tags : [],
      emotions_before: Array.isArray(t.emotions_before) ? t.emotions_before : [],
      emotions_after: Array.isArray(t.emotions_after) ? t.emotions_after : [],
      needs_review: t?.needs_review || false,
    })
    // Load image paths
    if (t.images?.length) {
      const paths = {}
      for (const img of t.images) {
        paths[img.id] = await window.api.images.getPath(img.filename)
      }
      setImagePaths(paths)
    }
  }

  async function handleSave() {
    setSaving(true)
    await window.api.trades.update({
      id: parseInt(id),
      ...form,
      stop_loss: form.stop_loss ? parseFloat(form.stop_loss) : null,
      take_profit: form.take_profit ? parseFloat(form.take_profit) : null,
      risk_reward: form.risk_reward ? parseFloat(form.risk_reward) : null,
      risk_amount: form.risk_amount ? parseFloat(form.risk_amount) : null,
      followed_plan: form.followed_plan ? 1 : 0,
      needs_review: form.needs_review ? 1 : 0,
    })
    setSaving(false)
    setEditing(false)
    loadTrade()
  }

  async function handleAddImage() {
    const result = await window.api.dialog.openImage()
    if (result.canceled) return
    setUploadingImage(true)
    for (const filePath of result.filePaths) {
      await window.api.images.save({
        tradeId: parseInt(id),
        filePath,
        type: 'chart',
        timeframe: '',
        notes: '',
        originalName: filePath.split(/[\\/]/).pop(),
      })
    }
    setUploadingImage(false)
    loadTrade()
  }

  async function handleDeleteImage(imageId) {
    await window.api.images.delete(imageId)
    loadTrade()
  }

  async function handleDeleteTrade() {
    if (!confirm('¿Eliminar esta operación? Esta acción no se puede deshacer.')) return
    await window.api.trades.delete(parseInt(id))
    navigate('/trades')
  }

  function set(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  function toggleEmotion(list, item, key) {
    setForm(prev => ({
      ...prev,
      [key]: prev[key].includes(item) ? prev[key].filter(x => x !== item) : [...prev[key], item]
    }))
  }

  if (!trade) {
    return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="flex-1 overflow-y-auto fade-in">
      {/* Header bar */}
      <div className="sticky top-0 z-10 bg-bg-secondary border-b border-border px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/trades')} className="btn-secondary text-xs py-1.5">← Atrás</button>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-text-primary">{trade.symbol}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${trade.direction === 'BUY' ? 'text-profit bg-profit/10' : 'text-loss bg-loss/10'}`}>
              {trade.direction}
            </span>
            <span className={`text-sm font-semibold font-num ${pnlClass(trade.pnl)}`}>
              {trade.pnl !== null ? `${trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)} €` : 'Abierta'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleAddImage} disabled={uploadingImage} className="btn-secondary text-xs py-1.5">
            📷 {uploadingImage ? 'Subiendo...' : 'Añadir imagen'}
          </button>
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); setForm({ ...trade }) }} className="btn-secondary text-xs py-1.5">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-1.5">
                {saving ? 'Guardando...' : '✓ Guardar'}
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-primary text-xs py-1.5">✏️ Editar</button>
          )}
          <button onClick={handleDeleteTrade} className="btn-danger text-xs py-1.5">🗑️</button>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Trade info grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Stats */}
          <div className="lg:col-span-2 card">
            <h3 className="text-text-primary font-semibold mb-4 border-b border-border pb-2">Datos de la Operación</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <InfoField label="Símbolo" value={trade.symbol} />
              <InfoField label="Dirección" value={
                <span className={trade.direction === 'BUY' ? 'text-profit font-semibold' : 'text-loss font-semibold'}>
                  {trade.direction}
                </span>
              } />
              <InfoField label="Volumen" value={<span className="font-num">{trade.volume}</span>} />
              <InfoField label="Estado" value={
                <span className={`text-xs px-2 py-0.5 rounded ${trade.status === 'closed' ? 'bg-bg-tertiary text-text-secondary' : 'bg-profit/10 text-profit'}`}>
                  {trade.status === 'closed' ? 'Cerrada' : 'Abierta'}
                </span>
              } />
              <InfoField label="Apertura" value={<span className="font-num text-xs">{trade.open_time?.substring(0,16)}</span>} />
              <InfoField label="Cierre" value={<span className="font-num text-xs">{trade.close_time?.substring(0,16) || '—'}</span>} />
              <InfoField label="Precio entrada" value={<span className="font-num">{trade.open_price?.toFixed(5)}</span>} />
              <InfoField label="Precio salida" value={<span className="font-num">{trade.close_price?.toFixed(5) || '—'}</span>} />
              <InfoField label="Stop Loss" value={<span className="font-num text-loss">{trade.stop_loss || '—'}</span>} />
              <InfoField label="Take Profit" value={<span className="font-num text-profit">{trade.take_profit || '—'}</span>} />
              <InfoField label="Comisión" value={<span className="font-num">{trade.commission?.toFixed(2) || '0.00'}</span>} />
              <InfoField label="Swap" value={<span className="font-num">{trade.swap?.toFixed(2) || '0.00'}</span>} />
            </div>
          </div>

          {/* Performance */}
          <div className="card space-y-4">
            <h3 className="text-text-primary font-semibold border-b border-border pb-2">Rendimiento</h3>
            <div className="text-center py-2">
              <p className="text-text-muted text-xs mb-1">P&L</p>
              <p className={`text-4xl font-bold font-num ${pnlClass(trade.pnl)}`}>
                {trade.pnl !== null ? `${trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}€` : '—'}
              </p>
              {trade.risk_amount > 0 && trade.pnl !== null && (
                <p className={`text-sm font-num font-semibold ${trade.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {trade.pnl >= 0 ? '+' : ''}{(trade.pnl / trade.risk_amount).toFixed(2)}R
                </p>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">R:R Real</span>
                <span className="font-num font-medium">{trade.risk_reward ? `1:${Number(trade.risk_reward).toFixed(2)}` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Riesgo</span>
                <span className="font-num">{trade.risk_amount ? `${trade.risk_amount.toFixed(2)}€` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Setup</span>
                <span className="text-text-secondary">{trade.setup || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Sesión</span>
                <span className="text-text-secondary">{trade.session || '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Calidad</span>
                <span>{trade.rating ? '⭐'.repeat(trade.rating) : '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Seguí el plan</span>
                <span className={trade.followed_plan ? 'text-profit' : 'text-loss'}>
                  {trade.followed_plan ? '✓ Sí' : '✗ No'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-text-primary font-semibold">Capturas de Pantalla</h3>
            <button onClick={handleAddImage} className="btn-secondary text-xs py-1.5">+ Añadir</button>
          </div>
          {trade.images?.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {trade.images.map(img => (
                <div key={img.id} className="group relative">
                  <div
                    className="aspect-video bg-bg-tertiary rounded-lg overflow-hidden cursor-pointer border border-border hover:border-accent-blue/50 transition-all"
                    onClick={() => setSelectedImage(img)}
                  >
                    <img
                      src={`file://${imagePaths[img.id]}`}
                      alt={img.original_name}
                      className="w-full h-full object-cover"
                      onError={e => { e.target.style.display = 'none' }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                      <span className="text-white text-xs">Ver</span>
                    </div>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-text-muted text-xs truncate">{IMAGE_TYPE_LABELS[img.type] || img.type} {img.timeframe && `· ${img.timeframe}`}</span>
                    <button onClick={() => handleDeleteImage(img.id)} className="text-text-muted hover:text-loss text-xs ml-1">✕</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              onClick={handleAddImage}
              className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-accent-blue/50 hover:bg-bg-hover transition-all"
            >
              <p className="text-4xl mb-2">📸</p>
              <p className="text-text-muted text-sm">Arrastra imágenes o haz clic para añadir capturas de tus trades</p>
            </div>
          )}
        </div>

        {/* Edit form / view for psychology & notes */}
        {editing ? (
          <EditForm form={form} set={set} setups={setups} toggleEmotion={toggleEmotion} />
        ) : (
          <ViewNotes trade={trade} />
        )}
      </div>

      {/* Image lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8"
          onClick={() => setSelectedImage(null)}
        >
          <div className="max-w-5xl max-h-full" onClick={e => e.stopPropagation()}>
            <img
              src={`file://${imagePaths[selectedImage.id]}`}
              alt={selectedImage.original_name}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
            <div className="mt-3 flex items-center justify-between">
              <p className="text-white/70 text-sm">{selectedImage.original_name} · {IMAGE_TYPE_LABELS[selectedImage.type]} {selectedImage.timeframe && `· ${selectedImage.timeframe}`}</p>
              <button onClick={() => setSelectedImage(null)} className="text-white/50 hover:text-white">✕ Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoField({ label, value }) {
  return (
    <div>
      <p className="text-text-muted text-xs mb-0.5">{label}</p>
      <div className="text-text-primary">{value}</div>
    </div>
  )
}

function ViewNotes({ trade }) {
  const emotions_before = Array.isArray(trade.emotions_before) ? trade.emotions_before : []
  const emotions_after = Array.isArray(trade.emotions_after) ? trade.emotions_after : []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Psychology */}
      <div className="card space-y-4">
        <h3 className="text-text-primary font-semibold border-b border-border pb-2">Psicología</h3>
        {emotions_before.length > 0 && (
          <div>
            <p className="text-text-muted text-xs mb-2">Antes</p>
            <div className="flex flex-wrap gap-1">
              {emotions_before.map(e => <span key={e} className="px-2 py-0.5 bg-accent-purple/10 text-accent-purple rounded-full text-xs border border-accent-purple/20">{e}</span>)}
            </div>
          </div>
        )}
        {emotions_after.length > 0 && (
          <div>
            <p className="text-text-muted text-xs mb-2">Después</p>
            <div className="flex flex-wrap gap-1">
              {emotions_after.map(e => <span key={e} className="px-2 py-0.5 bg-accent-cyan/10 text-accent-cyan rounded-full text-xs border border-accent-cyan/20">{e}</span>)}
            </div>
          </div>
        )}
        {emotions_before.length === 0 && emotions_after.length === 0 && (
          <p className="text-text-muted text-sm italic">Sin datos de emociones. Edita para añadir.</p>
        )}
      </div>

      {/* Notes */}
      <div className="card space-y-4">
        <h3 className="text-text-primary font-semibold border-b border-border pb-2">Notas</h3>
        {trade.notes ? (
          <div>
            <p className="text-text-muted text-xs mb-1">Notas</p>
            <p className="text-text-secondary text-sm whitespace-pre-wrap">{trade.notes}</p>
          </div>
        ) : null}
        {trade.mistakes ? (
          <div>
            <p className="text-loss text-xs mb-1">✗ Errores</p>
            <p className="text-text-secondary text-sm whitespace-pre-wrap">{trade.mistakes}</p>
          </div>
        ) : null}
        {trade.lessons ? (
          <div>
            <p className="text-profit text-xs mb-1">✓ Lecciones</p>
            <p className="text-text-secondary text-sm whitespace-pre-wrap">{trade.lessons}</p>
          </div>
        ) : null}
        {!trade.notes && !trade.mistakes && !trade.lessons && (
          <p className="text-text-muted text-sm italic">Sin notas. Edita para añadir reflexiones.</p>
        )}
      </div>
    </div>
  )
}

function EditForm({ form, set, setups, toggleEmotion }) {
  return (
    <div className="space-y-4">
      {/* Setup & Quality */}
      <div className="card space-y-4">
        <h3 className="text-text-primary font-semibold border-b border-border pb-2">Setup y Calidad</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-text-muted text-xs block mb-1">Setup</label>
            <select className="input w-full" value={form.setup || ''} onChange={e => set('setup', e.target.value)}>
              <option value="">Sin setup</option>
              {setups.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-text-muted text-xs block mb-1">Sesión</label>
            <select className="input w-full" value={form.session || ''} onChange={e => set('session', e.target.value)}>
              <option value="">Sin sesión</option>
              {['Asiática', 'Londres AM', 'Nueva York AM', 'Nueva York PM', 'Pre-Mercado'].map(s =>
                <option key={s}>{s}</option>
              )}
            </select>
          </div>
          <div>
            <label className="text-text-muted text-xs block mb-1">R:R</label>
            <input type="number" step="0.1" className="input w-full font-num"
              value={form.risk_reward || ''} onChange={e => set('risk_reward', e.target.value)} />
          </div>
          <div>
            <label className="text-text-muted text-xs block mb-1">Riesgo (€)</label>
            <input type="number" step="0.01" className="input w-full font-num"
              value={form.risk_amount || ''} onChange={e => set('risk_amount', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-text-muted text-xs block mb-2">Calidad</label>
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
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={!!form.followed_plan}
            onChange={e => set('followed_plan', e.target.checked)}
            className="w-4 h-4 rounded" />
          <span className="text-text-primary text-sm">Seguí mi plan de trading</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="needs_review"
            className="rounded"
            checked={!!form.needs_review}
            onChange={e => set('needs_review', e.target.checked)}
          />
          <label htmlFor="needs_review" className="text-text-secondary text-sm cursor-pointer">
            Pendiente de revisión post-sesión
          </label>
        </div>
      </div>

      {/* Emotions */}
      <div className="card space-y-4">
        <h3 className="text-text-primary font-semibold border-b border-border pb-2">Psicología y Emociones</h3>
        <div>
          <p className="text-text-muted text-xs mb-2">Antes de la operación</p>
          <div className="flex flex-wrap gap-2">
            {EMOTIONS.map(e => (
              <button key={e} type="button"
                onClick={() => toggleEmotion(form.emotions_before, e, 'emotions_before')}
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
          <p className="text-text-muted text-xs mb-2">Después de la operación</p>
          <div className="flex flex-wrap gap-2">
            {EMOTIONS.map(e => (
              <button key={e} type="button"
                onClick={() => toggleEmotion(form.emotions_after, e, 'emotions_after')}
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
        <h3 className="text-text-primary font-semibold border-b border-border pb-2">Notas y Reflexión</h3>
        <div>
          <label className="text-text-muted text-xs block mb-1">Notas generales</label>
          <textarea rows={4} className="input w-full resize-none"
            placeholder="¿Por qué entraste? ¿Qué viste en el mercado?"
            value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-loss text-xs block mb-1">Errores cometidos</label>
            <textarea rows={3} className="input w-full resize-none"
              placeholder="¿Qué hiciste mal?"
              value={form.mistakes || ''} onChange={e => set('mistakes', e.target.value)} />
          </div>
          <div>
            <label className="text-profit text-xs block mb-1">Lecciones aprendidas</label>
            <textarea rows={3} className="input w-full resize-none"
              placeholder="¿Qué aprendiste de esta operación?"
              value={form.lessons || ''} onChange={e => set('lessons', e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  )
}
