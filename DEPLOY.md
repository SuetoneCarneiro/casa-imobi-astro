# Publicar na Cloudflare

Passo a passo do primeiro deploy. Depois dele, publicar uma mudança é só o
passo 7.

Cada passo tem **como saber que deu certo**. Não siga adiante sem isso: um erro
no passo 2 ou 3 só aparece lá no 5, e aí fica difícil achar.

> **Pare o servidor de desenvolvimento antes de qualquer `build`.**
> `astro dev stop`. O motivo está no `AGENTS.md`.

---

## 1. Entrar na conta

```sh
npx wrangler login
```

Abre o navegador para autorizar. Só precisa uma vez por máquina.

**Confere:** `npx wrangler whoami` mostra o e-mail da conta.

---

## 2. Criar o banco

```sh
npx wrangler d1 create casaimobi
```

A saída termina com um bloco parecido com este:

```
[[d1_databases]]
binding = "DB"
database_name = "casaimobi"
database_id = "a1b2c3d4-...."
```

**Guarde o `database_id`.** É o que falta no passo 3.

**Confere:** `npx wrangler d1 list` mostra `casaimobi`.

---

## 3. Colar o id no `wrangler.jsonc`

Abra `wrangler.jsonc` e troque o valor de exemplo pelo id do passo 2:

```jsonc
"database_id": "00000000-0000-0000-0000-000000000000",   // ← trocar
```

Aproveite para apagar os dois comentários que dizem "será criado futuramente",
logo acima dos blocos `d1_databases` e `r2_buckets`. Eles deixaram de valer.

**Confere:** não sobrou nenhum `00000000` no arquivo.

---

## 4. Criar o bucket das fotos

```sh
npx wrangler r2 bucket create casaimobi-images
```

O nome precisa ser exatamente esse, porque é o que está no `wrangler.jsonc`.

Se a Cloudflare pedir para ativar o R2 na conta antes, siga o que ela pedir.
Dentro de 10 GB de armazenamento o R2 não cobra, e **saída de dados é sempre de
graça**, que foi a razão de escolher R2 em vez de S3.

**Confere:** `npx wrangler r2 bucket list` mostra `casaimobi-images`.

---

## 5. Criar as tabelas no banco remoto

```sh
npm run db:migrate:prod
```

Aplica as três migrations em ordem. O banco fica com a estrutura pronta e
**vazio**.

> **Nunca rode `npm run db:seed` contra produção.** Ele começa com
> `DELETE FROM users` e insere imóveis fictícios. Por isso o script é fixo em
> `--local` e não existe uma versão `:prod`. A ausência é proposital.

**Confere:**

```sh
npx wrangler d1 execute casaimobi --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
```

Devem aparecer `users`, `sessions`, `properties`, `property_images` e
`neighborhoods`.

---

## 6. Conferir que nada ficou para trás no schema

```sh
npm run db:generate
```

Tem que responder **`No schema changes, nothing to migrate`**.

Se gerar um arquivo novo, pare: significa que o `schema.ts` e as migrations
divergiram, e aplicar isso em produção depois daria problema. Apague o arquivo
gerado e investigue antes de seguir.

---

## 7. Publicar

```sh
astro dev stop
npm run deploy
```

Isso faz o build e envia. A saída termina com o endereço, algo como
`https://casa-imobi-astro.<sua-conta>.workers.dev`.

**Confere:**

```sh
curl https://casa-imobi-astro.<sua-conta>.workers.dev/api/health
```

Tem que responder `{"ok":true,...}` com `db` e `bucket` em `true`. É essa rota
que prova que os dois bindings chegaram até o Worker.

Se precisar desfazer: `npx wrangler rollback`.

---

## 8. Criar o primeiro acesso

```sh
npm run admin:create -- "Nome da Pessoa" email@casaimobi.com.br --remote
```

A senha é pedida sem aparecer na tela, e repetida para conferir. **Não passe a
senha no comando**: ela ficaria no histórico do shell e visível na lista de
processos da máquina.

Este é o problema do ovo e da galinha: o painel cria usuários, mas só um
administrador logado chega até lá. Do segundo usuário em diante, tudo pelo
painel, em `/admin/usuarios`.

**Confere:** entrar em `/login` com esse e-mail.

---

## 9. Olhar o tempo de CPU

Este projeto está no **plano gratuito, que dá 10 ms de CPU por requisição**, e
o login consome cerca de 7,5 ms só para conferir a senha. Pode caber ou não.

No painel da Cloudflare, em **Workers & Pages → casa-imobi-astro**, procure as
métricas de CPU por requisição. Faça alguns logins e veja onde o `/api/auth/login`
fica.

**Se o login começar a falhar** com erro de limite de recursos (código 1102), há
duas saídas:

1. Assinar o Workers Paid (US$ 5/mês), que sobe o limite para 30 segundos.
2. Baixar as iterações do PBKDF2 em `src/server/services/password.ts`, de
   100000 para 50000, e publicar de novo.

A segunda **não invalida nenhuma senha já cadastrada**: o número de iterações
fica guardado dentro do próprio hash (`pbkdf2$100000$...`), então as antigas
continuam sendo conferidas com 100000 e só as novas nascem com o valor novo.
Mas enfraquece a proteção, então prefira a primeira se puder.

---

## 10. Limitar tentativas de login

Isso é configuração no painel, não código. Em **Security → WAF → Rate limiting
rules**, crie uma regra para o caminho `/api/auth/login`, método `POST`,
limitando por IP algo como 10 tentativas a cada 10 minutos.

Sem isso, alguém pode testar senhas à vontade. O login já não revela se o
e-mail existe, mas nada impede a repetição.

---

## 11. Backup do banco

```sh
npx wrangler d1 export casaimobi --remote --output=backup-$(date +%F).sql
```

Rode antes de qualquer migration nova e de tempos em tempos. Guarde fora da
Cloudflare.

O D1 tem recuperação de ponto no tempo (Time Travel), que cobre engano recente,
mas não cobre perder acesso à conta. Um arquivo seu cobre.

---

## 12. Quando o domínio próprio entrar

Três coisas, nesta ordem:

1. No painel da Cloudflare, em **Workers & Pages → casa-imobi-astro →
   Settings → Domains & Routes**, adicione `casaimobi.com.br`.
2. Em `src/lib/site.ts`, troque `url: null` por
   `url: 'https://casaimobi.com.br'`.
3. `npm run deploy`.

O passo 2 é o que **abre o site para os buscadores**: enquanto for `null`, o
`robots.txt` recusa tudo e toda página sai com `noindex`. Isso é de propósito,
para o endereço provisório não virar uma cópia disputando busca com o site que
a imobiliária já tem no ar.

**Confere:** `curl https://casaimobi.com.br/robots.txt` passa a mostrar
`Allow: /` e a linha do `Sitemap`.

---

## Publicações seguintes

```sh
astro dev stop
npm run deploy
```

Se a mudança mexer no banco:

```sh
npm run db:generate     # gera a migration a partir do schema
npm run db:migrate      # aplica no local e testa
npm run db:migrate:prod # só depois, no remoto
npm run deploy
```

Migration vai sempre **antes** do deploy: código novo com banco velho quebra na
hora, banco novo com código velho normalmente aguenta.
