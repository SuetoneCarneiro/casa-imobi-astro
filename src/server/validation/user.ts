import { z } from 'zod'

/** Mínimo de oito caracteres, mesma regra do script de criação de admin. */
const senha = z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.').max(200)

const base = {
  name: z.string().trim().min(3, 'Informe o nome completo.').max(120),
  email: z.email('Informe um e-mail válido.').max(160),
  role: z.enum(['admin', 'manager', 'agent'], { message: 'Escolha um papel.' }),
  active: z.boolean().default(true),
}

export const novoUsuarioSchema = z.object({ ...base, senha })

/** Na edição a senha é opcional: em branco significa manter a atual. */
export const edicaoUsuarioSchema = z.object({
  ...base,
  senha: z.union([senha, z.literal('')]).optional(),
})

export type NovoUsuario = z.infer<typeof novoUsuarioSchema>
export type EdicaoUsuario = z.infer<typeof edicaoUsuarioSchema>
export type ErrosDeUsuario = Partial<Record<keyof NovoUsuario, string>>

function texto(form: FormData, campo: string) {
  return String(form.get(campo) ?? '').trim()
}

function camposDoForm(form: FormData) {
  return {
    name: texto(form, 'name'),
    email: texto(form, 'email').toLowerCase(),
    role: texto(form, 'role'),
    active: form.get('active') !== null,
    senha: String(form.get('senha') ?? ''),
  }
}

// Duas funções em vez de um parâmetro de modo: assim o tipo do resultado já
// diz se a senha é obrigatória, sem o chamador precisar estreitar a união.
export function parseNovoUsuario(form: FormData) {
  return novoUsuarioSchema.safeParse(camposDoForm(form))
}

export function parseEdicaoUsuario(form: FormData) {
  return edicaoUsuarioSchema.safeParse(camposDoForm(form))
}

export function errosDeUsuario(error: z.ZodError): ErrosDeUsuario {
  const saida: ErrosDeUsuario = {}
  for (const issue of error.issues) {
    const campo = issue.path[0] as keyof NovoUsuario | undefined
    if (campo && !saida[campo]) saida[campo] = issue.message
  }
  return saida
}
