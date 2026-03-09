import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export function GET() {
  const db = getDb()
  const items = db.prepare('SELECT * FROM despensa ORDER BY ingrediente ASC').all()
  return NextResponse.json(items)
}

export async function POST(req: Request) {
  const body = await req.json()
  const db = getDb()
  const id = uuidv4()
  db.prepare(`
    INSERT INTO despensa (id, ingrediente, cantidad, unidad, caducidad)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, body.ingrediente, body.cantidad ?? '', body.unidad ?? '', body.caducidad ?? null)
  return NextResponse.json(db.prepare('SELECT * FROM despensa WHERE id = ?').get(id), { status: 201 })
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  const db = getDb()
  db.prepare('DELETE FROM despensa WHERE id = ?').run(id)
  return NextResponse.json({ ok: true })
}
