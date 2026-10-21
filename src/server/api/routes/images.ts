import { Hono } from 'hono'
import { createDb } from '../../db/client'
import {
  deleteImage,
  ensureCover,
  findImage,
  insertImage,
  listPropertyImages,
  reorderImages,
  setCover,
} from '../../db/queries/images'
import { findPropertyById } from '../../db/queries/properties'
import { podeEditarImovel } from '../../services/permissions'
import {
  buildStorageKey,
  deleteAllVariants,
  extFromMime,
  imageUrl,
  MIME_TO_EXT,
  putVariant,
  VARIANTS,
  type ImageFormat,
} from '../../services/images'
import { requireAuth } from '../middleware/auth'
import type { ApiEnvAutenticado } from '../index'

/**
 * Fotos dos imóveis. É aqui que o Hono finalmente ganha um cliente de verdade:
 * a ilha React do painel chama estas rotas com fetch.
 */
export const images = new Hono<ApiEnvAutenticado>()

/** Corretor só mexe nas fotos dos imóveis que cadastrou. */
async function donoDoImovel(
  user: { id: number; role: 'admin' | 'manager' | 'agent' },
  db: ReturnType<typeof createDb>,
  propertyId: number,
) {
  const imovel = await findPropertyById(db, propertyId)
  return Boolean(imovel) && podeEditarImovel(user, imovel!)
}

images.use('*', requireAuth)

/** 6 MB por variante. A `full` em WebP 1920px fica bem abaixo disso. */
const MAX_BYTES = 6 * 1024 * 1024

function serializar(img: {
  id: number
  storageKey: string
  format: ImageFormat
  position: number
  isCover: boolean
  alt: string | null
}) {
  return {
    id: img.id,
    position: img.position,
    isCover: img.isCover,
    alt: img.alt,
    thumbUrl: imageUrl(img.storageKey, 'thumb', img.format),
    mdUrl: imageUrl(img.storageKey, 'md', img.format),
  }
}

/** Lista as fotos de um imóvel, para a ilha montar o estado inicial. */
images.get('/imovel/:propertyId', async (c) => {
  const propertyId = Number(c.req.param('propertyId'))
  if (!Number.isInteger(propertyId)) return c.json({ error: 'Imóvel inválido' }, 400)

  const db = createDb(c.env.DB)
  const imovel = await findPropertyById(db, propertyId)
  if (!imovel) return c.json({ error: 'Imóvel não encontrado' }, 404)
  if (!podeEditarImovel(c.get('user'), imovel)) {
    return c.json({ error: 'Sem permissão sobre este imóvel' }, 403)
  }

  const fotos = await listPropertyImages(db, propertyId)
  return c.json({ fotos: fotos.map(serializar) })
})

/**
 * Recebe as três variantes já redimensionadas pelo navegador.
 * O servidor não processa imagem, só valida e guarda.
 */
images.post('/imovel/:propertyId', async (c) => {
  const propertyId = Number(c.req.param('propertyId'))
  if (!Number.isInteger(propertyId)) return c.json({ error: 'Imóvel inválido' }, 400)

  const db = createDb(c.env.DB)
  const imovel = await findPropertyById(db, propertyId)
  if (!imovel) return c.json({ error: 'Imóvel não encontrado' }, 404)
  if (!podeEditarImovel(c.get('user'), imovel)) {
    return c.json({ error: 'Sem permissão sobre este imóvel' }, 403)
  }

  const form = await c.req.formData()
  const width = Number(form.get('width'))
  const height = Number(form.get('height'))

  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    return c.json({ error: 'Dimensões inválidas' }, 400)
  }

  const arquivos = VARIANTS.map((v) => form.get(v))
  if (arquivos.some((a) => !(a instanceof File))) {
    return c.json({ error: 'Envie as três variantes da imagem.' }, 400)
  }

  const blobs = arquivos as File[]
  if (blobs.some((b) => b.size > MAX_BYTES)) {
    return c.json({ error: 'Imagem acima do tamanho permitido.' }, 413)
  }
  // O formato é o que o navegador conseguiu produzir, não o que pedimos.
  // A mensagem de erro diz o que chegou, para o próximo problema ser óbvio.
  const exts = blobs.map((b) => extFromMime(b.type))
  if (exts.some((e) => e === null)) {
    const recebidos = [...new Set(blobs.map((b) => b.type || 'desconhecido'))].join(', ')
    return c.json(
      {
        error: `Formato não suportado (recebido: ${recebidos}). Aceitos: ${Object.keys(MIME_TO_EXT).join(', ')}.`,
      },
      415,
    )
  }
  if (new Set(exts).size !== 1) {
    return c.json({ error: 'As três variantes precisam estar no mesmo formato.' }, 400)
  }

  const ext = exts[0] as ImageFormat
  const storageKey = buildStorageKey(propertyId)
  const buffers = await Promise.all(blobs.map((b) => b.arrayBuffer()))

  await Promise.all(
    VARIANTS.map((variant, i) => putVariant(c.env.BUCKET, storageKey, variant, ext, buffers[i]!)),
  )

  const foto = await insertImage(db, {
    propertyId,
    storageKey,
    format: ext,
    width,
    height,
    alt: String(form.get('alt') ?? '') || null,
  })

  return c.json({ foto: serializar(foto) }, 201)
})

images.post('/:id/capa', async (c) => {
  const id = Number(c.req.param('id'))
  const db = createDb(c.env.DB)
  const foto = Number.isInteger(id) ? await findImage(db, id) : null
  if (!foto) return c.json({ error: 'Foto não encontrada' }, 404)
  if (!(await donoDoImovel(c.get('user'), db, foto.propertyId))) {
    return c.json({ error: 'Sem permissão sobre este imóvel' }, 403)
  }

  await setCover(db, foto.propertyId, foto.id)
  return c.json({ ok: true })
})

images.post('/ordem', async (c) => {
  const body = await c.req.json<{ propertyId?: number; ids?: number[] }>().catch(() => null)
  const propertyId = Number(body?.propertyId)
  const ids = body?.ids

  if (!Number.isInteger(propertyId) || !Array.isArray(ids) || ids.some((i) => !Number.isInteger(i))) {
    return c.json({ error: 'Ordem inválida' }, 400)
  }

  const db = createDb(c.env.DB)
  if (!(await donoDoImovel(c.get('user'), db, propertyId))) {
    return c.json({ error: 'Sem permissão sobre este imóvel' }, 403)
  }

  await reorderImages(db, propertyId, ids)
  return c.json({ ok: true })
})

images.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const db = createDb(c.env.DB)
  const foto = Number.isInteger(id) ? await findImage(db, id) : null
  if (!foto) return c.json({ error: 'Foto não encontrada' }, 404)
  if (!(await donoDoImovel(c.get('user'), db, foto.propertyId))) {
    return c.json({ error: 'Sem permissão sobre este imóvel' }, 403)
  }

  // Apaga do R2 antes do banco: sobrar arquivo órfão é pior que sobrar linha.
  await deleteAllVariants(c.env.BUCKET, foto.storageKey, foto.format)
  await deleteImage(db, foto.id)
  await ensureCover(db, foto.propertyId)

  return c.json({ ok: true })
})
