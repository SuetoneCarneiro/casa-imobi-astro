/**
 * Cria o primeiro administrador ou redefine a senha de um usuário existente.
 *
 *   npm run admin:create -- "Nome Sobrenome" email@dominio.com senhaSegura
 *   npm run admin:create -- "Nome" email@dominio.com senha --remote
 *   npm run admin:create -- "Nome" email@dominio.com senha --papel=manager
 *
 * Existe para resolver o problema do ovo e da galinha: o painel cria usuários,
 * mas só um administrador logado chega até ele. Depois do primeiro acesso, a
 * gestão de usuários é toda pelo painel.
 *
 * Importa o MESMO hashPassword que o Worker usa, em vez de reimplementar o
 * algoritmo aqui. Se as iterações mudarem no serviço, este script acompanha.
 */
import { execFileSync } from 'node:child_process'
import { hashPassword } from '../src/server/services/password.ts'
import { resolverPapelDoScript } from '../src/server/services/permissions.ts'

const PAPEIS = ['admin', 'manager', 'agent']

const args = process.argv.slice(2)
const remoto = args.includes('--remote')
const papelPedido = args.find((a) => a.startsWith('--papel='))?.slice('--papel='.length)
const [nome, email, senha] = args.filter((a) => !a.startsWith('--'))

const uso =
  'Uso: npm run admin:create -- "Nome" email@dominio.com senha [--remote] [--papel=admin|manager|agent]'

if (!nome || !email || !senha) {
  console.error(uso)
  process.exit(1)
}

if (senha.length < 8) {
  console.error('A senha precisa ter pelo menos 8 caracteres.')
  process.exit(1)
}

if (papelPedido && !PAPEIS.includes(papelPedido)) {
  console.error(`Papel inválido: ${papelPedido}. Use um de: ${PAPEIS.join(', ')}.`)
  process.exit(1)
}

const alvo = remoto ? '--remote' : '--local'
const emailNormalizado = email.trim().toLowerCase()
const escapar = (v) => `'${String(v).replace(/'/g, "''")}'`

function executar(sql, json = false) {
  const flags = ['wrangler', 'd1', 'execute', 'casaimobi', alvo, '--command', sql]
  if (json) flags.push('--json')
  return execFileSync('npx', flags, {
    stdio: json ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
  })
}

const saida = executar(
  `SELECT role, active FROM users WHERE email = ${escapar(emailNormalizado)}`,
  true,
)
const existente = JSON.parse(saida)[0]?.results?.[0] ?? null

const papel = resolverPapelDoScript(papelPedido, existente?.role)

if (existente && papelPedido && papelPedido !== existente.role) {
  console.log(`Atenção: o papel de ${emailNormalizado} vai mudar de ${existente.role} para ${papel}.`)
}

const sql = `
INSERT INTO users (name, email, password_hash, role, active)
VALUES (${escapar(nome)}, ${escapar(emailNormalizado)}, ${escapar(await hashPassword(senha))}, ${escapar(papel)}, 1)
ON CONFLICT(email) DO UPDATE SET
  name = excluded.name,
  password_hash = excluded.password_hash,
  role = ${escapar(papel)},
  active = 1,
  updated_at = unixepoch() * 1000;
`.trim()

const acao = existente ? 'Redefinindo a senha de' : 'Criando'
console.log(`${acao} ${emailNormalizado} (papel: ${papel}) no banco ${remoto ? 'REMOTO' : 'local'}...`)

executar(sql)

if (existente && !existente.active) {
  console.log('O acesso estava bloqueado e foi liberado.')
}
console.log(`\nPronto. Entre em /login com ${emailNormalizado}.`)
