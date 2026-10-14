/**
 * Armazenamento das fotos no R2.
 *
 * Cada foto é um prefixo com três variantes já prontas:
 *   imoveis/<propertyId>/<id>/thumb.webp   400px  — cartão
 *   imoveis/<propertyId>/<id>/md.webp     1024px  — galeria
 *   imoveis/<propertyId>/<id>/full.webp   1920px  — ampliada
 *
 * O redimensionamento acontece NO NAVEGADOR, antes do upload. Isso evita
 * Cloudflare Images, que é pago, e não gasta CPU do Worker.
 */

export const VARIANTS = ['thumb', 'md', 'full'] as const
export type Variant = (typeof VARIANTS)[number]

/**
 * Formatos aceitos. WebP é o alvo, mas nem todo navegador codifica WebP no
 * canvas: a especificação permite devolver outro formato quando o pedido não é
 * suportado, e alguns fazem isso sem avisar. Aceitar JPEG e PNG evita que o
 * upload simplesmente não funcione nesses navegadores.
 */
export const MIME_TO_EXT = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
} as const

export type ImageFormat = (typeof MIME_TO_EXT)[keyof typeof MIME_TO_EXT]

const EXT_TO_MIME: Record<ImageFormat, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  png: 'image/png',
}

export function extFromMime(mime: string): ImageFormat | null {
  return MIME_TO_EXT[mime as keyof typeof MIME_TO_EXT] ?? null
}

export function mimeFromExt(ext: ImageFormat): string {
  return EXT_TO_MIME[ext]
}

export function isVariant(value: string): value is Variant {
  return (VARIANTS as readonly string[]).includes(value)
}

export function buildStorageKey(propertyId: number) {
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  return `imoveis/${propertyId}/${id}`
}

export function variantPath(storageKey: string, variant: Variant, ext: ImageFormat) {
  return `${storageKey}/${variant}.${ext}`
}

/** URL pública da foto. O conteúdo de uma chave nunca muda, então pode cachear para sempre. */
export function imageUrl(storageKey: string, variant: Variant = 'md', ext: ImageFormat = 'webp') {
  return `/fotos/${storageKey}/${variant}.${ext}`
}

export async function putVariant(
  bucket: R2Bucket,
  storageKey: string,
  variant: Variant,
  ext: ImageFormat,
  body: ArrayBuffer,
) {
  await bucket.put(variantPath(storageKey, variant, ext), body, {
    httpMetadata: {
      contentType: mimeFromExt(ext),
      cacheControl: 'public, max-age=31536000, immutable',
    },
  })
}

export async function deleteAllVariants(bucket: R2Bucket, storageKey: string, ext: ImageFormat) {
  await bucket.delete(VARIANTS.map((v) => variantPath(storageKey, v, ext)))
}
