/**
 * Hash de senha com PBKDF2 via Web Crypto.
 *
 * Workers não roda argon2 nem bcrypt nativo, e trazer um wasm para isso não se
 * justifica nesta escala. PBKDF2 está disponível na plataforma e é adequado
 * desde que o número de iterações seja alto.
 *
 * Formato guardado: pbkdf2$<iteracoes>$<salt_b64>$<hash_b64>
 * Guardar as iterações junto permite aumentá-las no futuro sem invalidar as
 * senhas antigas.
 */

const ITERATIONS = 100_000
const DIGEST = 'SHA-256'
const KEY_BITS = 256
const SALT_BYTES = 16

const encoder = new TextEncoder()

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

// O parâmetro <ArrayBuffer> importa: o Web Crypto exige um buffer não
// compartilhado, e o Uint8Array genérico admitiria SharedArrayBuffer.
function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0))
}

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: DIGEST },
    key,
    KEY_BITS,
  )
  return new Uint8Array(bits)
}

/** Comparação em tempo constante: sair no primeiro byte diferente vaza informação. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!
  return diff === 0
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const derived = await derive(password, salt, ITERATIONS)
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(derived)}`
}

/**
 * Devolve false para qualquer hash malformado, o que cobre de propósito o `'!'`
 * do seed: usuário semeado não consegue entrar até receber uma senha de verdade.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false

  const iterations = Number(parts[1])
  if (!Number.isInteger(iterations) || iterations < 1000) return false

  try {
    const derived = await derive(password, fromBase64(parts[2]!), iterations)
    return timingSafeEqual(derived, fromBase64(parts[3]!))
  } catch {
    return false
  }
}
