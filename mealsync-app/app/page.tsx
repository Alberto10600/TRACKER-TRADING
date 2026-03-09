import Link from 'next/link'

const cards = [
  { href: '/perfiles',     icon: '👥', title: 'Perfiles',        desc: 'Configura las necesidades nutricionales de cada miembro de la familia' },
  { href: '/planificador', icon: '📅', title: 'Planificador',    desc: 'Marca quién come en casa cada día de la semana' },
  { href: '/menu',         icon: '🍽️', title: 'Menú Semanal',    desc: 'Genera y consulta el menú semanal personalizado con IA' },
  { href: '/compra',       icon: '🛒', title: 'Lista de Compra', desc: 'Lista optimizada de ingredientes con toda la semana' },
]

export default function Home() {
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
          Bienvenido a <span style={{ color: 'var(--accent)' }}>MealSync</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, maxWidth: 520 }}>
          Planifica los menús de toda la familia de forma inteligente. Configura perfiles,
          organiza los horarios semanales y deja que la IA genere menús equilibrados y
          la lista de la compra optimizada.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {cards.map(c => (
          <Link key={c.href} href={c.href} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ padding: 20, cursor: 'pointer', transition: 'border-color 0.15s' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>{c.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>{c.title}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>{c.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="card" style={{ marginTop: 32, padding: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>🚀 Cómo empezar</h2>
        <ol style={{ paddingLeft: 20, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 2 }}>
          <li>Ve a <strong style={{ color: 'var(--text-primary)' }}>Perfiles</strong> y crea un perfil por cada miembro de la familia</li>
          <li>Ve al <strong style={{ color: 'var(--text-primary)' }}>Planificador</strong> y marca los horarios de esta semana</li>
          <li>En <strong style={{ color: 'var(--text-primary)' }}>Menú Semanal</strong> pulsa &quot;Generar menú&quot; para que la IA planifique</li>
          <li>Consulta la <strong style={{ color: 'var(--text-primary)' }}>Lista de Compra</strong> con todos los ingredientes necesarios</li>
        </ol>
      </div>
    </div>
  )
}
