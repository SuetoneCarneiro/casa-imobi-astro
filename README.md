# CasaImobi

Site institucional e painel de gestão de imóveis da **CasaImobi Negócios
Imobiliários** (CRECI 20.930-J), em Caruaru/PE.

O site público lista o acervo e leva o interessado ao WhatsApp. O painel, em
`/admin`, é onde a equipe cadastra imóveis, envia fotos e gerencia acessos.

## Stack

Tudo roda num **único Worker** na Cloudflare:

| Peça | Papel |
|---|---|
| [Astro](https://docs.astro.build) | monta as páginas do site e do painel |
| [Hono](https://hono.dev) | responde a API usada pelo envio de fotos |
| D1 | banco de dados (SQLite) |
| R2 | arquivos das fotos |
| Drizzle | schema e migrations |
| Tailwind | estilos |
| React | uma única ilha, o enviador de fotos |

As fotos são redimensionadas **no navegador** antes do envio, em três variantes.
O Worker não processa imagem, o que dispensa o Cloudflare Images.

## Rodando

```sh
npm install
npm run db:reset     # aplica as migrations e semeia dados de desenvolvimento
astro dev --background
```

O banco e o bucket são locais, emulados pelo wrangler. Não há string de conexão.

Para entrar no painel, crie um acesso:

```sh
npm run admin:create -- "Seu Nome" voce@exemplo.com
```

A senha é pedida sem aparecer na tela.

> **Pare o servidor antes de `astro build`, `astro check` ou `npm i`.** Os três
> sobem um Vite próprio e reotimizam as dependências no mesmo diretório, e o
> servidor em execução quebra com um erro enganoso sobre `deps_ssr`. Detalhes em
> `AGENTS.md`.

## Comandos

| Comando | O que faz |
|---|---|
| `astro dev --background` | servidor de desenvolvimento (`stop`, `status`, `logs`) |
| `npm run build` | build de produção |
| `npm run check` | checagem de tipos |
| `npm test` | testes (`test:api`, `test:ui`, `test:cov`) |
| `npm run db:generate` | gera migration a partir do schema |
| `npm run db:migrate` | aplica migrations no banco local (`:prod` no remoto) |
| `npm run db:reset` | recria o banco local e semeia |
| `npm run admin:create` | cria acesso ao painel ou redefine senha |

## Antes de publicar

O `wrangler.jsonc` ainda tem `database_id` de exemplo. Antes do primeiro deploy
é preciso criar os recursos de verdade, trocar o id, aplicar as migrations no
banco remoto e criar o primeiro administrador.

Defina também `url` em `src/lib/site.ts`: enquanto for `null`, o site se
mantém fora dos buscadores e não emite canonical, que é o certo para um
endereço provisório.
