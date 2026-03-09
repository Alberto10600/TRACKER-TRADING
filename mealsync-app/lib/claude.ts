import type { Perfil, HorarioDia, MenuSemanal, DiaMenu } from './types'
import { DIAS_SEMANA } from './db'
import { v4 as uuidv4 } from 'uuid'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`

// ── Genera menú semanal con streaming ────────────────────────────────────────

export async function* generarMenuStream(
  perfiles: Perfil[],
  horarios: HorarioDia[],
  semana: string
): AsyncGenerator<string> {
  const perfilesActivos = perfiles.filter(p => p.activo)

  const resumenPerfiles = perfilesActivos.map(p => `
- **${p.nombre}**: ${p.calorias_objetivo} kcal/día | Proteínas: ${p.proteinas_g}g | Carbos: ${p.carbohidratos_g}g | Grasas: ${p.grasas_g}g
  Restricciones: ${p.restricciones.length ? p.restricciones.join(', ') : 'ninguna'}
  Preferencias: ${p.preferencias.length ? p.preferencias.join(', ') : 'ninguna'}
  Aversiones: ${p.aversiones.length ? p.aversiones.join(', ') : 'ninguna'}
  Tiempo máximo de cocina: ${p.tiempo_cocina_max} min`).join('\n')

  const resumenHorario = DIAS_SEMANA.map(dia => {
    const horariosDelDia = perfilesActivos.map(p => {
      const h = horarios.find(x => x.perfil_id === p.id && x.dia === dia)
      if (!h) return `  ${p.nombre}: desayuno casa / comida casa / cena casa`
      return `  ${p.nombre}: desayuno ${h.desayuno} / comida ${h.comida} / cena ${h.cena}`
    }).join('\n')
    return `**${dia}**:\n${horariosDelDia}`
  }).join('\n')

  const prompt = `Eres un nutricionista y chef experto. Genera un menú semanal completo y equilibrado para ${semana}.

## Perfiles de los comensales:
${resumenPerfiles}

## Horario semanal (casa=cocinar en casa, fuera=comer fuera, skip=no aplica, tupper=sobras del día anterior):
${resumenHorario}

## Instrucciones:
- Solo planifica las comidas marcadas como "casa"
- Para "tupper": usa las sobras de la comida principal del día anterior (no generes nueva receta)
- Optimiza el batch cooking: si algo se puede preparar en cantidad y reutilizar, hazlo
- Varía las proteínas a lo largo de la semana (pollo, pescado, legumbres, ternera, huevos)
- Incluye recetas sencillas entre semana y más elaboradas el fin de semana
- Respeta todas las restricciones y aversiones
- Adapta las cantidades para satisfacer los objetivos nutricionales de todos los perfiles

## Formato de respuesta:
Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta:

\`\`\`json
{
  "dias": [
    {
      "dia": "lunes",
      "desayuno": {
        "receta": {
          "nombre": "...",
          "ingredientes": [{"cantidad": "2", "unidad": "unidades", "nombre": "huevos"}],
          "pasos": ["paso 1", "paso 2"],
          "tiempo_prep": 5,
          "tiempo_cocina": 10,
          "porciones": 2,
          "calorias_por_porcion": 350,
          "proteinas": 20,
          "carbohidratos": 30,
          "grasas": 12,
          "notas": "opcional"
        },
        "perfiles_objetivo": ["id1", "id2"]
      },
      "comida": {},
      "cena": {}
    }
  ]
}
\`\`\`

Solo incluye la comida si está planificada (casa). Si es "tupper" o "fuera" o "skip", omite ese campo del día.
Los IDs de perfiles_objetivo son: ${perfilesActivos.map(p => `${p.id} (${p.nombre})`).join(', ')}`

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 8192 },
    }),
  })

  if (!res.ok || !res.body) {
    const err = await res.text()
    throw new Error(`Gemini API error: ${err}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const lines = decoder.decode(value).split('\n')
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue
      try {
        const json = JSON.parse(data)
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) yield text
      } catch {
        // ignorar líneas no JSON
      }
    }
  }
}

// ── Parsea el JSON del menú generado ─────────────────────────────────────────

export function parsearMenuJSON(texto: string, semana: string): MenuSemanal | null {
  try {
    const match = texto.match(/```json\s*([\s\S]*?)\s*```/) ||
                  texto.match(/\{[\s\S]*"dias"[\s\S]*\}/)
    const jsonStr = match ? (match[1] ?? match[0]) : texto.trim()
    const parsed = JSON.parse(jsonStr)
    return {
      id: uuidv4(),
      semana,
      dias: parsed.dias as DiaMenu[],
      created_at: new Date().toISOString(),
    }
  } catch {
    return null
  }
}
