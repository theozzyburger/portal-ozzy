"""Gera a migration 0063 com os cadastros da Eclética (Heitor, 09/10).

Uso: python3 -I scripts/importar_cadastros.py <pasta> <fornecedores.csv> > supabase/migrations/0063_dados_cadastros.sql
  <pasta>: materiais.xlsx, "man. mat.xlsx", produtos.xlsx, "tabela de preço.xlsx" e "historico de compras.xlsx"
  <fornecedores.csv>: a lista limpa (financeiro/importar/1-fornecedores.csv), para achar o nome certo do fornecedor.

- Materiais viram insumos pelo código da Eclética. Quem já tem o código só ganha o que falta (preço, categoria,
  embalagem, conta, setor de envio); quem tem o mesmo nome sem código é ligado; o resto entra no cadastro.
- Produtos de venda com o preço da tabela padrão (Burger) e da The Ozzy Pizza.
- Histórico de compras: o fornecedor é achado pelo CNPJ (só CNPJ: CPF não vai para o repositório), nome ou razão
  social; o que não existir entra no cadastro de fornecedores.
"""
import csv, glob, os, re, sys, unicodedata
import openpyxl

UNID = {'Kilos': 'kg', 'Litros': 'l'}
EMBALAGEM = {'Caixas': 'Caixa', 'Fardos': 'Fardo', 'Pacotes': 'Pacote', 'Galões': 'Galão'}
SETOR = {'COZINHA': 'cozinha', 'ATENDIMENTO': 'atendimento', 'EVENTOS': 'eventos'}
TIPO = {'NORMAL': 'normal', 'ESCONDIDO': 'escondido', 'VINCULO': 'vinculo'}
INATIVO = re.compile(r'teste|n[ãa]o, obrigado|n[ãa]o lan[çc]ar|n[ãa]o comercializada|caixinha funcion', re.I)
CATEGORIA = {'Horti-fruti': 'Hortifruti'}
SEM_FORNECEDOR = {'NÃO IDENTIFICADO', 'LOJA CENTRAL THE OZZY'}


def nome_bom(s):
    s = ' '.join(str(s).split())
    palavras = [w for w in s.split() if w.isalpha() and len(w) >= 3]
    if palavras and all(w.isupper() for w in palavras):
        s = s[0].upper() + s[1:].lower()
    return s


def simples(s):
    s = unicodedata.normalize('NFD', str(s).lower()).encode('ascii', 'ignore').decode()
    return ' '.join(re.sub(r'[^a-z0-9 ]', ' ', s).split())


def sql(v):
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, int):
        return str(v)
    if isinstance(v, float):
        return repr(round(v, 5)).rstrip('0').rstrip('.') if '.' in repr(round(v, 5)) else repr(round(v, 5))
    return "'" + str(v).replace("'", "''") + "'"


def linhas(pasta, nome):
    p = glob.glob(os.path.join(pasta, nome))[0]
    return list(openpyxl.load_workbook(p, read_only=True, data_only=True).active.iter_rows(values_only=True))


def valores(nome, cols, rows):
    print(f'create temp table {nome} ({cols});')
    for i in range(0, len(rows), 500):
        print(f'insert into {nome} values')
        print(',\n'.join('  (' + ', '.join(sql(v) for v in r) + ')' for r in rows[i:i + 500]) + ';')


