'use client'
import { useState, useEffect, useRef } from 'react'
import type { MenuSemanal, DiaMenu, ComidaMenu } from '@/lib/types'
import { generarListaCompra } from '@/lib/utils'

function getSemanaISO(date = new Date()): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function RecetaCard({ comida, tipo }: { comida: ComidaMenu; tipo: string }) {
  const [open, setOpen] = useState(false)
  const r = comida.receta
  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 12px', marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tipo}</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{r.nombre}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
            ⏱ {r.tiempo_prep + r.tiempo_cocina} min · 🔥 {r.calorias_por_porcion} kcal/ración
          </div>
        </div>
        <button onClick={() => setOpen(x => !x)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 18 }}>
          {open ? '▲' : '▼'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
            {[['💪', 'Proteínas', `${r.proteinas}g`], ['🌾', 'Carbos', `${r.carbohidratos}g`], ['🧈', 'Grasas', `${r.grasas}g`]].map(([icon, label, val]) => (
              <div key={label} style={{ background: 'var(--bg-card)', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 16 }}>{icon}</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{val}</div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>INGREDIENTES ({r.porciones} raciones)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {r.ingredientes.map((ing, i) => (
                <div key={i} style={{ fontSize: 13, display: 'flex', gap: 6 }}>
                  <span style={{ color: 'var(--accent)' }}>•</span>
                  <span>{ing.cantidad} {ing.unidad} <strong>{ing.nombre}</strong></span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>PREPARACIÓN</div>
            <ol style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {r.pasos.map((paso, i) => (
                <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{paso}</li>
              ))}
            </ol>
          </div>

          {r.notas && (
            <div style={{ marginTop: 8, padding: '6px 10px', background: 'var(--accent-soft)', borderRadius: 6, fontSize: 12, color: 'var(--accent)' }}>
              💡 {r.notas}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function MenuPage() {
  const [semana, setSemana] = useState(getSemanaISO())
  const [menu, setMenu] = useState<MenuSemanal | null>(null)
  const [generando, setGenerando] = useState(false)
  const [progreso, setProgreso] = useState('')
  const [error, setError] = useState('')
  const textoRef = useRef('')

  const cargarMenu = async (s: string) => {
    const r = await fetch(`/api/generar-menu?semana=${s}`)
    if (r.ok) setMenu(await r.json())
    else setMenu(null)
  }

  useEffect(() => { cargarMenu(semana) }, [semana])

  const generar = async () => {
    setGenerando(true)
    setError('')
    setProgreso('Pensando en tu menú personalizado...')
    textoRef.current = ''

    try {
      const resp = await fetch('/api/generar-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semana }),
      })

      if (!resp.ok) {
        const err = await resp.json()
        setError(err.error ?? 'Error generando el menú')
        return
      }

      const reader = resp.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        textoRef.current += chunk

        if (chunk.includes('__MENU_GUARDADO__')) {
          setProgreso('¡Menú generado y guardado!')
          await cargarMenu(semana)
          break
        }

        const lines = textoRef.current.split('\n').filter(Boolean)
        const lastLine = lines[lines.length - 1] ?? ''
        if (lastLine.length > 5 && !lastLine.startsWith('```')) {
          setProgreso(lastLine.slice(0, 80) + (lastLine.length > 80 ? '...' : ''))
        }
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setGenerando(false)
    }
  }

  const semanaSig = (dir: 1 | -1) => {
    const [y, w] = semana.split('-W').map(Number)
    const d = new Date(y, 0, 1 + (w - 1) * 7)
    d.setDate(d.getDate() + dir * 7)
    setSemana(getSemanaISO(d))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>🍽️ Menú Semanal</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn-ghost" onClick={() => semanaSig(-1)}>← Anterior</button>
          <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{semana}</span>
          <button className="btn-ghost" onClick={() => semanaSig(1)}>Siguiente →</button>
          <button className="btn-primary" onClick={generar} disabled={generando}>
            {generando ? '⏳ Generando...' : '✨ Generar menú'}
          </button>
        </div>
      </div>

      {generando && (
        <div className="card" style={{ padding: 20, marginBottom: 16, borderColor: 'var(--accent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{progreso}</span>
          </div>
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 16px', background: '#2a1a1a', border: '1px solid var(--red)', borderRadius: 8, marginBottom: 16, color: 'var(--red)', fontSize: 14 }}>
          {error}
        </div>
      )}

      {!menu && !generando && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🍴</div>
          <p style={{ marginBottom: 16 }}>No hay menú para {semana}.</p>
          <p style={{ fontSize: 13, marginBottom: 20 }}>Asegúrate de tener perfiles activos y horarios configurados.</p>
          <button className="btn-primary" onClick={generar}>✨ Generar menú ahora</button>
        </div>
      )}

      {menu && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {menu.dias.map((dia: DiaMenu) => (
            <div key={dia.dia} className="card" style={{ padding: 16 }}>
              <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, textTransform: 'capitalize', color: 'var(--accent)' }}>
                {dia.dia}
              </h3>
              {dia.desayuno && <RecetaCard comida={dia.desayuno} tipo="Desayuno" />}
              {dia.comida && <RecetaCard comida={dia.comida} tipo="Comida" />}
              {dia.cena && <RecetaCard comida={dia.cena} tipo="Cena" />}
              {!dia.desayuno && !dia.comida && !dia.cena && (
                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Sin comidas planificadas en casa</p>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
