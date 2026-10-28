/**
 * Cria o primeiro administrador ou redefine a senha de um usuário existente.
 *
 *   npm run admin:create -- "Nome Sobrenome" email@dominio.com --remote
 *   npm run admin:create -- "Nome" email@dominio.com senhaSegura
 *   npm run admin:create -- "Nome" email@dominio.com --papel=manager
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
const MINIMO = 8

const args = process.argv.slice(2)
const remoto = args.includes('--remote')
const papelPedido = args.find((a) => a.startsWith('--papel='))?.slice('--papel='.length)
const [nome, email, senhaDoComando] = args.filter((a) => !a.startsWith('--'))

const uso =
  'Uso: npm run admin:create -- "Nome" email@dominio.com [senha] [--remote] [--papel=admin|manager|agent]'

function abortar(mensagem) {
  console.error(mensagem)
  process.exit(1)
}

if (!nome || !email) abortar(uso)
if (papelPedido && !PAPEIS.includes(papelPedido)) {
  abortar(`Papel inválido: ${papelPedido}. Use um de: ${PAPEIS.join(', ')}.`)
}
/* Lê uma ou mais senhas do teclado sem ecoar o que é digitado.
* antes a senha ficava visível no "ps" para qualquer processo na máquina e ficava
* no histórico
*/
function pedirSenhas(rotulos) {
  return new Promise((resolve) => {
    const respostas = []
    let atual = ''

    // Modo cru antes do primeiro rótulo, senão o que for digitado adiantado
    // ainda é ecoado pelo terminal.
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    process.stdout.write(rotulos[0])

    const encerrar = (valor) => {
      process.stdin.setRawMode(false)
      process.stdin.pause()
      process.stdin.off('data', aoDigitar)
      resolve(valor)
    }

    // Colar entrega vários caracteres de uma vez, então o pedaço é percorrido
    // em vez de tratado como uma tecla só.
    function aoDigitar(pedaco) {
      for (const tecla of pedaco) {
        if (tecla === '\u0003') {
          encerrar(null)
          process.stdout.write('\n')
          process.exit(130)
        }
        if (tecla === '\r' || tecla === '\n' || tecla === '\u0004') {
          respostas.push(atual)
          atual = ''
          process.stdout.write('\n')
          if (respostas.length === rotulos.length) return encerrar(respostas)
          process.stdout.write(rotulos[respostas.length])
          continue
        }
        if (tecla === '\u007f' || tecla === '\b') {
          if (atual.length > 0) {
            atual = atual.slice(0, -1)
            process.stdout.write('\b \b')
          }
          continue
        }
        if (tecla >= ' ') {
          atual += tecla
          process.stdout.write('*')
        }
      }
    }

    process.stdin.on('data', aoDigitar)
  })
}

/** Fora de um terminal (script, CI), aceita a senha vinda da entrada padrão. */
function lerSenhaDaEntrada() {
  return new Promise((resolve) => {
    let bruto = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (p) => (bruto += p))
    process.stdin.on('end', () => resolve(bruto.split('\n')[0].trim()))
  })
}

async function obterSenha(email) {
  if (senhaDoComando) return senhaDoComando
  if (!process.stdin.isTTY) return lerSenhaDaEntrada()

  const [senha, confirmacao] = await pedirSenhas([`Senha para ${email}: `, 'Repita a senha: '])
  if (senha !== confirmacao) abortar('As senhas não conferem. Nada foi gravado.')

  return senha
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

const senha = await obterSenha(emailNormalizado)
if (!senha) abortar('Nenhuma senha informada. Nada foi gravado.')
if (senha.length < MINIMO) abortar(`A senha precisa ter pelo menos ${MINIMO} caracteres.`)

if (senhaDoComando) {
  console.log('Aviso: senha passada no comando fica no histórico do shell e visível no `ps`.')
  console.log('       Omita a senha para que ela seja pedida sem aparecer na tela.\n')
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

if (existente && !existente.active) console.log('O acesso estava bloqueado e foi liberado.')
console.log(`\nPronto. Entre em /login com ${emailNormalizado}.`)
