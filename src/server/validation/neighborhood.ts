import { z } from 'zod'

export const bairroSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Informe o nome do bairro.')
    .max(80, 'No máximo 80 caracteres.'),
})

export type BairroInput = z.infer<typeof bairroSchema>

export function parseBairro(form: FormData) {
  return bairroSchema.safeParse({ name: String(form.get('name') ?? '') })
}
