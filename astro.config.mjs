// @ts-check
import { defineConfig } from 'astro/config'

import tailwindcss from '@tailwindcss/vite'
import cloudflare from '@astrojs/cloudflare'

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  // O site lê imóveis do D1 a cada request. Páginas que puderem ser estáticas
  // optam por isso individualmente com `export const prerender = true`.
  output: 'server',

  vite: {
    plugins: [tailwindcss()],
  },

  // A sessão do painel é nossa, guardada no D1. Sem este `false` o adapter
  // liga a sessão do Astro sobre KV e provisiona um namespace que nunca é lido.
  session: false,

  // O adapter v14 roda sobre o @cloudflare/vite-plugin: o `astro dev` executa
  // dentro do workerd com os bindings do wrangler.jsonc já disponíveis.
  adapter: cloudflare({
    /*
     * `passthrough`: nenhuma imagem é transformada no servidor.
     *
     * O padrão do adapter provisiona o binding do Cloudflare Images, que é
     * serviço pago, e o projeto não usa nada disso: as fotos já chegam
     * redimensionadas pelo navegador na hora do envio, e são servidas do R2
     * como arquivo estático.
     */
    imageService: 'passthrough',
  }),

  integrations: [react()],
})