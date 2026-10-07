// Dados de cada loja para cabeçalho de documentos (enviados pelo Heitor em 07/10).
export interface Empresa {
  razaoSocial: string
  cnpj: string
  ie?: string
  endereco?: string
  cep?: string
}

export const EMPRESAS: Record<string, Empresa> = {
  'burger-psd': {
    razaoSocial: 'The Ozzy Burger Alimentação Ltda', cnpj: '34.533.354/0001-13', ie: '126.566.624.115',
    endereco: 'Rua Brigadeiro Henrique Fontenelle, 601', cep: '05125-000',
  },
  'burger-va': {
    razaoSocial: 'The Ozzy Burger Alimentação Ltda', cnpj: '34.533.354/0002-02', ie: '128.990.869.117',
    endereco: 'Rua Conselheiro Cândido de Oliveira, 133', cep: '05093-010',
  },
  pizza: { razaoSocial: 'The Ozzy Pizza', cnpj: '61.514.304/0001-24' },
}
