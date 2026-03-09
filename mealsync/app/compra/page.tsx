'use client'
import { useState, useEffect } from 'react'
import type { MenuSemanal, ItemCompra, ItemDespensa } from '@/lib/types'
import { generarListaCompra } from '@/lib/utils'

function getSemanaISO(date = new Date()): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

export default function CompraPage() {
  const [semana] = useState(getSemanaISO())
  const [menu, setMenu] = useState<MenuSemanal | null>(null)
  const [lista, setLista] = useState<ItemCompra[]>([])
  const [despensa, setDespensa] = useState<ItemDespensa[]>([])
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [filtroCat, setFiltroCat] = useState<string>('Todas')
  const [newItem, setNewItem] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const cargar = async () => {
      setCargando(true)
      try {
        const [menuR, despR] = await Promise.all([
          fetch(`/api/generar-menu?semana=${semana}`).then(r => r.ok ? r.json() : null),
          fetch('/api/despensa').then(r => r.json()),
        ])
        if (menuR) {
          setMenu(menuR)
          const items = generarListaCompra(menuR)
          // Marcar los que ya están en despensa
          const despensaNames = new Set((despR as ItemDespensa[]).map(d => d.ingrediente.toLowerCase()))
          const inicial = new Set<string>()
          items.forEach(i => { if (despensaNames.has(i.nombre.toLowerCase())) inicial.add(i.nombre) })
          setMarcados(inicial)
          setLista(items)
        }
        setDespensa(despR)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [semana])

  const categorias = ['Todas', ...Array.from(new Set(lista.map(i => i.categoria))).sort()]
  const listaFiltrada = filtroCat === 'Todas' ? lista : lista.filter(i => i.categoria === filtroCat)
  const pendientes = listaFiltrada.filter(i => !marcados.has(i.nombre))
  const comprados = listaFiltrada.filter(i => marcados.has(i.nombre))

  const toggleMarcado = (nombre: string) => {
    setMarcados(prev => {
      const n = new Set(prev)
      if (n.has(nombre)) n.delete(nombre)
      else n.add(nombre)
      return n
    })
  }

  const addDespensa = async () => {
    if (!newItem.trim()) return
    await fetch('/api/despensa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingrediente: newItem.trim() }),
    })
    setNewItem('')
    const d = await fetch('/api/despensa').then(r => r.json())
    setDespensa(d)
  }

  const removeDespensa = async (id: string) => {
    await fetch(`/api/despensa?id=${id}`, { method: 'DELETE' })
    setDespensa(prev => prev.filter(d => d.id !== id))
  }

  const totalPendientes = lista.filter(i => !marcados.has(i.nombre)).length

  if (cargando) return <div style={{ color: 'var(--text-secondary)', padding: 20 }}>Cargando...</div>

  if (!menu) return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>🛒 Lista de la Compra</h1>
      <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
        <p>Primero genera un menú semanal.</p>
        <a href="/menu" style={{ color: 'var(--accent)', marginTop: 8, display: 'inline-block' }}>Ir a Menú Semanal →</a>
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>🛒 Lista de la Compra</h1>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>
            {semana} · {totalPendientes} artículos pendientes de {lista.length} total
          </div>
        </div>
        <button className="btn-ghost" onClick={() => setMarcados(new Set())}>Desmarcar todo</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, alignItems: 'start' }}>
        {/* Lista principal */}
        <div>
          {/* Filtros por categoría */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {categorias.map(cat => (
              <button key={cat} onClick={() => setFiltroCat(cat)} style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid',
                borderColor: filtroCat === cat ? 'var(--accent)' : 'var(--border)',
                background: filtroCat === cat ? 'var(--accent-soft)' : 'var(--bg-secondary)',
                color: filtroCat === cat ? 'var(--accent)' : 'var(--text-secondary)',
              }}>{cat}</button>
            ))}
          </div>

          {/* Pendientes */}
          {pendientes.length > 0 && (
            <div className="card" style={{ padding: 16, marginBottom: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Por comprar ({pendientes.length})
              </h3>
              {pendientes.map(item => (
                <div key={item.nombre} onClick={() => toggleMarcado(item.nombre)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', cursor: 'pointer', borderRadius: 6, transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: '2px solid var(--border)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 500, fontSize: 14 }}>{item.nombre}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13, marginLeft: 8 }}>{item.cantidad} {item.unidad}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.categoria}</span>
                </div>
              ))}
            </div>
          )}

          {/* Comprados */}
          {comprados.length > 0 && (
            <div className="card" style={{ padding: 16, opacity: 0.7 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Ya comprado / En despensa ({comprados.length})
              </h3>
              {comprados.map(item => (
                <div key={item.nombre} onClick={() => toggleMarcado(item.nombre)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', cursor: 'pointer', borderRadius: 6 }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: '2px solid var(--accent)', background: 'var(--accent)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'white', fontSize: 11 }}>✓</span>
                  </div>
                  <span style={{ fontSize: 14, textDecoration: 'line-through', color: 'var(--text-secondary)' }}>{item.nombre}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{item.cantidad} {item.unidad}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Despensa */}
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🏠 Despensa Virtual</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Los ingredientes que tengas aquí se marcarán automáticamente como disponibles.
          </p>

          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <input className="input" value={newItem} placeholder="Añadir ingrediente..."
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addDespensa()} />
            <button className="btn-primary" style={{ flexShrink: 0 }} onClick={addDespensa}>+</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflowY: 'auto' }}>
            {despensa.map(d => (
              <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 6px', background: 'var(--bg-secondary)', borderRadius: 6 }}>
                <span style={{ fontSize: 13 }}>{d.ingrediente}</span>
                <button onClick={() => removeDespensa(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 14 }}>✕</button>
              </div>
            ))}
            {despensa.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: 10 }}>Vacía</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
