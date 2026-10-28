import type { Db } from '../db/client'
import { countOtherActiveAdmins, createUser, findUserById, updateUser } from '../db/queries/users'
import { deleteOtherSessions } from '../db/queries/sessions'
import type { User } from '../db/schema'
import { hashPassword, verifyPassword } from './password'
import type { EdicaoUsuario, NovoUsuario, TrocaDeSenha } from '../validation/user'

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

export type ResultadoTroca = { ok: true } | { ok: false; erro: string; campo: keyof TrocaDeSenha }

/**
 * Troca a senha da própria pessoa.
 *
 * Separado de `editarUsuario` de propósito: lá quem age é um administrador
 * sobre a conta de outro, e exigir a senha atual não faria sentido. Aqui quem
 * age é o dono da conta, e a senha atual é o que prova que é ele.
 */
export async function trocarSenhaPropria(
  db: Db,
  user: Pick<User, 'id' | 'passwordHash'>,
  dados: TrocaDeSenha,
  sessaoAtual: string,
): Promise<ResultadoTroca> {
  if (!(await verifyPassword(dados.atual, user.passwordHash))) {
    return { ok: false, erro: 'A senha atual não confere.', campo: 'atual' }
  }

  if (await verifyPassword(dados.nova, user.passwordHash)) {
    return { ok: false, erro: 'A nova senha precisa ser diferente da atual.', campo: 'nova' }
  }

  await updateUser(db, user.id, { passwordHash: await hashPassword(dados.nova) })
  await deleteOtherSessions(db, user.id, sessaoAtual)
  return { ok: true }
}
