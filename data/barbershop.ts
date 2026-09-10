export const barbershop = {
  name: 'Gui Santos Barbearia',
  address: {
    street: 'Rua das Palmeiras, 245',
    district: 'Jardim América',
    city: 'São Paulo',
    state: 'SP',
    postalCode: '01432-000',
  },
  phone: {
    display: '(11) 4002-8899',
    href: 'tel:+551140028899',
  },
  email: {
    display: 'contato@guisantosbarbearia.com.br',
    href: 'mailto:contato@guisantosbarbearia.com.br',
  },
  openingHours: [
    { days: 'Segunda-feira', time: 'Fechado' },
    { days: 'Terça a sexta-feira', time: '9h às 20h' },
    { days: 'Sábado', time: '9h às 18h' },
    { days: 'Domingo', time: 'Fechado' },
  ],
  coordinates: [-23.5638, -46.6558] as const,
} as const
