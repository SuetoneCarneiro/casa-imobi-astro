/**
 * Cria (ou redefine a senha de) um usuário do painel.
 *
 *   npm run admin:create -- "Nome Sobrenome" email@dominio.com senhaSegura
 *   npm run admin:create -- "Nome" email@dominio.com senha --remote
 *
 * Importa o MESMO hashPassword que o Worker usa, em vez de reimplementar o
 * algoritmo aqui. Se as iterações mudarem no serviço, este script acompanha.
 */
import { execFileSync } from 'node:child_process'
import { hashPassword } from '../src/server/services/password.ts'

const args = process.argv.slice(2)
const remoto = args.includes('--remote')
const [nome, email, senha] = args.filter((a) => a !== '--remote')

if (!nome || !email || !senha) {
  console.error('Uso: npm run admin:create -- "Nome" email@dominio.com senha [--remote]')
  process.exit(1)
}

if (senha.length < 8) {
  console.error('A senha precisa ter pelo menos 8 caracteres.')
  process.exit(1)
}

const escapar = (v) => `'${String(v).replace(/'/g, "''")}'`

const hash = await hashPassword(senha)
const sql = `
INSERT INTO users (name, email, password_hash, role, active)
VALUES (${escapar(nome)}, ${escapar(email.trim().toLowerCase())}, ${escapar(hash)}, 'admin', 1)
ON CONFLICT(email) DO UPDATE SET
  name = excluded.name,
  password_hash = excluded.password_hash,
  role = 'admin',
  active = 1,
  updated_at = unixepoch() * 1000;
`.trim()

const alvo = remoto ? '--remote' : '--local'
console.log(`Gravando ${email} no banco ${remoto ? 'REMOTO' : 'local'}...`)

execFileSync('npx', ['wrangler', 'd1', 'execute', 'casaimobi', alvo, '--command', sql], {
  stdio: 'inherit',
})

console.log(`\nPronto. Entre em /login com ${email}.`)
