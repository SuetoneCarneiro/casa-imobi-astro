import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/**
 * Schema do banco (Cloudflare D1 = SQLite).
 *
 * Convenções:
 * - dinheiro em CENTAVOS (integer). SQLite não tem decimal; float acumula erro.
 * - datas em unix ms (integer).
 * - booleanos em 0/1 (SQLite não tem boolean); `mode: 'boolean'` cuida da conversão.
 * - nomes de coluna em snake_case, propriedades em camelCase.
 */

const timestamps = {
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at')
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
}

// usuários

export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: ['admin', 'manager', 'agent'] })
      .notNull()
      .default('agent'),
    /** Desativar em vez de apagar — preserva a autoria dos imóveis. */
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex('idx_users_email').on(t.email)],
)

// sessões

export const sessions = sqliteTable(
  'sessions',
  {
    /** 32 bytes aleatórios em hex — é o valor que vai no cookie. */
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at').notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('idx_sessions_user').on(t.userId)],
)

// imóveis

export const PROPERTY_TYPES = ['house', 'apartment', 'land', 'commercial'] as const
export const PROPERTY_CATEGORIES = ['residential', 'commercial'] as const
export const PROPERTY_STATUS = ['active', 'inactive'] as const
export const PROPERTY_PURPOSES = ['sale', 'rent'] as const

export const properties = sqliteTable(
  'properties',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),

    // identificação
    /** Código divulgado pela imobiliária, ex.: CI-0042. */
    code: text('code').notNull(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),

    // comercial
    /** Em centavos. R$ 450.000,00 = 45000000. */
    price: integer('price').notNull(),
    /** Fixo em 'sale' no MVP; 'rent' fica reservado para quando locação entrar. */
    purpose: text('purpose', { enum: PROPERTY_PURPOSES }).notNull().default('sale'),
    type: text('type', { enum: PROPERTY_TYPES }).notNull(),
    category: text('category', { enum: PROPERTY_CATEGORIES }).notNull().default('residential'),
    /** É o soft delete: nada é apagado, só sai do ar. */
    status: text('status', { enum: PROPERTY_STATUS }).notNull().default('active'),

    // características
    isCondo: integer('is_condo', { mode: 'boolean' }).notNull().default(false),
    bedrooms: integer('bedrooms').notNull().default(0),
    suites: integer('suites').notNull().default(0),
    bathrooms: integer('bathrooms').notNull().default(0),
    parkingSpaces: integer('parking_spaces').notNull().default(0),
    /** Área útil em metros quadrados */
    usableArea: real('usable_area'),

    // endereço — sempre guardado por inteiro
    addressStreet: text('address_street'),
    addressNumber: text('address_number'),
    /** Só esconde na exibição pública. O dado continua no banco. */
    hideAddressNumber: integer('hide_address_number', { mode: 'boolean' }).notNull().default(false),
    addressNeighborhood: text('address_neighborhood'),
    addressCity: text('address_city').notNull().default('Caruaru'),
    addressState: text('address_state').notNull().default('PE'),
    addressZip: text('address_zip'),

    // extras
    /** Empreendimento. Texto por ora; vira tabela quando houver múltiplas unidades. */
    development: text('development'),
    videoUrl: text('video_url'),

    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('idx_properties_code').on(t.code),
    uniqueIndex('idx_properties_slug').on(t.slug),
    // a listagem pública filtra por aqui
    index('idx_properties_listing').on(t.status, t.type, t.price),
    index('idx_properties_neighborhood').on(t.addressNeighborhood),
  ],
)

// fotos

export const propertyImages = sqliteTable(
  'property_images',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    propertyId: integer('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    /** Prefixo no R2. Os arquivos são {key}/thumb.webp, /md.webp, /full.webp. */
    storageKey: text('storage_key').notNull(),
    alt: text('alt'),
    position: integer('position').notNull().default(0),
    isCover: integer('is_cover', { mode: 'boolean' }).notNull().default(false),
    width: integer('width'),
    height: integer('height'),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index('idx_images_property').on(t.propertyId, t.position),
    /**
     * Índice único PARCIAL: o banco garante no máximo uma capa por imóvel.
     * Sem o WHERE, o índice proibiria duas fotos não-capa no mesmo imóvel.
     */
    uniqueIndex('idx_images_cover').on(t.propertyId).where(sql`is_cover = 1`),
  ],
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Property = typeof properties.$inferSelect
export type NewProperty = typeof properties.$inferInsert
export type PropertyImage = typeof propertyImages.$inferSelect
