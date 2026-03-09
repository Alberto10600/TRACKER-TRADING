'use client'
import { useState, useEffect } from 'react'
import type { Perfil, HorarioDia, ComidaEstado } from '@/lib/types'

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const COMIDAS = ['desayuno', 'comida', 'cena'] as const
const ESTADOS: { value: ComidaEstado; label: string; color: string }[] = [
  { value: 'casa',   label: '🏠 Casa',   color: 'badge-casa' },
  { value: 'fuera',  label: '🍴 Fuera',  color: 'badge-fuera' },
  { value: 'tupper', label: '📦 Tupper', color: 'badge-tupper' },
  { value: 'skip',   label: '⏭ Skip',   color: 'badge-skip' },
]

function getSemanaISO(date = new Date()): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

export default function PlanificadorPage() {
  const [semana, setSemana] = useState(getSemanaISO())
  const [perfiles, setPerfiles] = useState<Perfil[]>([])
  const [horarios, setHorarios] = useState<HorarioDia[]>([])
  const [guardando, setGuardando] = useState(false)

  const cargar = async (s: string) => {
    const [p, h] = await Promise.all([
      fetch('/api/perfiles').then(r => r.json()),
      fetch(`/api/horario?semana=${s}`).then(r => r.json()),
    ])
    setPerfiles(p.filter((x: Perfil) => x.activo))
    setHorarios(h.horarios ?? [])
  }

  useEffect(() => { cargar(semana) }, [semana])

  const getEstado = (perfil_id: string, dia: string, comida: typeof COMIDAS[number]): ComidaEstado => {
    const h = horarios.find(x => x.perfil_id === perfil_id && x.dia === dia)
    return (h?.[comida] ?? 'casa') as ComidaEstado
  }

  const setEstado = async (perfil_id: string, dia: string, comida: typeof COMIDAS[number], estado: ComidaEstado) => {
    const h = horarios.find(x => x.perfil_id === perfil_id && x.dia === dia) ?? {
      perfil_id, dia, desayuno: 'casa', comida: 'casa', cena: 'casa',
    }
    const updated = { ...h, [comida]: estado }
    setHorarios(prev => {
      const idx = prev.findIndex(x => x.perfil_id === perfil_id && x.dia === dia)
      if (idx >= 0) { const n = [...prev]; n[idx] = updated as HorarioDia; return n }
      return [...prev, updated as HorarioDia]
    })

    setGuardando(true)
    try {
      await fetch('/api/horario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semana, ...updated }),
      })
    } finally {
      setGuardando(false)
    }
  }

  const semanaAnterior = () => {
    const [y, w] = semana.split('-W').map(Number)
    const d = new Date(y, 0, 1 + (w - 1) * 7)
    d.setDate(d.getDate() - 7)
    setSemana(getSemanaISO(d))
  }

  const semanaSiguiente = () => {
    const [y, w] = semana.split('-W').map(Number)
    const d = new Date(y, 0, 1 + (w - 1) * 7)
    d.setDate(d.getDate() + 7)
    setSemana(getSemanaISO(d))
  }

  if (perfiles.length === 0) {
    return (
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>📅 Planificador Semanal</h1>
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p>Primero debes crear al menos un perfil activo.</p>
          <a href="/perfiles" style={{ color: 'var(--accent)', marginTop: 8, display: 'inline-block' }}>Ir a Perfiles →</a>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>📅 Planificador Semanal</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {guardando && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Guardando...</span>}
          <button className="btn-ghost" onClick={semanaAnterior}>← Anterior</button>
          <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{semana}</span>
          <button className="btn-ghost" onClick={semanaSiguiente}>Siguiente →</button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>
                Perfil
              </th>
              {DIAS.map(dia => (
                <th key={dia} style={{ padding: '8px 6px', color: 'var(--text-secondary)', fontWeight: 500, borderBottom: '1px solid var(--border)', textAlign: 'center', textTransform: 'capitalize' }}>
                  {dia.slice(0, 3)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {perfiles.map(perfil => (
              COMIDAS.map((comida, ci) => (
                <tr key={`${perfil.id}-${comida}`} style={{
                  borderBottom: ci === 2 ? '2px solid var(--border)' : '1px solid #1e1e2e',
                }}>
                  <td style={{ padding: '6px 12px', fontWeight: ci === 0 ? 600 : 400, color: ci === 0 ? 'var(--text-primary)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {ci === 0 ? perfil.nombre : ''}
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: ci === 0 ? 8 : 0 }}>
                      {comida}
                    </span>
                  </td>
                  {DIAS.map(dia => {
                    const estado = getEstado(perfil.id, dia, comida)
                    const estadoInfo = ESTADOS.find(e => e.value === estado)!
                    return (
                      <td key={dia} style={{ padding: '4px 3px', textAlign: 'center' }}>
                        <select
                          value={estado}
                          onChange={e => setEstado(perfil.id, dia, comida, e.target.value as ComidaEstado)}
                          className={`badge-${estado}`}
                          style={{
                            border: 'none', borderRadius: 6, padding: '3px 6px',
                            fontSize: 11, cursor: 'pointer', fontWeight: 500,
                            width: '100%', textAlign: 'center',
                          }}
                        >
                          {ESTADOS.map(e => (
                            <option key={e.value} value={e.value}>{e.label}</option>
                          ))}
                        </select>
                      </td>
                    )
                  })}
                </tr>
              ))
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {ESTADOS.map(e => (
          <span key={e.value} className={`badge-${e.value}`} style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12 }}>
            {e.label}
          </span>
        ))}
      </div>
    </div>
  )
}
