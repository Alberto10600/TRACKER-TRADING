import type { MenuSemanal, ItemCompra, ComidaMenu } from './types'

export function generarListaCompra(menu: MenuSemanal): ItemCompra[] {
  const ingredientesMap = new Map<string, ItemCompra>()

  for (const dia of menu.dias) {
    const comidas = [dia.desayuno, dia.comida, dia.cena].filter(Boolean) as ComidaMenu[]
    for (const comida of comidas) {
      for (const ing of comida.receta.ingredientes) {
        const key = ing.nombre.toLowerCase().trim()
        if (ingredientesMap.has(key)) {
          const existing = ingredientesMap.get(key)!
          const cantidadNum = parseFloat(ing.cantidad) || 1
          const existingNum = typeof existing.cantidad === 'number' ? existing.cantidad : parseFloat(String(existing.cantidad)) || 0
          existing.cantidad = existingNum + cantidadNum
          if (!existing.recetas_origen.includes(comida.receta.nombre)) {
            existing.recetas_origen.push(comida.receta.nombre)
          }
        } else {
          ingredientesMap.set(key, {
            nombre: ing.nombre,
            cantidad: parseFloat(ing.cantidad) || 1,
            unidad: ing.unidad,
            categoria: categorizarIngrediente(ing.nombre),
            recetas_origen: [comida.receta.nombre],
          })
        }
      }
    }
  }

  return Array.from(ingredientesMap.values()).sort((a, b) =>
    a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre)
  )
}

function categorizarIngrediente(nombre: string): string {
  const n = nombre.toLowerCase()
  if (/pollo|ternera|cerdo|cordero|pavo|jamón|bacon|carne/.test(n)) return '🥩 Carnes'
  if (/salmón|merluza|atún|sardina|gambas|pescado|bacalao|mejillón/.test(n)) return '🐟 Pescados'
  if (/leche|queso|yogur|mantequilla|nata|crema/.test(n)) return '🥛 Lácteos'
  if (/huevo/.test(n)) return '🥚 Huevos'
  if (/tomate|cebolla|ajo|pimiento|zanahoria|espinaca|lechuga|pepino|calabacín|berenjena|brócoli|patata|verdura|espárago/.test(n)) return '🥦 Verduras'
  if (/manzana|plátano|naranja|limón|fresa|uva|pera|fruta/.test(n)) return '🍎 Frutas'
  if (/arroz|pasta|macarron|espagueti|fideos|quinoa|avena|cuscús|cereal/.test(n)) return '🌾 Cereales'
  if (/lenteja|garbanzo|alubia|judía|legumbre/.test(n)) return '🫘 Legumbres'
  if (/aceite|vinagre|sal|pimienta|orégano|tomillo|romero|comino|curry|especias|condimento/.test(n)) return '🧂 Condimentos'
  if (/pan|harina|levadura/.test(n)) return '🍞 Panadería'
  if (/agua|caldo|vino|cerveza|zumo/.test(n)) return '🥤 Líquidos'
  return '📦 Otros'
}
