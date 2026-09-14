/**
 * Dados reais da imobiliária, num lugar só.
 *
 * Header, Footer, botões de WhatsApp e futuras meta tags leem daqui — trocar um
 * telefone é editar uma linha, não caçar string pelo projeto.
 * Fonte: rodapé de casaimobi.com.br + logomarca (CRECI).
 */

export const site = {
  name: 'CasaImobi',
  legalName: 'CasaImobi Negócios Imobiliários',
  tagline: 'Negócios Imobiliários',
  creci: '20.930-J',

  phones: [
    { label: '(81) 99967-6500', href: 'tel:+5581999676500' },
    { label: '(81) 98880-1979', href: 'tel:+5581988801979' },
  ],

  whatsapp: {
    number: '5581999676500',
    /** Monta o link já com a mensagem pronta. */
    link(message = 'Olá! Vim pelo site e gostaria de falar sobre um imóvel.') {
      return `https://wa.me/5581999676500?text=${encodeURIComponent(message)}`
    },
  },

  email: 'casaimobi.caruaru@gmail.com',

  address: {
    street: 'Rua Rádio Clube de Pernambuco, 88',
    reference: 'Próximo ao Colégio Diocesano',
    neighborhood: 'Maurício de Nassau',
    city: 'Caruaru',
    state: 'PE',
    zip: '55012-530',
    get full() {
      return `${this.street}, ${this.neighborhood}, ${this.city}/${this.state} — CEP ${this.zip}`
    },
  },

  social: {
    instagram: 'https://instagram.com/casaimobi_caruaru',
    facebook: 'https://facebook.com/casaimobi',
    youtube: 'https://youtube.com/@casaimobi.oficial1',
  },

  nav: [
    { label: 'Imóveis', href: '/imoveis' },
    { label: 'Sobre nós', href: '/sobre' },
    { label: 'Anuncie', href: '/anuncie' },
    { label: 'Contato', href: '/contato' },
  ],
} as const

/** Bairros que mais aparecem no acervo — usados nos filtros. */
export const NEIGHBORHOODS = [
  'Maurício de Nassau',
  'Centro',
  'Universitário',
  'Petrópolis',
  'Indianópolis',
  'Cidade Alta',
  'Boa Vista',
] as const
