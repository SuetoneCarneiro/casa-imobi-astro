/**
 * Reconhecimento e leitura de arquivos de imagem no envio de fotos.
 *
 * Separado do componente para que o reconhecimento possa ser testado sem
 * navegador e para que a leitura possa ser exercitada isoladamente.
 */

const EXTENSOES_DE_IMAGEM = /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i
const EXTENSOES_HEIC = /\.(heic|heif)$/i

type ArquivoBasico = { name: string; type: string }

/**
 * Alguns navegadores entregam arquivos HEIC com `type` vazio, porque não
 * conhecem o formato. Descartar por aí faria a foto sumir sem explicação, que
 * é pior que recusá-la com uma mensagem. Por isso a extensão também vale.
 */
export function ehImagemAceita(file: ArquivoBasico): boolean {
  if (file.type.startsWith('image/')) return true
  return file.type === '' && EXTENSOES_DE_IMAGEM.test(file.name)
}

/** Usado para decidir se vale carregar o decodificador, que é pesado. */
export function pareceHeic(file: ArquivoBasico): boolean {
  return /hei[cf]/i.test(file.type) || EXTENSOES_HEIC.test(file.name)
}

/**
 * Decodifica o arquivo para um bitmap que o canvas consegue redimensionar.
 *
 * Tenta primeiro o decodificador nativo, que o Safari tem para HEIC e que não
 * custa nada nos formatos comuns. Só quando ele falha, e o arquivo realmente
 * parece HEIC, baixa o decodificador em JavaScript, que tem alguns megabytes.
 * O teste de SSR é constante em tempo de build e mantém esse pacote fora do
 * bundle do Worker, onde esta função nunca roda.
 */
export async function carregarBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch (erro) {
    if (import.meta.env.SSR || !pareceHeic(file)) throw erro
    const { heicTo } = await import('heic-to')
    return await heicTo({ blob: file, type: 'bitmap' })
  }
}
