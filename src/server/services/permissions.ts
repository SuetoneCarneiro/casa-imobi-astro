import type { Property, User } from '../db/schema'

/**
 * Regras de permissão do painel, em um lugar só.
 *
 * Não importa nada do Astro nem do Hono, então a mesma regra vale para as
 * páginas, para as rotas da API e para os testes. Espalhar `if (role === ...)`
 * pelas telas seria o caminho mais curto para uma permissão divergir de outra.
 *
 *   admin    gerencia usuários e enxerga todo o acervo
 *   manager  enxerga todo o acervo, mas não mexe em usuários
 *   agent    enxerga e edita apenas os imóveis que cadastrou
 */

export type Papel = User['role']

export const PAPEIS: { valor: Papel; rotulo: string; descricao: string }[] = [
  { valor: 'admin', rotulo: 'Administrador', descricao: 'Gerencia usuários e todo o acervo.' },
  { valor: 'manager', rotulo: 'Gestor', descricao: 'Gerencia todo o acervo de imóveis.' },
  { valor: 'agent', rotulo: 'Corretor', descricao: 'Gerencia apenas os imóveis que cadastrou.' },
]

export function rotuloDoPapel(papel: Papel) {
  return PAPEIS.find((p) => p.valor === papel)?.rotulo ?? papel
}

export function podeGerenciarUsuarios(user: Pick<User, 'role'>) {
  return user.role === 'admin'
}

export function podeVerGuiaDeEstilo(user: Pick<User, 'role'>) {
  return user.role === 'admin'
}

/** Corretor enxerga só o próprio acervo. Os demais enxergam tudo. */
export function limitadoAosPropriosImoveis(user: Pick<User, 'role'>) {
  return user.role === 'agent'
}

export function podeEditarImovel(
  user: Pick<User, 'id' | 'role'>,
  imovel: Pick<Property, 'createdBy'>,
) {
  if (!limitadoAosPropriosImoveis(user)) return true
  return imovel.createdBy === user.id
}
