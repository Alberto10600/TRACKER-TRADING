import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import type { Perfil } from '@/lib/types'

export function GET() {
  try {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM perfiles ORDER BY created_at ASC').all() as any[]
    const perfiles: Perfil[] = rows.map(r => ({
      ...r,
      restricciones: JSON.parse(r.restricciones || '[]'),
      preferencias: JSON.parse(r.preferencias || '[]'),
      aversiones: JSON.parse(r.aversiones || '[]'),
      activo: Boolean(r.activo),
    }))
    return NextResponse.json(perfiles)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const db = getDb()
    const id = uuidv4()
    db.prepare(`
      INSERT INTO perfiles (id, nombre, calorias_objetivo, proteinas_g, carbohidratos_g, grasas_g,
        restricciones, preferencias, aversiones, tiempo_cocina_max, activo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      body.nombre,
      body.calorias_objetivo ?? 2000,
      body.proteinas_g ?? 150,
      body.carbohidratos_g ?? 250,
      body.grasas_g ?? 65,
      JSON.stringify(body.restricciones ?? []),
      JSON.stringify(body.preferencias ?? []),
      JSON.stringify(body.aversiones ?? []),
      body.tiempo_cocina_max ?? 60,
      1,
    )
    const perfil = db.prepare('SELECT * FROM perfiles WHERE id = ?').get(id) as any
    return NextResponse.json({
      ...perfil,
      restricciones: JSON.parse(perfil.restricciones),
      preferencias: JSON.parse(perfil.preferencias),
      aversiones: JSON.parse(perfil.aversiones),
      activo: Boolean(perfil.activo),
    }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
