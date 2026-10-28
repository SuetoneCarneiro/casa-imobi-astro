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

/**
 * Troca de senha pela própria pessoa. Pede a senha atual porque sessão aberta
 * não é prova de identidade: basta um computador destravado para alguém trocar
 * a senha de outro e tomar a conta.
 */
export const trocaDeSenhaSchema = z
  .object({
    atual: z.string().min(1, 'Informe a senha atual.'),
    nova: senha,
    confirmacao: z.string(),
  })
  .refine((d) => d.nova === d.confirmacao, {
    message: 'A confirmação não confere com a nova senha.',
    path: ['confirmacao'],
  })

export type TrocaDeSenha = z.infer<typeof trocaDeSenhaSchema>
export type ErrosDeTroca = Partial<Record<keyof TrocaDeSenha, string>>

export function parseTrocaDeSenha(form: FormData) {
  return trocaDeSenhaSchema.safeParse({
    atual: String(form.get('atual') ?? ''),
    nova: String(form.get('nova') ?? ''),
    confirmacao: String(form.get('confirmacao') ?? ''),
  })
}

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

/** Primeira mensagem de cada campo. A segunda só repetiria o mesmo problema. */
export function primeirosErros<C extends string>(error: z.ZodError): Partial<Record<C, string>> {
  const saida: Partial<Record<C, string>> = {}
  for (const issue of error.issues) {
    const campo = issue.path[0] as C | undefined
    if (campo && !saida[campo]) saida[campo] = issue.message
  }
  return saida
}

export const errosDeUsuario = (error: z.ZodError) => primeirosErros<keyof NovoUsuario>(error)
export const errosDeTroca = (error: z.ZodError) => primeirosErros<keyof TrocaDeSenha>(error)
