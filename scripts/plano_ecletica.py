"""Plano de contas da Eclética dentro dos grupos da DRE (decisão do Heitor, 09/10).

Gera a migration 0046 e o plano do modo demonstração a partir da mesma lista.
Cada conta da Eclética reaproveita uma conta do Lucro Fácil (mesmo id, só renomeia) ou vira conta nova no grupo.
As contas do Lucro Fácil que sobram ficam inativas (somem da lista, mas o que já foi lançado nelas continua).
"""
import re, sys
from pathlib import Path

# (código Eclética, nome, código no portal, reaproveita conta LF?)
CONTAS = [
    ('02001001008', 'Mercado', '1.1', True),
    ('02001001005', 'Hortifruti', '1.2', True),
    ('02001001002', 'Proteínas e Ovos', '1.3', True),
    ('02001001012', 'Laticínios', '1.4', True),
    ('02001001004', 'Bebidas', '1.5', True),
    ('02001001006', 'Embalagens', '1.8', True),
    ('02001001007', 'Temperos', '1.9', False),
    ('02001001009', 'Pão', '1.10', False),
    ('02001001010', 'Doces e Confeitaria', '1.11', False),
    ('02001001011', 'Picles', '1.12', False),
    ('02001001022', 'Farinhas, Fermentos e Massas', '1.13', False),
    ('02001001024', 'Grãos, Cereais e Derivados', '1.14', False),
    ('02001001025', 'Molhos e Condimentos', '1.15', False),
    ('02001001018', 'Batata-frita', '1.16', False),
    ('02001001001', 'Compras Emergenciais', '1.17', False),
    ('02001001020', 'Compras Não Registradas', '1.18', False),
    ('02001003001', 'Salários Geral', '2.1', True),
    ('02001003006', 'INSS', '2.2', True),
    ('02001003002', 'Pró-labore', '2.3', True),
    ('02001003021', 'Freelancers Cozinha', '2.4', True),
    ('02001003004', 'Refeição / Cesta', '2.5', True),
    ('02001003016', 'Salários Cozinha', '2.6', False),
    ('02001003017', 'Salários Atendimento', '2.7', False),
    ('02001003018', 'Salários Produção', '2.8', False),
    ('02001003019', 'Salários Adm', '2.9', False),
    ('02001003020', 'Freelancers Atendimento', '2.10', False),
    ('02001003022', 'Freelancers Produção', '2.11', False),
    ('02001003023', 'Freelancers Evento', '2.12', False),
    ('02001003007', 'FGTS', '2.13', False),
    ('02001003003', 'Rescisão', '2.14', False),
    ('02001003013', 'Ações Trabalhistas', '2.15', False),
    ('02001003014', 'Custo Admissional', '2.16', False),
    ('02001003005', 'Vale-transporte', '2.17', False),
    ('02001002004', 'Convênio Médico', '2.18', False),
    ('02001002001', 'Bonificações', '2.19', False),
    ('02001003009', 'Uniformes', '2.20', False),
    ('02001005002', 'Motoboys', '3.1', False),
    ('02001004001', 'Aluguel', '4.1', True),
    ('02001004005', 'Água e Esgoto', '4.2', True),
    ('02001004004', 'Energia Elétrica', '4.3', True),
    ('02001001014', 'Gás', '4.4', True),
    ('02001004006', 'Telefone e Internet', '4.5', True),
    ('02001004003', 'Manutenção e Conservação', '4.9', True),
    ('02001004002', 'Reformas', '4.15', False),
    ('02001004009', 'Melhorias', '4.16', False),
    ('02001004008', 'Transportes', '5.3', True),
    ('02001006004', 'Consultoria', '5.4', True),
    ('02001006002', 'Contador', '5.5', True),
    ('02001003010', 'Estorno Clientes', '5.9', True),
    ('02001004015', 'Jurídico', '5.15', True),
    ('02001006006', 'Material Gráfico, Divulgação e Marketing', '5.16', True),
    ('02001006005', 'Sistema', '5.19', True),
    ('02001004011', 'Segurança', '5.20', True),
    ('02001004007', 'Impostos', '5.21', True),
    ('02001007001', 'Taxas Bancárias', '5.22', True),
    ('02001006010', 'Nutricionista', '5.24', False),
    ('02001007015', 'Taxas Amex', '5.25', False),
    ('02001001016', 'Associações e Entidades de Classe', '5.26', False),
    ('02001001019', 'Adesivos', '5.27', False),
    ('02001001013', 'Produtos de Limpeza', '6.1', True),
    ('02001006001', 'Material de Escritório', '6.2', True),
    ('02001001028', 'Utensílios e Descartáveis', '6.3', True),
    ('02001004014', 'Compra de Equipamentos e Utensílios', '6.4', False),
    ('02001007002', 'Dívidas e Empréstimos', '9.1', True),
]
# Contas do Lucro Fácil que continuam (grupos sem filhas e o que fica abaixo do resultado).
FICAM = {'1', '2', '3', '4', '5', '6', '7', '8', '9', '9.2', '9.3', '9.4', '10', '10.1', '10.2', '10.3', '10.4', '10.5', '11', '11.1', '11.2', '11.3'}

