-- Parte fixa da 0070 (o script põe antes as tabelas _f e _fi).
alter table _f add column receita_id uuid;
alter table _f add column insumo_id uuid;

-- Pré-preparo: o item de estoque com o mesmo código.
update _f set insumo_id = i.id from insumos i where _f.tipo = 'preparo' and i.ecletica_codigo = _f.codigo;

-- Ficha que já existe: pelo código, pelo item de estoque ligado ou, no pré-preparo dos eventos, pelo nome.
update _f set receita_id = r.id from receitas r where r.ecletica_codigo = _f.codigo;
update _f set receita_id = r.id from receitas r
  where _f.receita_id is null and _f.tipo = 'preparo' and r.tipo = 'preparo' and r.ecletica_codigo is null and r.insumo_id = _f.insumo_id;
update _f set receita_id = r.id from receitas r
  where _f.receita_id is null and _f.tipo = 'preparo' and r.tipo = 'preparo' and r.ecletica_codigo is null
    and (pg_temp.norm(r.nome) = pg_temp.norm(_f.nome) or pg_temp.norm(r.nome) = _f.nome_evento);

update receitas r set
  ecletica_codigo = _f.codigo,
  insumo_id = coalesce(_f.insumo_id, r.insumo_id),
  unidade = coalesce((select unidade from insumos where id = _f.insumo_id), r.unidade),
  modo_preparo = coalesce(r.modo_preparo, _f.modo),
  conservacao = coalesce(r.conservacao, _f.conservacao),
  validade_dias = coalesce(r.validade_dias, _f.validade),
  observacoes = coalesce(r.observacoes, _f.observacoes),
  responsavel = coalesce(r.responsavel, _f.responsavel),
  porcao_nome = coalesce(r.porcao_nome, _f.porcao_nome),
  porcao_qtd = coalesce(r.porcao_qtd, _f.porcao_qtd),
  atualizado_em = now()
from _f where r.id = _f.receita_id;

-- Fichas novas. Pré-preparo com o nome do item de estoque; produto com o do PDV e o preço da tabela padrão.
with novas as (
  insert into receitas (nome, tipo, area, ecletica_codigo, insumo_id, unidade, linha, preco_venda, modo_preparo, conservacao,
    validade_dias, observacoes, responsavel, porcao_nome, porcao_qtd, ativo)
  select coalesce(i.nome, p.nome, _f.nome), _f.tipo, 'lojas', _f.codigo, _f.insumo_id,
    case when _f.tipo = 'produto' then 'un' else coalesce(i.unidade, 'kg') end,
    case when _f.tipo = 'produto' then coalesce(p.subgrupo, p.grupo) end, p.preco, _f.modo, _f.conservacao, _f.validade,
    _f.observacoes, _f.responsavel, _f.porcao_nome, _f.porcao_qtd, _f.ativo and coalesce(p.ativo, i.ativo, true)
  from _f
  left join insumos i on i.id = _f.insumo_id
  left join produtos_venda p on p.ecletica_codigo = _f.codigo
  where _f.receita_id is null
  returning id, ecletica_codigo
)
update _f set receita_id = novas.id from novas where novas.ecletica_codigo = _f.codigo;

-- Uma versão nova em cada ficha, com rendimento 1.
create temp table _v on commit drop as
select _f.codigo, gen_random_uuid() as versao_id, r.versao_atual + 1 as numero, r.id as receita_id
from _f join receitas r on r.id = _f.receita_id;

insert into receita_versoes (id, receita_id, numero, rendimento, nota)
select versao_id, receita_id, numero, 1, 'Fórmula da Eclética (importada em 10/10/2026)' from _v;

insert into receita_itens (versao_id, ordem, insumo_id, sub_receita_id, quantidade, aproveitamento, so_delivery)
select _v.versao_id, _fi.ordem,
  case when sub.receita_id is null then i.id end,
  sub.receita_id,
  _fi.quantidade, least(1, greatest(0.01, _fi.aproveitamento)), _fi.so_delivery
from _fi
join _v on _v.codigo = _fi.ficha
left join _f sub on _fi.tem_ficha and sub.codigo = _fi.item and sub.receita_id <> _v.receita_id
left join insumos i on i.ecletica_codigo = _fi.item
where sub.receita_id is not null or i.id is not null;

update receitas r set versao_atual = _v.numero, atualizado_em = now() from _v where r.id = _v.receita_id;

-- Produto de venda ligado à ficha da Eclética (substitui a ligação pelo nome feita na 0063).
update produtos_venda p set receita_id = _f.receita_id, atualizado_em = now()
from _f where _f.tipo = 'produto' and p.ecletica_codigo = _f.codigo;

-- Itens que ficaram de fora (código sem material e sem ficha), para conferir.
do $$
declare n int;
begin
  select count(*) into n from _fi
  where not exists (select 1 from insumos i where i.ecletica_codigo = _fi.item)
    and not exists (select 1 from _f where _fi.tem_ficha and _f.codigo = _fi.item);
  raise notice 'Itens sem cadastro (ficaram de fora): %', n;
end $$;
