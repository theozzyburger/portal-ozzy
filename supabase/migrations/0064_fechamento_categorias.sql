-- Fechamento por categoria (Heitor, 10/10): "a água sanitária tá do lado do bacon". A lista de contagem passa a
-- trazer a categoria do material (a da Eclética, ver 0063) para a tela agrupar. Mesma regra de acesso da lista_fechamento.
create function itens_fechamento(p_unidade text, p_setor text, p_data date)
returns table (item_id uuid, insumo_id uuid, nome text, categoria text, unidade_contagem text, ordem int, pre_preparo boolean,
  ideal numeric, contagem numeric, sugestao numeric, pedido numeric)
language sql stable security definer set search_path = public as $$
  select fi.id, fi.insumo_id, i.nome, i.categoria, fi.unidade_contagem, fi.ordem, i.pre_preparo,
    fi.ideal[extract(isodow from p_data + 1)::int], c.contagem, c.sugestao, c.pedido
  from fechamento_itens fi
  join insumos i on i.id = fi.insumo_id
  left join fechamentos f on f.unidade_id = fi.unidade_id and f.setor = fi.setor and f.data = p_data
  left join fechamento_contagens c on c.fechamento_id = f.id and c.item_id = fi.id
  where fi.unidade_id = p_unidade and fi.setor = p_setor and (fi.ativo or c.item_id is not null)
    and (sou_gestao() or sou_producao() or p_unidade = (eu()).unidade_id)
  order by i.categoria nulls last, fi.ordem, i.nome
$$;
grant execute on function itens_fechamento(text, text, date) to authenticated;
