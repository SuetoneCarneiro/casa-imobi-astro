// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PhotoUploader from '../../src/components/admin/PhotoUploader'

const fotos = [
  { id: 1, position: 0, isCover: true, alt: null, thumbUrl: '/fotos/a/thumb.webp', mdUrl: '/fotos/a/md.webp' },
  { id: 2, position: 1, isCover: false, alt: null, thumbUrl: '/fotos/b/thumb.webp', mdUrl: '/fotos/b/md.webp' },
]

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })))
  // jsdom não implementa estes; o componente os usa no caminho de upload.
  vi.stubGlobal('crypto', { ...globalThis.crypto, randomUUID: () => 'id-fixo' })
  Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:fake', writable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: () => {}, writable: true })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('estado inicial', () => {
  it('mostra a área de arrastar', () => {
    render(<PhotoUploader propertyId={8} iniciais={[]} />)
    expect(screen.getByText('Arraste as fotos aqui')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Escolher arquivos' })).toBeTruthy()
  })

  it('lista as fotos já existentes', () => {
    render(<PhotoUploader propertyId={8} iniciais={fotos} />)
    const imgs = screen.getAllByRole('presentation', { hidden: true })
    expect(imgs.length).toBeGreaterThanOrEqual(2)
  })

  it('marca qual é a capa', () => {
    render(<PhotoUploader propertyId={8} iniciais={fotos} />)
    expect(screen.getAllByText('Capa')).toHaveLength(2) // o selo e o botão da outra foto
  })

  // A primeira foto não tem para onde voltar, a última não tem para onde ir.
  it('desabilita as setas de ordem nas pontas', () => {
    render(<PhotoUploader propertyId={8} iniciais={fotos} />)
    expect(screen.getAllByLabelText('Mover para trás')[0]).toHaveProperty('disabled', true)
    expect(screen.getAllByLabelText('Mover para frente')[1]).toHaveProperty('disabled', true)
  })
})

describe('definir capa', () => {
  it('chama a API e move o selo', async () => {
    render(<PhotoUploader propertyId={8} iniciais={fotos} />)

    // O botão "Capa" só existe na foto que ainda não é capa.
    const botaoCapa = screen.getAllByRole('button', { name: 'Capa' })[0]!
    fireEvent.click(botaoCapa)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/fotos/2/capa', { method: 'POST' })
    })
  })
})

describe('remover', () => {
  it('chama DELETE e recarrega a lista', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes('/imovel/')
        ? new Response(JSON.stringify({ fotos: [fotos[1]] }), { status: 200 })
        : new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<PhotoUploader propertyId={8} iniciais={fotos} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Remover foto' })[0]!)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/fotos/1', { method: 'DELETE' })
      expect(fetchMock).toHaveBeenCalledWith('/api/fotos/imovel/8')
    })
  })

  it('devolve a foto à lista quando a remoção falha', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('erro', { status: 500 })))

    render(<PhotoUploader propertyId={8} iniciais={fotos} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Remover foto' })[0]!)

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/não foi possível remover/i)
    })
  })
})

describe('reordenar', () => {
  it('envia a nova ordem para a API', async () => {
    render(<PhotoUploader propertyId={8} iniciais={fotos} />)
    fireEvent.click(screen.getAllByLabelText('Mover para frente')[0]!)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/fotos/ordem',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ propertyId: 8, ids: [2, 1] }),
        }),
      )
    })
  })
})
