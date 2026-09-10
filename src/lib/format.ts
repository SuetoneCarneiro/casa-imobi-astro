/**
 * Preço vem do banco em CENTAVOS. A divisão por 100 acontece aqui e só aqui.
 */
export function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}
