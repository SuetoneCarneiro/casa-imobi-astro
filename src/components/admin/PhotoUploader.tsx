import { useCallback, useEffect, useRef, useState } from 'react'

type Foto = {
  id: number
  position: number
  isCover: boolean
  alt: string | null
  thumbUrl: string
  mdUrl: string
}

type Pendente = {
  localId: string
  nome: string
  preview: string
  progresso: number
  erro?: string
}

const LARGURAS = { thumb: 400, md: 1024, full: 1920 } as const
const QUALIDADE = { thumb: 0.78, md: 0.82, full: 0.84 } as const
const SIMULTANEOS = 3
const TAMANHO_MAX = 25 * 1024 * 1024

function paraBlob(canvas: HTMLCanvasElement, tipo: string, qualidade: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, tipo, qualidade))
}

/**
 * Codifica o canvas, preferindo WebP.
 *
 * A especificação permite o navegador IGNORAR o tipo pedido e devolver outro,
 * sem erro e sem aviso. Quem não codifica WebP devolve PNG, que para foto fica
 * enorme. Então conferimos o que saiu e, se não foi WebP, pedimos JPEG de
 * propósito, que todo navegador codifica e é adequado para fotografia.
 */
async function codificar(canvas: HTMLCanvasElement, qualidade: number) {
  const webp = await paraBlob(canvas, 'image/webp', qualidade)
  if (webp && webp.type === 'image/webp') return webp
  return (await paraBlob(canvas, 'image/jpeg', qualidade)) ?? webp
}

/**
 * Gera as três variantes no navegador.
 *
 * É o que permite não usar o Cloudflare Images, que é pago, e não gastar CPU do
 * Worker. O servidor só recebe imagem já pronta e guarda.
 */
async function gerarVariantes(file: File) {
  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap

  const variantes = await Promise.all(
    (Object.keys(LARGURAS) as (keyof typeof LARGURAS)[]).map(async (nome) => {
      const alvo = Math.min(LARGURAS[nome], width)
      const w = Math.round(alvo)
      const h = Math.round((height * alvo) / width)

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas indisponível')
      ctx.drawImage(bitmap, 0, 0, w, h)

      const blob = await codificar(canvas, QUALIDADE[nome])
      if (!blob) throw new Error('Falha ao converter a imagem')
      return [nome, blob] as const
    }),
  )

  bitmap.close()
  return { width, height, variantes: Object.fromEntries(variantes) as Record<string, Blob> }
}

/** fetch não expõe progresso de upload, então aqui é XHR mesmo. */
function enviarComProgresso(url: string, form: FormData, onProgress: (p: number) => void) {
  return new Promise<{ ok: boolean; status: number; body: unknown }>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    })
    xhr.addEventListener('load', () => {
      let body: unknown = null
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        /* resposta sem JSON */
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, body })
    })
    xhr.addEventListener('error', () => reject(new Error('Falha de rede')))
    xhr.send(form)
  })
}

