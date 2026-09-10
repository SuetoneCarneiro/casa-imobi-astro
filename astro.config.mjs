// @ts-check
import { defineConfig } from 'astro/config'

import tailwindcss from '@tailwindcss/vite'
import cloudflare from '@astrojs/cloudflare'

// https://astro.build/config
export default defineConfig({
  // O site lê imóveis do D1 a cada request. Páginas que puderem ser estáticas
  // optam por isso individualmente com `export const prerender = true`.
  output: 'server',

  vite: {
    plugins: [tailwindcss()],
  },

  // O adapter v14 roda sobre o @cloudflare/vite-plugin: o `astro dev` executa
  // dentro do workerd com os bindings do wrangler.jsonc já disponíveis.
  adapter: cloudflare(),
})
