import type { Db } from '../db/client'
import {
  chaveDoNome,
  countPropertiesInNeighborhood,
  deleteNeighborhood,
  findNeighborhoodById,
  insertNeighborhood,
  listNeighborhoods,
  updateNeighborhoodRow,
} from '../db/queries/neighborhoods'
import type { Neighborhood } from '../db/schema'

export type ResultadoBairro = { ok: true; bairro: Neighborhood } | { ok: false; erro: string }

/**
 * Procura um nome equivalente ao informado.
 *
 * A comparação ignora acento e caixa, então "Mauricio de Nassau" esbarra em
 * "Maurício de Nassau" em vez de criar um segundo bairro para o mesmo lugar.
 * É feita em JavaScript porque `lower()` do SQLite não enxerga letra acentuada,
 * e a lista é curta o bastante para caber inteira na memória.
 */
async function equivalente(db: Db, nome: string, exceptId?: number) {
  const chave = chaveDoNome(nome)
  const todos = await listNeighborhoods(db)
  return todos.find((b) => b.id !== exceptId && chaveDoNome(b.name) === chave) ?? null
}

export async function criarBairro(db: Db, nome: string): Promise<ResultadoBairro> {
  const repetido = await equivalente(db, nome)
  if (repetido) return { ok: false, erro: `Já existe o bairro "${repetido.name}".` }

  const bairro = await insertNeighborhood(db, nome).catch(() => null)
  if (!bairro) return { ok: false, erro: 'Não foi possível salvar este bairro.' }
  return { ok: true, bairro }
}

export async function editarBairro(db: Db, id: number, nome: string): Promise<ResultadoBairro> {
  const repetido = await equivalente(db, nome, id)
  if (repetido) return { ok: false, erro: `Já existe o bairro "${repetido.name}".` }

  const bairro = await updateNeighborhoodRow(db, id, nome).catch(() => null)
  if (!bairro) return { ok: false, erro: 'Não foi possível salvar este bairro.' }
  return { ok: true, bairro }
}

/**
 * Remover é bloqueado enquanto houver imóvel apontando para o bairro.
 *
 * A chave estrangeira já recusaria com `restrict`, mas o erro do banco não diz
 * nada a quem está na tela. A checagem aqui existe para a mensagem, não para a
 * garantia, que continua sendo do banco.
 */
export async function removerBairro(db: Db, id: number): Promise<{ ok: true } | { ok: false; erro: string }> {
  const bairro = await findNeighborhoodById(db, id)
  if (!bairro) return { ok: false, erro: 'Bairro não encontrado.' }

  const emUso = await countPropertiesInNeighborhood(db, id)
  if (emUso > 0) {
    const plural = emUso === 1 ? 'imóvel usa' : 'imóveis usam'
    return {
      ok: false,
      erro: `${emUso} ${plural} este bairro. Troque o bairro deles antes de remover.`,
    }
  }

  await deleteNeighborhood(db, id)
  return { ok: true }
}
