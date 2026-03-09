import { getDb, getSemanaISO } from '@/lib/db'
import { generarMenuStream, parsearMenuJSON } from '@/lib/claude'
import type { Perfil, HorarioDia } from '@/lib/types'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const semana: string = body.semana ?? getSemanaISO()

  const db = getDb()
  const perfilesRaw = db.prepare('SELECT * FROM perfiles WHERE activo = 1').all() as any[]
  const perfiles: Perfil[] = perfilesRaw.map(r => ({
    ...r,
    restricciones: JSON.parse(r.restricciones || '[]'),
    preferencias: JSON.parse(r.preferencias || '[]'),
    aversiones: JSON.parse(r.aversiones || '[]'),
    activo: Boolean(r.activo),
  }))

  if (!perfiles.length) {
    return new Response(JSON.stringify({ error: 'No hay perfiles activos' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const horarios = db.prepare('SELECT * FROM horario_semanal WHERE semana = ?').all(semana) as HorarioDia[]

  const encoder = new TextEncoder()
  let acumulado = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const gen = generarMenuStream(perfiles, horarios, semana)
        for await (const chunk of gen) {
          acumulado += chunk
          controller.enqueue(encoder.encode(chunk))
        }

        // Guardar el menú en base de datos
        const menu = parsearMenuJSON(acumulado, semana)
        if (menu) {
          db.prepare(`
            INSERT INTO menus (id, semana, datos)
            VALUES (?, ?, ?)
            ON CONFLICT(semana) DO UPDATE SET datos = excluded.datos, created_at = datetime('now')
          `).run(menu.id, semana, JSON.stringify(menu))
          controller.enqueue(encoder.encode('\n\n__MENU_GUARDADO__'))
        }
        controller.close()
      } catch (e) {
        controller.error(e)
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Semana': semana,
    },
  })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const semana = searchParams.get('semana') ?? getSemanaISO()
  const db = getDb()
  const row = db.prepare('SELECT * FROM menus WHERE semana = ?').get(semana) as any
  if (!row) return new Response(null, { status: 404 })
  return Response.json(JSON.parse(row.datos))
}