def main(pasta, csv_forn):
    # Materiais (+ estoque mínimo da manutenção de materiais).
    minimo = {str(r[0]): r[5] for r in linhas(pasta, 'man*mat*.xlsx') if isinstance(r[0], int) and r[5]}
    mats, vistos = [], set()
    for r in linhas(pasta, 'materiais.xlsx'):
        if not isinstance(r[0], int):
            continue
        cod = str(r[0])
        nome = nome_bom(r[1])
        if simples(nome) in vistos:
            nome = f'{nome} ({cod})'
        vistos.add(simples(nome))
        emb = EMBALAGEM.get(r[5])
        qtd = r[4] if isinstance(r[4], (int, float)) and r[4] > 0 and (r[4] != 1 or emb) else None
        if qtd and not emb:
            emb = 'Embalagem'
        cat = None if r[8] in (None, 'SEM DESCRICAO') else CATEGORIA.get(r[8], r[8])
        conta = None if r[9] in (None, '00000000000') else r[9]
        mats.append((cod, nome, UNID.get(r[3], 'un'), SETOR.get(r[2]), cat, conta, emb, qtd,
                     r[7] if isinstance(r[7], (int, float)) and r[7] > 0 else None, minimo.get(cod),
                     not INATIVO.search(nome), cat == 'Pré Preparos'))
    codigos = {m[0] for m in mats}

    # Histórico de compras.
    hist, cod, desc = [], None, None
    for r in linhas(pasta, 'historico*.xlsx'):
        if r[0] == 'Código :':
            cod, desc = str(r[1]), r[3]
        elif cod and isinstance(r[0], str) and isinstance(r[1], (int, float)) and r[5] is not None:
            hist.append((r[5].isoformat(sep=' '), cod, nome_bom(desc), r[0].strip(), r[1], UNID.get(r[2], 'un'), r[3], r[4]))
    # Itens comprados que não estão no cadastro de materiais (bebidas com código de produto).
    for h in hist:
        if h[1] not in codigos:
            codigos.add(h[1])
            mats.append((h[1], h[2], h[5], None, 'Bebidas', None, None, None, None, None, True, False))

    # Fornecedores: nome limpo e CNPJ pela lista do Heitor.
    lista = list(csv.reader(open(csv_forn, encoding='utf-8-sig'), delimiter=';'))[1:]
    por_nome = {simples(r[0]): r for r in lista}
    for r in lista:
        m = re.search(r'Raz[aã]o social: (.*)', r[4])
        if m:
            por_nome.setdefault(simples(m.group(1)), r)
    forn = []
    for f in sorted({h[3] for h in hist} - SEM_FORNECEDOR):
        if f.startswith('Total Geral'):
            continue
        r = por_nome.get(simples(f))
        cnpj = r[1] if r and len(r[1]) == 14 else None
        forn.append((f, r[0] if r else ' '.join(f.split()), cnpj))

    # Produtos e tabelas de preço.
    precos, tabela = {}, None
    for r in linhas(pasta, 'tabela*.xlsx'):
        if r[0] == 'Tabela:':
            tabela = 'pizza' if 'PIZZA' in str(r[2]).upper() else 'padrao'
        elif isinstance(r[0], int) and isinstance(r[2], (int, float)):
            precos.setdefault(str(r[0]), {})[tabela] = r[2]
    prods = []
    for r in linhas(pasta, 'produtos.xlsx'):
        if isinstance(r[0], int):
            p = precos.get(str(r[0]), {})
            prods.append((str(r[0]), ' '.join(str(r[1]).split()), r[2], r[3], TIPO.get(r[5], 'normal'), UNID.get(r[4], 'un'),
                          p.get('padrao'), p.get('pizza'), not INATIVO.search(str(r[1]))))

    print('-- Gerado por scripts/importar_cadastros.py com as planilhas da Eclética de 09/10 (pasta cadastros/).')
    print(f'-- {len(mats)} materiais, {len(prods)} produtos de venda, {len(hist)} compras de {len(forn)} fornecedores (jan a out/2026).')
    valores('_mat', 'codigo text, nome text, unidade text, setor text, categoria text, conta text, embalagem text, embalagem_qtd numeric, '
            'preco numeric, minimo numeric, ativo boolean, pre_preparo boolean', mats)
    print('''
-- Liga pelo nome quem ainda não tem código; os outros entram no cadastro.
update insumos i set ecletica_codigo = m.codigo
from _mat m
where i.ecletica_codigo is null and lower(i.nome) = lower(m.nome)
  and not exists (select 1 from insumos x where x.ecletica_codigo = m.codigo);
insert into insumos (nome, categoria, unidade, ecletica_codigo, ativo, observacao)
select case when exists (select 1 from insumos x where lower(x.nome) = lower(m.nome)) then m.nome || ' (' || m.codigo || ')' else m.nome end,
  m.categoria, m.unidade, m.codigo, m.ativo, 'Cadastro de materiais da Eclética.'
from _mat m
where not exists (select 1 from insumos x where x.ecletica_codigo = m.codigo);
-- A categoria passa a ser a da Eclética (uma só para lojas, produção e eventos); o resto só completa o que falta.
update insumos i set
  categoria = coalesce(m.categoria, i.categoria),
  setor_envio = coalesce(i.setor_envio, m.setor),
  conta_id = coalesce(i.conta_id, (select p.id from plano_contas p where p.ecletica_codigo = m.conta)),
  embalagem = coalesce(i.embalagem, m.embalagem),
  embalagem_qtd = case when i.embalagem is null then m.embalagem_qtd else i.embalagem_qtd end,
  preco = coalesce(i.preco, m.preco),
  estoque_minimo = coalesce(i.estoque_minimo, m.minimo),
  pre_preparo = i.pre_preparo or m.pre_preparo
from _mat m
where i.ecletica_codigo = m.codigo;
''')
    valores('_forn', 'nome_eclt text, nome text, cnpj text', forn)
    print('''
-- Fornecedor pelo CNPJ, nome ou razão social; quem não existe entra no cadastro.
alter table _forn add column id uuid;
update _forn f set id = (select x.id from fornecedores x where x.cnpj = f.cnpj or lower(x.nome) = lower(f.nome)
  or lower(x.nome) = lower(f.nome_eclt) or lower(x.razao_social) = lower(f.nome_eclt)
  order by (x.cnpj = f.cnpj) desc nulls last limit 1);
insert into fornecedores (nome, razao_social, cnpj, observacao)
select distinct on (lower(f.nome)) f.nome, nullif(f.nome_eclt, f.nome), f.cnpj, 'Do histórico de compras da Eclética.'
from _forn f
where f.id is null and not exists (select 1 from fornecedores x where x.cnpj = f.cnpj)
order by lower(f.nome);
update _forn f set id = (select x.id from fornecedores x where x.cnpj = f.cnpj or lower(x.nome) = lower(f.nome) order by (x.cnpj = f.cnpj) desc nulls last limit 1)
where f.id is null;
''')
    valores('_hist', 'data timestamptz, codigo text, descricao text, fornecedor text, quantidade numeric, unidade text, preco numeric, total numeric', hist)
    print('''
insert into compras_historico (data, insumo_id, ecletica_codigo, descricao, fornecedor_id, fornecedor_nome, quantidade, unidade, preco, total)
select h.data, i.id, h.codigo, h.descricao, f.id, h.fornecedor, h.quantidade, h.unidade, h.preco, h.total
from _hist h
left join insumos i on i.ecletica_codigo = h.codigo
left join _forn f on f.nome_eclt = h.fornecedor
where not exists (select 1 from compras_historico x where x.origem = 'ecletica' and x.data = h.data and x.ecletica_codigo = h.codigo);
''')
    valores('_prod', 'codigo text, nome text, grupo text, subgrupo text, tipo text, unidade text, preco numeric, preco_pizza numeric, ativo boolean', prods)
    print('''
insert into produtos_venda (ecletica_codigo, nome, grupo, subgrupo, tipo, unidade, preco, preco_pizza, ativo, receita_id)
select p.codigo, p.nome, p.grupo, p.subgrupo, p.tipo, p.unidade, p.preco, p.preco_pizza, p.ativo,
  (select r.id from receitas r where r.tipo = 'produto' and lower(r.nome) = lower(p.nome) limit 1)
from _prod p
on conflict (ecletica_codigo) do update set preco = excluded.preco, preco_pizza = excluded.preco_pizza;''')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
