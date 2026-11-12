/**
 * Valida o destino de volta que chega pela URL.
 *
 * A página de bairros recebe `?voltar=<caminho>` para devolver quem estava no
 * meio de um cadastro. Esse valor vem de fora, e redirecionar para ele sem
 * conferir transformaria a página num redirecionador aberto: bastaria mandar
 * para a vítima um link do painel que termina em outro site, com a confiança
 * do domínio certo na barra de endereço.
 *
 * Também é o destino do login, que recebe `?destino=` do middleware.
 *
 * A checagem é por lista de permissão, e não por recusa: qualquer coisa que
 * não seja o painel é rejeitada. Recusar caso a caso falha sempre, porque o
 * navegador normaliza formas que não parecem absolutas. `/\outro.site` é o
 * exemplo: a barra invertida vira barra e o endereço acaba virando
 * `//outro.site`, que sai do domínio.
 */
export function destinoSeguro(bruto: string | null | undefined): string | null {
  if (!bruto) return null
  return bruto === '/admin' || bruto.startsWith('/admin/') ? bruto : null
}
