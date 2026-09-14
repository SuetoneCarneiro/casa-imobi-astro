import type { Property } from '../server/db/schema'

/**
 * Preço vem do banco em CENTAVOS. A divisão por 100 acontece aqui e só aqui.
 */
export function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export function formatArea(m2: number | null): string | null {
  if (m2 == null) return null
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(m2)} m²`
}

export const PROPERTY_TYPE_LABELS: Record<Property['type'], string> = {
  house: 'Casa',
  apartment: 'Apartamento',
  land: 'Terreno',
  commercial: 'Comercial',
}

export const PROPERTY_TYPE_ICONS = {
  house: 'home',
  apartment: 'building',
  land: 'land',
  commercial: 'store',
} as const

/** Endereço como o site público mostra — respeitando hideAddressNumber. */
export function publicAddress(p: Property): string {
  const parts = [p.addressStreet]
  if (p.addressNumber && !p.hideAddressNumber) parts.push(p.addressNumber)
  const street = parts.filter(Boolean).join(', ')
  return [street, p.addressNeighborhood].filter(Boolean).join(' — ')
}