export default function PhotoUploader({
  propertyId,
  iniciais,
}: {
  propertyId: number
  iniciais: Foto[]
}) {
  const [fotos, setFotos] = useState<Foto[]>(iniciais)
  const [pendentes, setPendentes] = useState<Pendente[]>([])
  const [arrastando, setArrastando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Libera as URLs de preview para não vazar memória.
  useEffect(() => {
    return () => pendentes.forEach((p) => URL.revokeObjectURL(p.preview))
  }, [])

  const enviarUm = useCallback(
    async (file: File) => {
      const localId = crypto.randomUUID()
      const preview = URL.createObjectURL(file)
      setPendentes((p) => [...p, { localId, nome: file.name, preview, progresso: 0 }])

      const marcarErro = (erro: string) =>
        setPendentes((p) => p.map((i) => (i.localId === localId ? { ...i, erro } : i)))

      try {
        const { width, height, variantes } = await gerarVariantes(file)

        const form = new FormData()
        form.append('width', String(width))
        form.append('height', String(height))
        for (const [nome, blob] of Object.entries(variantes)) {
          // A extensão acompanha o que o navegador produziu de fato.
          const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg'
          form.append(nome, blob, `${nome}.${ext}`)
        }

        const resposta = await enviarComProgresso(
          `/api/fotos/imovel/${propertyId}`,
          form,
          (progresso) =>
            setPendentes((p) => p.map((i) => (i.localId === localId ? { ...i, progresso } : i))),
        )

        if (!resposta.ok) {
          const msg = (resposta.body as { error?: string } | null)?.error
          marcarErro(msg ?? `Erro ${resposta.status}`)
          return
        }

        const nova = (resposta.body as { foto: Foto }).foto
        setFotos((f) => [...f, nova])
        setPendentes((p) => p.filter((i) => i.localId !== localId))
        URL.revokeObjectURL(preview)
      } catch (e) {
        marcarErro(
          e instanceof Error && e.message.includes('decode')
            ? 'Formato não suportado pelo navegador (HEIC do iPhone, por exemplo).'
            : 'Não foi possível processar esta imagem.',
        )
      }
    },
    [propertyId],
  )

  /** Fila com limite de simultâneos: 20 uploads de uma vez travariam o navegador. */
  const enviarVarios = useCallback(
    async (lista: File[]) => {
      setAviso(null)
      const validos = lista.filter((f) => {
        if (!f.type.startsWith('image/')) return false
        if (f.size > TAMANHO_MAX) {
          setAviso(`${f.name} passa de 25 MB e foi ignorada.`)
          return false
        }
        return true
      })

      const fila = [...validos]
      const trabalhadores = Array.from({ length: Math.min(SIMULTANEOS, fila.length) }, async () => {
        while (fila.length > 0) {
          const proximo = fila.shift()
          if (proximo) await enviarUm(proximo)
        }
      })
      await Promise.all(trabalhadores)
    },
    [enviarUm],
  )

  async function definirCapa(id: number) {
    setFotos((f) => f.map((i) => ({ ...i, isCover: i.id === id })))
    await fetch(`/api/fotos/${id}/capa`, { method: 'POST' })
  }

  async function remover(id: number) {
    const antes = fotos
    setFotos((f) => f.filter((i) => i.id !== id))
    const r = await fetch(`/api/fotos/${id}`, { method: 'DELETE' })
    if (!r.ok) {
      setFotos(antes)
      setAviso('Não foi possível remover a foto.')
      return
    }
    // A capa pode ter sido promovida no servidor: recarrega para refletir.
    const lista = (await fetch(`/api/fotos/imovel/${propertyId}`).then((x) => x.json())) as {
      fotos: Foto[]
    }
    setFotos(lista.fotos)
  }

  async function mover(id: number, direcao: -1 | 1) {
    const i = fotos.findIndex((f) => f.id === id)
    const j = i + direcao
    if (i < 0 || j < 0 || j >= fotos.length) return

    const nova = [...fotos]
    ;[nova[i], nova[j]] = [nova[j]!, nova[i]!]
    setFotos(nova)

    await fetch('/api/fotos/ordem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId, ids: nova.map((f) => f.id) }),
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setArrastando(true)
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault()
          setArrastando(false)
          void enviarVarios(Array.from(e.dataTransfer.files))
        }}
        className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          arrastando ? 'border-brand-500 bg-brand-50' : 'border-brand-200 bg-white'
        }`}
      >
        <p className="font-display text-base font-semibold text-ink">
          Arraste as fotos aqui
        </p>
        <p className="text-sm text-ink-muted">
          JPG ou PNG. São redimensionadas e comprimidas no seu navegador antes de subir.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-2 h-10 rounded-lg bg-brand-900 px-4 text-sm font-medium text-white hover:bg-brand-800"
        >
          Escolher arquivos
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void enviarVarios(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
      </div>

      {aviso && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {aviso}
        </p>
      )}

      {(fotos.length > 0 || pendentes.length > 0) && (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {fotos.map((foto, indice) => (
            <li
              key={foto.id}
              className="overflow-hidden rounded-xl border border-brand-100 bg-white"
            >
              <div className="relative aspect-[4/3] bg-brand-50">
                <img src={foto.thumbUrl} alt="" className="size-full object-cover" />
                {foto.isCover && (
                  <span className="absolute top-2 left-2 rounded-full bg-brand-900 px-2 py-0.5 text-[11px] font-medium text-white">
                    Capa
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 p-2">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => void mover(foto.id, -1)}
                    disabled={indice === 0}
                    aria-label="Mover para trás"
                    className="size-7 rounded border border-brand-200 text-xs text-ink-soft disabled:opacity-30"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => void mover(foto.id, 1)}
                    disabled={indice === fotos.length - 1}
                    aria-label="Mover para frente"
                    className="size-7 rounded border border-brand-200 text-xs text-ink-soft disabled:opacity-30"
                  >
                    →
                  </button>
                </div>
                <div className="flex gap-1">
                  {!foto.isCover && (
                    <button
                      type="button"
                      onClick={() => void definirCapa(foto.id)}
                      className="h-7 rounded border border-brand-200 px-2 text-xs text-ink-soft hover:bg-brand-50"
                    >
                      Capa
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void remover(foto.id)}
                    aria-label="Remover foto"
                    className="h-7 rounded border border-red-200 px-2 text-xs text-red-700 hover:bg-red-50"
                  >
                    Remover
                  </button>
                </div>
              </div>
            </li>
          ))}

          {pendentes.map((p) => (
            <li key={p.localId} className="overflow-hidden rounded-xl border border-brand-100 bg-white">
              <div className="relative aspect-[4/3] bg-brand-50">
                <img src={p.preview} alt="" className="size-full object-cover opacity-50" />
                {!p.erro && (
                  <div className="absolute inset-x-3 bottom-3 h-1.5 overflow-hidden rounded-full bg-white/70">
                    <div
                      className="h-full bg-brand-600 transition-[width]"
                      style={{ width: `${p.progresso}%` }}
                    />
                  </div>
                )}
              </div>
              <p className={`p-2 text-xs ${p.erro ? 'text-red-700' : 'text-ink-muted'}`}>
                {p.erro ?? `Enviando… ${p.progresso}%`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
