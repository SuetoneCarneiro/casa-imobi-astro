import { z } from 'zod'
import {
  PROPERTY_CATEGORIES,
  PROPERTY_PURPOSES,
  PROPERTY_STATUS,
  PROPERTY_TYPES,
} from '../db/schema'

/**
 * Regras de validação do imóvel.
 *
 * Vive em `src/server/` e não importa nada do Astro, então serve tanto à página
 * do painel quanto a qualquer consumidor futuro da API. Uma regra, um lugar.
 */

const inteiroNaoNegativo = z.coerce.number().int().min(0).max(99)

export const propertySchema = z.object({
  title: z.string().trim().min(5, 'Informe um título com pelo menos 5 caracteres.').max(160),
  description: z.string().trim().max(4000).optional(),
  /** Em centavos. A conversão de reais acontece em `parsePropertyForm`. */
  price: z.number().int().positive('Informe um valor maior que zero.'),
  purpose: z.enum(PROPERTY_PURPOSES).default('sale'),
  type: z.enum(PROPERTY_TYPES, { message: 'Escolha o tipo do imóvel.' }),
  category: z.enum(PROPERTY_CATEGORIES).default('residential'),
  status: z.enum(PROPERTY_STATUS).default('active'),
  isCondo: z.boolean().default(false),
  bedrooms: inteiroNaoNegativo.default(0),
  suites: inteiroNaoNegativo.default(0),
  bathrooms: inteiroNaoNegativo.default(0),
  parkingSpaces: inteiroNaoNegativo.default(0),
  usableArea: z.number().positive().max(100000).nullable().default(null),
  addressStreet: z.string().trim().max(160).optional(),
  addressNumber: z.string().trim().max(20).optional(),
  hideAddressNumber: z.boolean().default(false),
  addressNeighborhood: z.string().trim().max(80).optional(),
  addressCity: z.string().trim().max(80).default('Caruaru'),
  addressState: z.string().trim().length(2).default('PE'),
  addressZip: z.string().trim().max(12).optional(),
  development: z.string().trim().max(120).optional(),
  // z.url() é a forma do Zod 4; z.string().url() está deprecado.
  videoUrl: z.union([z.url('Informe uma URL válida.'), z.literal('')]).optional(),
})

export type PropertyInput = z.infer<typeof propertySchema>

/** Erros por campo, no formato que o formulário consome. */
export type FieldErrors = Partial<Record<keyof PropertyInput, string>>

/** "450.000,00" e "450000" viram 45000000 centavos. */
export function parseBRLToCents(value: string): number {
  const limpo = value.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const reais = Number(limpo)
  if (!Number.isFinite(reais)) return 0
  return Math.round(reais * 100)
}

function texto(form: FormData, campo: string): string {
  return String(form.get(campo) ?? '').trim()
}

function opcional(form: FormData, campo: string): string | undefined {
  const v = texto(form, campo)
  return v === '' ? undefined : v
}

/**
 * Converte o FormData cru nos tipos que o schema espera.
 * Checkbox ausente significa false, e campo numérico vazio vira null ou zero.
 */
export function parsePropertyForm(form: FormData) {
  const area = texto(form, 'usableArea').replace(',', '.')

  return propertySchema.safeParse({
    title: texto(form, 'title'),
    description: opcional(form, 'description'),
    price: parseBRLToCents(texto(form, 'price')),
    type: texto(form, 'type'),
    category: texto(form, 'category') || 'residential',
    status: texto(form, 'status') || 'active',
    isCondo: form.get('isCondo') !== null,
    bedrooms: texto(form, 'bedrooms') || 0,
    suites: texto(form, 'suites') || 0,
    bathrooms: texto(form, 'bathrooms') || 0,
    parkingSpaces: texto(form, 'parkingSpaces') || 0,
    usableArea: area === '' ? null : Number(area),
    addressStreet: opcional(form, 'addressStreet'),
    addressNumber: opcional(form, 'addressNumber'),
    hideAddressNumber: form.get('hideAddressNumber') !== null,
    addressNeighborhood: opcional(form, 'addressNeighborhood'),
    addressCity: texto(form, 'addressCity') || 'Caruaru',
    addressState: (texto(form, 'addressState') || 'PE').toUpperCase(),
    addressZip: opcional(form, 'addressZip'),
    development: opcional(form, 'development'),
    videoUrl: opcional(form, 'videoUrl'),
  })
}

/** Achata os erros do Zod em um mapa campo -> primeira mensagem. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const saida: FieldErrors = {}
  for (const issue of error.issues) {
    const campo = issue.path[0] as keyof PropertyInput | undefined
    if (campo && !saida[campo]) saida[campo] = issue.message
  }
  return saida
}
