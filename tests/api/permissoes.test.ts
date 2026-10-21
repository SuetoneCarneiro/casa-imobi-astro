import { describe, expect, it } from 'vitest'
import {
  limitadoAosPropriosImoveis,
  podeEditarImovel,
  podeGerenciarUsuarios,
  podeVerGuiaDeEstilo,
  rotuloDoPapel,
} from '../../src/server/services/permissions'

const admin = { id: 1, role: 'admin' } as const
const gestor = { id: 2, role: 'manager' } as const
const corretor = { id: 3, role: 'agent' } as const

describe('gestão de usuários', () => {
  it('só o administrador gerencia contas', () => {
    expect(podeGerenciarUsuarios(admin)).toBe(true)
    expect(podeGerenciarUsuarios(gestor)).toBe(false)
    expect(podeGerenciarUsuarios(corretor)).toBe(false)
  })

  it('só o administrador vê o guia de estilo', () => {
    expect(podeVerGuiaDeEstilo(admin)).toBe(true)
    expect(podeVerGuiaDeEstilo(gestor)).toBe(false)
  })
})

describe('escopo do acervo', () => {
  it('apenas o corretor fica limitado ao próprio acervo', () => {
    expect(limitadoAosPropriosImoveis(corretor)).toBe(true)
    expect(limitadoAosPropriosImoveis(gestor)).toBe(false)
    expect(limitadoAosPropriosImoveis(admin)).toBe(false)
  })

  it('administrador e gestor editam imóvel de qualquer autor', () => {
    const deOutro = { createdBy: 99 }
    expect(podeEditarImovel(admin, deOutro)).toBe(true)
    expect(podeEditarImovel(gestor, deOutro)).toBe(true)
  })

  it('corretor edita o que cadastrou', () => {
    expect(podeEditarImovel(corretor, { createdBy: corretor.id })).toBe(true)
  })

  it('corretor não edita imóvel de outra pessoa', () => {
    expect(podeEditarImovel(corretor, { createdBy: 99 })).toBe(false)
  })

  // Imóvel cujo autor foi removido fica sem dono, e o corretor não assume.
  it('corretor não edita imóvel sem autor', () => {
    expect(podeEditarImovel(corretor, { createdBy: null })).toBe(false)
  })
})

describe('rótulos', () => {
  it('traduz o papel para a interface', () => {
    expect(rotuloDoPapel('admin')).toBe('Administrador')
    expect(rotuloDoPapel('agent')).toBe('Corretor')
  })
})
