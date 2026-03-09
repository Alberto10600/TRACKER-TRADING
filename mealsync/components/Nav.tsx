'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/',              label: 'Inicio',       icon: '🏠' },
  { href: '/perfiles',      label: 'Perfiles',     icon: '👥' },
  { href: '/planificador',  label: 'Planificador', icon: '📅' },
  { href: '/menu',          label: 'Menú Semanal', icon: '🍽️' },
  { href: '/compra',        label: 'Compra',       icon: '🛒' },
]

export default function Nav() {
  const path = usePathname()

  return (
    <nav style={{
      width: 220,
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      padding: '24px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      flexShrink: 0,
    }}>
      <div style={{ padding: '0 8px 20px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>🥗 MealSync</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Planificador familiar</div>
      </div>

      {links.map(l => {
        const active = path === l.href || (l.href !== '/' && path.startsWith(l.href))
        return (
          <Link key={l.href} href={l.href} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 12px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: active ? 600 : 400,
            color: active ? 'var(--accent)' : 'var(--text-secondary)',
            background: active ? 'var(--accent-soft)' : 'transparent',
            textDecoration: 'none',
            transition: 'all 0.15s',
          }}>
            <span style={{ fontSize: 16 }}>{l.icon}</span>
            {l.label}
          </Link>
        )
      })}
    </nav>
  )
}