def ordem(cod):
    p = [int(x) for x in cod.split('.')]
    return p[0] * 100 + (p[1] if len(p) > 1 else 0)

def q(s):
    return "'" + s.replace("'", "''") + "'"

def sql():
    novos = [c for c in CONTAS if not c[3]]
    reuso = [c for c in CONTAS if c[3]]
    linhas = [
        '-- Plano de contas da Eclética dentro dos grupos da DRE (Heitor, 09/10). Gerado por scripts/plano_ecletica.py.',
        '-- Contas do Lucro Fácil com equivalente na Eclética são renomeadas (mesmo id: o que já foi lançado continua certo);',
        '-- as que não têm equivalente ficam inativas; as que faltavam entram como novas no grupo certo.',
        '',
        'alter table plano_contas add column ecletica_codigo text unique;',
        '',
        'update plano_contas p set nome = v.nome, ecletica_codigo = v.ecl, ativo = true from (values',
        ',\n'.join(f'  ({q(c[2])}, {q(c[1])}, {q(c[0])})' for c in reuso),
        ') as v (codigo, nome, ecl) where p.codigo = v.codigo;',
        '',
        'insert into plano_contas (codigo, nome, pai_codigo, operacional, ordem, ecletica_codigo) values',
        ',\n'.join(f"  ({q(c[2])}, {q(c[1])}, {q(c[2].split('.')[0])}, {'false' if c[2].split('.')[0] in ('9','10','11') else 'true'}, {ordem(c[2])}, {q(c[0])})" for c in novos) + ';',
        '',
        'update plano_contas set ordem = (split_part(codigo, \'.\', 1)::int * 100 + coalesce(nullif(split_part(codigo, \'.\', 2), \'\')::int, 0));',
        'update plano_contas set ativo = false where ecletica_codigo is null and codigo not in (' + ', '.join(q(c) for c in sorted(FICAM)) + ');',
        '',
    ]
    return '\n'.join(linhas)

def demo():
    lf = {}
    src = Path('src/lib/demoStore.ts').read_text()
    bloco = re.search(r"const PLANO: \[.*?\]\[\] = \[\n(.*?)\n\]", src, re.S).group(1)
    for m in re.finditer(r"\['([\d.]+)', '([^']*)', (null|'[\d]+'), (true|false), \d+(?:, (?:true|false))?\]", bloco):
        lf[m.group(1)] = [m.group(1), m.group(2), None if m.group(3) == 'null' else m.group(3).strip("'"), m.group(4) == 'true', ordem(m.group(1)), False]
    for cod, linha in lf.items():
        if cod in FICAM: linha[5] = True
    for ecl, nome, cod, re_ in CONTAS:
        pai = cod.split('.')[0]
        lf[cod] = [cod, nome, pai, pai not in ('9', '10', '11'), ordem(cod), True]
    def ts(v):
        return 'null' if v[2] is None else f"'{v[2]}'"
    corpo = '\n'.join(f"  ['{v[0]}', '{v[1]}', {ts(v)}, {str(v[3]).lower()}, {v[4]}, {str(v[5]).lower()}]," for v in sorted(lf.values(), key=lambda v: v[4]))
    novo = re.sub(r"const PLANO: \[.*?\]\[\] = \[\n.*?\n\]", lambda _: "const PLANO: [string, string, string | null, boolean, number, boolean][] = [\n" + corpo + "\n]", src, count=1, flags=re.S)
    novo = novo.replace("PLANO.map(([codigo, nome, paiCodigo, operacional, ordem]) => ({ id: 'pc' + codigo, codigo, nome, paiCodigo, operacional, ordem, ativo: true }))",
                        "PLANO.map(([codigo, nome, paiCodigo, operacional, ordem, ativo]) => ({ id: 'pc' + codigo, codigo, nome, paiCodigo, operacional, ordem, ativo }))")
    Path('src/lib/demoStore.ts').write_text(novo)

if __name__ == '__main__':
    Path('supabase/migrations/0046_plano_ecletica.sql').write_text(sql())
    demo()
