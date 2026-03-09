'use client'
import { useState, useEffect } from 'react'
import type { Perfil } from '@/lib/types'

const RESTRICCIONES_OPTS = ['vegetariano', 'vegano', 'sin gluten', 'sin lactosa', 'sin frutos secos', 'halal', 'kosher']

const defaultPerfil = (): Partial<Perfil> => ({
  nombre: '',
  calorias_objetivo: 2000,
  proteinas_g: 150,
  carbohidratos_g: 250,
  grasas_g: 65,
  restricciones: [],
  preferencias: [],
  aversiones: [],
  tiempo_cocina_max: 60,
  activo: true,
})

export default function PerfilesPage() {
  const [perfiles, setPerfiles] = useState<Perfil[]>([])
  const [editando, setEditando] = useState<Partial<Perfil> | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [prefInput, setPrefInput] = useState('')
  const [aversInput, setAversInput] = useState('')

  const cargar = () =>
    fetch('/api/perfiles').then(r => r.json()).then(setPerfiles)

  useEffect(() => { cargar() }, [])

  const guardar = async () => {
    if (!editando?.nombre) return
    setGuardando(true)
    try {
      const isNew = !editando.id
      await fetch(isNew ? '/api/perfiles' : `/api/perfiles/${editando.id}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editando),
      })
      await cargar()
      setEditando(null)
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar este perfil?')) return
    await fetch(`/api/perfiles/${id}`, { method: 'DELETE' })
    await cargar()
  }

  const toggleRestriccion = (r: string) => {
    const arr = editando?.restricciones ?? []
    setEditando(prev => ({
      ...prev!,
      restricciones: arr.includes(r) ? arr.filter(x => x !== r) : [...arr, r],
    }))
  }

  const addTag = (field: 'preferencias' | 'aversiones', val: string) => {
    if (!val.trim()) return
    const arr = editando?.[field] ?? []
    if (!arr.includes(val.trim())) {
      setEditando(prev => ({ ...prev!, [field]: [...arr, val.trim()] }))
    }
  }

  const removeTag = (field: 'preferencias' | 'aversiones', val: string) => {
    setEditando(prev => ({ ...prev!, [field]: (prev?.[field] ?? []).filter(x => x !== val) }))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>👥 Perfiles</h1>
        <button className="btn-primary" onClick={() => setEditando(defaultPerfil())}>+ Nuevo perfil</button>
      </div>

      {perfiles.length === 0 && !editando && (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
          <p>No hay perfiles todavía. Crea uno para empezar.</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {perfiles.map(p => (
          <div key={p.id} className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{p.nombre}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
                  {p.activo ? '● Activo' : '○ Inactivo'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={() => { setEditando({ ...p }); setPrefInput(''); setAversInput('') }}>Editar</button>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 16 }}
                  onClick={() => eliminar(p.id)}>✕</button>
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[
                ['🔥 Calorías', `${p.calorias_objetivo} kcal`],
                ['💪 Proteínas', `${p.proteinas_g}g`],
                ['🌾 Carbos', `${p.carbohidratos_g}g`],
                ['🧈 Grasas', `${p.grasas_g}g`],
              ].map(([k, v]) => (
                <div key={k as string} style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 8px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{k}</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>

            {p.restricciones.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {p.restricciones.map(r => <span key={r} className="tag">{r}</span>)}
              </div>
            )}
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              ⏱ Máx. {p.tiempo_cocina_max} min de cocina
            </div>
          </div>
        ))}
      </div>

      {/* Modal de edición */}
      {editando && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div className="card" style={{ width: 540, maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
              {editando.id ? 'Editar perfil' : 'Nuevo perfil'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Nombre *</label>
                <input className="input" value={editando.nombre ?? ''} placeholder="Ej: Ana, Papá..."
                  onChange={e => setEditando(p => ({ ...p!, nombre: e.target.value }))} />
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Objetivos nutricionales diarios</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    ['Calorías (kcal)', 'calorias_objetivo'],
                    ['Proteínas (g)', 'proteinas_g'],
                    ['Carbohidratos (g)', 'carbohidratos_g'],
                    ['Grasas (g)', 'grasas_g'],
                  ].map(([label, field]) => (
                    <div key={field}>
                      <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>{label}</label>
                      <input className="input" type="number" value={(editando as any)[field] ?? ''}
                        onChange={e => setEditando(p => ({ ...p!, [field]: Number(e.target.value) }))} />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Restricciones alimentarias</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {RESTRICCIONES_OPTS.map(r => (
                    <button key={r} onClick={() => toggleRestriccion(r)} style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                      border: '1px solid',
                      borderColor: editando.restricciones?.includes(r) ? 'var(--accent)' : 'var(--border)',
                      background: editando.restricciones?.includes(r) ? 'var(--accent-soft)' : 'var(--bg-secondary)',
                      color: editando.restricciones?.includes(r) ? 'var(--accent)' : 'var(--text-secondary)',
                    }}>{r}</button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Preferencias (cocinas, alimentos favoritos)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                  {editando.preferencias?.map(p => (
                    <span key={p} className="tag">{p} <button onClick={() => removeTag('preferencias', p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 11 }}>✕</button></span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="input" value={prefInput} placeholder="Ej: italiana, pollo, arroz..."
                    onChange={e => setPrefInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { addTag('preferencias', prefInput); setPrefInput('') } }} />
                  <button className="btn-ghost" style={{ flexShrink: 0 }} onClick={() => { addTag('preferencias', prefInput); setPrefInput('') }}>+</button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Aversiones (no me gusta / alergias)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                  {editando.aversiones?.map(a => (
                    <span key={a} style={{ background: '#3a1a1a', color: 'var(--red)' }} className="tag">{a} <button onClick={() => removeTag('aversiones', a)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 11 }}>✕</button></span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="input" value={aversInput} placeholder="Ej: cilantro, berenjena..."
                    onChange={e => setAversInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { addTag('aversiones', aversInput); setAversInput('') } }} />
                  <button className="btn-ghost" style={{ flexShrink: 0 }} onClick={() => { addTag('aversiones', aversInput); setAversInput('') }}>+</button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Tiempo máximo de cocina (minutos)</label>
                <input className="input" type="number" value={editando.tiempo_cocina_max ?? 60}
                  onChange={e => setEditando(p => ({ ...p!, tiempo_cocina_max: Number(e.target.value) }))} />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={editando.activo ?? true}
                  onChange={e => setEditando(p => ({ ...p!, activo: e.target.checked }))} />
                <span style={{ fontSize: 14 }}>Perfil activo (se incluye en la planificación)</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setEditando(null)}>Cancelar</button>
              <button className="btn-primary" onClick={guardar} disabled={guardando || !editando.nombre}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
