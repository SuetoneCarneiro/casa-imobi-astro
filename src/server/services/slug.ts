/** "Casa com 3 quartos no Centro" -> "casa-com-3-quartos-no-centro" */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // tira acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/**
 * Garante unicidade acrescentando sufixo numérico.
 * `existe` consulta o banco, então a checagem é contra o estado real.
 */
export async function uniqueSlug(
  base: string,
  existe: (slug: string) => Promise<boolean>,
): Promise<string> {
  const raiz = slugify(base) || 'imovel'
  if (!(await existe(raiz))) return raiz

  for (let i = 2; i < 100; i++) {
    const candidato = `${raiz}-${i}`
    if (!(await existe(candidato))) return candidato
  }

  return `${raiz}-${Date.now()}`
}
