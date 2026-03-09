export type ComidaEstado = 'casa' | 'fuera' | 'skip' | 'tupper'

export interface Perfil {
  id: string
  nombre: string
  calorias_objetivo: number
  proteinas_g: number
  carbohidratos_g: number
  grasas_g: number
  restricciones: string[]   // sin gluten, vegetariano, vegano, sin lactosa...
  preferencias: string[]    // cocinas favoritas, ingredientes favoritos
  aversiones: string[]      // ingredientes que no gustan
  tiempo_cocina_max: number // minutos
  activo: boolean
  created_at: string
}

export interface HorarioDia {
  perfil_id: string
  dia: string
  desayuno: ComidaEstado
  comida: ComidaEstado
  cena: ComidaEstado
}

export interface HorarioSemanal {
  semana: string // "2026-W10"
  horarios: HorarioDia[]
}

export interface Receta {
  nombre: string
  ingredientes: { cantidad: string; unidad: string; nombre: string }[]
  pasos: string[]
  tiempo_prep: number   // minutos
  tiempo_cocina: number // minutos
  porciones: number
  calorias_por_porcion: number
  proteinas: number
  carbohidratos: number
  grasas: number
  notas?: string
}

export interface ComidaMenu {
  receta: Receta
  perfiles_objetivo: string[] // IDs de perfiles para los que aplica
}

export interface DiaMenu {
  dia: string
  desayuno?: ComidaMenu
  comida?: ComidaMenu
  cena?: ComidaMenu
}

export interface MenuSemanal {
  id: string
  semana: string
  dias: DiaMenu[]
  created_at: string
}

export interface ItemCompra {
  nombre: string
  cantidad: number
  unidad: string
  categoria: string   // frutas, verduras, carnes, lácteos, etc.
  recetas_origen: string[]
}

export interface ListaCompra {
  semana: string
  items: ItemCompra[]
  created_at: string
}

export interface ItemDespensa {
  id: string
  ingrediente: string
  cantidad: string
  unidad: string
  caducidad?: string
}
