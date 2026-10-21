import type { Db } from '../db/client'
import { countOtherActiveAdmins, createUser, findUserById, updateUser } from '../db/queries/users'
import type { User } from '../db/schema'
import { hashPassword } from './password'
import type { EdicaoUsuario, NovoUsuario } from '../validation/user'

export type ResultadoUsuario = { ok: true; user: User } | { ok: false; erro: string }

export async function criarUsuario(db: Db, dados: NovoUsuario): Promise<ResultadoUsuario> {
  const user = await createUser(db, {
    name: dados.name,
    email: dados.email,
    role: dados.role,
    active: dados.active,
    passwordHash: await hashPassword(dados.senha),
  }).catch(() => null)

  // O índice único do e-mail é quem recusa a duplicidade, não uma consulta prévia.
  if (!user) return { ok: false, erro: 'Já existe um usuário com este e-mail.' }
  return { ok: true, user }
}

/**
 * Edita um usuário aplicando duas travas de segurança.
 *
 * A primeira impede que alguém retire o próprio acesso por engano, perdendo a
 * capacidade de voltar atrás. A segunda impede que o último administrador ativo
 * seja rebaixado ou desativado, o que deixaria o sistema sem ninguém capaz de
 * gerenciar contas.
 */
export async function editarUsuario(
  db: Db,
  id: number,
  dados: EdicaoUsuario,
  autor: Pick<User, 'id'>,
): Promise<ResultadoUsuario> {
  const alvo = await findUserById(db, id)
  if (!alvo) return { ok: false, erro: 'Usuário não encontrado.' }

  const perdeAdmin = alvo.role === 'admin' && (dados.role !== 'admin' || !dados.active)

  if (perdeAdmin && alvo.id === autor.id) {
    return { ok: false, erro: 'Você não pode remover o próprio acesso de administrador.' }
  }

  if (perdeAdmin && (await countOtherActiveAdmins(db, alvo.id)) === 0) {
    return { ok: false, erro: 'É preciso manter ao menos um administrador ativo.' }
  }

  const user = await updateUser(db, id, {
    name: dados.name,
    email: dados.email,
    role: dados.role,
    active: dados.active,
    ...(dados.senha ? { passwordHash: await hashPassword(dados.senha) } : {}),
  }).catch(() => null)

  if (!user) return { ok: false, erro: 'Não foi possível salvar. O e-mail já pode estar em uso.' }
  return { ok: true, user }
}
