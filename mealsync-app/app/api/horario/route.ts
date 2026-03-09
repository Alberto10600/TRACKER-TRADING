import { NextResponse } from 'next/server'
import { getDb, getSemanaISO, DIAS_SEMANA } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import type { HorarioDia } from '@/lib/types'

export function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const semana = searchParams.get('semana') ?? getSemanaISO()
    const db = getDb()
    const rows = db.prepare('SELECT * FROM horario_semanal WHERE semana = ?').all(semana) as HorarioDia[]
    return NextResponse.json({ semana, horarios: rows })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { semana, perfil_id, dia, desayuno, comida, cena } = body
    const db = getDb()
    db.prepare(`
      INSERT INTO horario_semanal (id, semana, perfil_id, dia, desayuno, comida, cena)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(semana, perfil_id, dia) DO UPDATE SET
        desayuno = excluded.desayuno,
        comida = excluded.comida,
        cena = excluded.cena
    `).run(uuidv4(), semana, perfil_id, dia, desayuno, comida, cena)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// Inicializa horario completo de una semana para todos los perfiles
export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const { semana, perfiles_ids } = body
    const db = getDb()

    const insert = db.prepare(`
      INSERT OR IGNORE INTO horario_semanal (id, semana, perfil_id, dia, desayuno, comida, cena)
      VALUES (?, ?, ?, ?, 'casa', 'casa', 'casa')
    `)

    const insertMany = db.transaction(() => {
      for (const pid of perfiles_ids) {
        for (const dia of DIAS_SEMANA) {
          insert.run(uuidv4(), semana, pid, dia)
        }
      }
    })
    insertMany()

    const rows = db.prepare('SELECT * FROM horario_semanal WHERE semana = ?').all(semana)
    return NextResponse.json({ semana, horarios: rows })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
