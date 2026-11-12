/**
 * Valida o destino de volta que chega pela URL.
 *
 * A página de bairros recebe `?voltar=<caminho>` para devolver quem estava no
 * meio de um cadastro. Esse valor vem de fora, e redirecionar para ele sem
 * conferir transformaria a página num redirecionador aberto: bastaria mandar
 * para a vítima um link do painel que termina em outro site, com a confiança
 * do domínio certo na barra de endereço.
 *
 * Por isso só passa caminho interno do painel, nunca endereço absoluto.
 */
export function destinoSeguro(bruto: string | null | undefined): string | null {
  if (!bruto) return null
  // `//outro.site` é endereço absoluto sem esquema, e o navegador o segue.
  if (bruto.startsWith('//')) return null
  return bruto.startsWith('/admin/') ? bruto : null
}
