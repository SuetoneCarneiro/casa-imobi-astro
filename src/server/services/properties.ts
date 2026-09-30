import type { Db } from '../db/client'
import {
  insertProperty,
  nextPropertyCode,
  slugExists,
  updatePropertyRow,
} from '../db/queries/properties'
import type { PropertyInput } from '../validation/property'
import { uniqueSlug } from './slug'

/**
 * Regras de negócio do cadastro, fora da camada HTTP.
 * A página do painel chama isto, e qualquer rota de API futura chama o mesmo.
 */

function toColumns(input: PropertyInput) {
  return {
    title: input.title,
    description: input.description ?? null,
    price: input.price,
    purpose: input.purpose,
    type: input.type,
    category: input.category,
    status: input.status,
    isCondo: input.isCondo,
    bedrooms: input.bedrooms,
    suites: input.suites,
    bathrooms: input.bathrooms,
    parkingSpaces: input.parkingSpaces,
    usableArea: input.usableArea,
    addressStreet: input.addressStreet ?? null,
    addressNumber: input.addressNumber ?? null,
    hideAddressNumber: input.hideAddressNumber,
    addressNeighborhood: input.addressNeighborhood ?? null,
    addressCity: input.addressCity,
    addressState: input.addressState,
    addressZip: input.addressZip ?? null,
    development: input.development ?? null,
    videoUrl: input.videoUrl || null,
  }
}

export async function createProperty(db: Db, input: PropertyInput, userId: number) {
  const [code, slug] = await Promise.all([
    nextPropertyCode(db),
    uniqueSlug(input.title, (s) => slugExists(db, s)),
  ])

  return insertProperty(db, { ...toColumns(input), code, slug, createdBy: userId })
}

/**
 * O slug NÃO é regerado ao editar, de propósito. Ele já foi compartilhado em
 * link de WhatsApp e indexado pelo Google. Mudar o título não pode quebrar
 * endereço que já circula.
 */
export async function updateProperty(db: Db, id: number, input: PropertyInput) {
  return updatePropertyRow(db, id, toColumns(input))
}
