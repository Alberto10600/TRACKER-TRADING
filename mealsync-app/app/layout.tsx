import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/components/Nav'

export const metadata: Metadata = {
  title: 'MealSync — Planificador de menús familiar',
  description: 'Organiza menús semanales, compras y recetas para toda la familia',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <Nav />
          <main style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
