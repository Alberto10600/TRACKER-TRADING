import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const db = getDb()
    db.prepare(`
      UPDATE perfiles SET
        nombre = ?, calorias_objetivo = ?, proteinas_g = ?, carbohidratos_g = ?, grasas_g = ?,
        restricciones = ?, preferencias = ?, aversiones = ?, tiempo_cocina_max = ?, activo = ?
      WHERE id = ?
    `).run(
      body.nombre,
      body.calorias_objetivo,
      body.proteinas_g,
      body.carbohidratos_g,
      body.grasas_g,
      JSON.stringify(body.restricciones ?? []),
      JSON.stringify(body.preferencias ?? []),
      JSON.stringify(body.aversiones ?? []),
      body.tiempo_cocina_max,
      body.activo ? 1 : 0,
      id,
    )
    const perfil = db.prepare('SELECT * FROM perfiles WHERE id = ?').get(id) as any
    return NextResponse.json({
      ...perfil,
      restricciones: JSON.parse(perfil.restricciones),
      preferencias: JSON.parse(perfil.preferencias),
      aversiones: JSON.parse(perfil.aversiones),
      activo: Boolean(perfil.activo),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const db = getDb()
    db.prepare('DELETE FROM perfiles WHERE id = ?').run(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
