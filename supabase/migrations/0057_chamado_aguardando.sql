-- Chamado esperando alguém (Heitor, 09/10): a manutenção marca "aguardando fulano" com o motivo, e a pessoa
-- vê na página inicial o que depende dela. Quando ela resolve a parte dela (ou o chamado fecha), sai da lista.
alter table chamados add column aguardando_id uuid references funcionarios (id);
alter table chamados add column aguardando_desde timestamptz;
alter table chamados add column aguardando_motivo text;
create index on chamados (aguardando_id) where aguardando_id is not null;

-- Quem está sendo esperado também vê o chamado (mesmo de outra loja).
create or replace function vejo_chamado(c chamados) returns boolean
language sql stable security definer set search_path = public as $$
  select atendo_chamados() or c.aberto_por = (eu()).id or c.unidade_id = (eu()).unidade_id or c.aguardando_id = (eu()).id
$$;

-- Fechou (resolvido ou cancelado): ninguém mais está sendo esperado.
create function chamado_fechou_limpa_aguardando() returns trigger
language plpgsql as $$
begin
  if new.status in ('resolvido', 'cancelado') then
    new.aguardando_id := null;
    new.aguardando_desde := null;
    new.aguardando_motivo := null;
  end if;
  return new;
end $$;
create trigger chamado_fechou_limpa_aguardando before update of status on chamados
  for each row execute function chamado_fechou_limpa_aguardando();

-- Marcar quem está sendo esperado (manutenção e gestão) ou tirar (eles, ou a própria pessoa: "fiz a minha parte").
create function aguardar_chamado(p_chamado uuid, p_pessoa uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare
  c chamados;
  quem funcionarios := eu();
  v_nome text;
begin
  select * into c from chamados where id = p_chamado;
  if c.id is null or quem.id is null or not vejo_chamado(c) then raise exception 'Chamado não encontrado.'; end if;
  if c.status in ('resolvido', 'cancelado') then raise exception 'Este chamado já foi encerrado.'; end if;
  if p_pessoa is not null then
    if not atendo_chamados() then raise exception 'Só a manutenção e a gestão marcam quem estão esperando.'; end if;
    select nome into v_nome from funcionarios where id = p_pessoa and status = 'ativo';
    if v_nome is null then raise exception 'Pessoa não encontrada.'; end if;
    update chamados set aguardando_id = p_pessoa, aguardando_desde = now(), aguardando_motivo = nullif(trim(p_motivo), '') where id = p_chamado;
    insert into chamado_eventos (chamado_id, autor_id, texto)
      values (p_chamado, quem.id, 'Aguardando ' || v_nome || coalesce(': ' || nullif(trim(p_motivo), ''), ''));
  else
    if c.aguardando_id is null then return; end if;
    if not (atendo_chamados() or c.aguardando_id = quem.id) then raise exception 'Só a manutenção, a gestão ou quem está sendo esperado tiram a espera.'; end if;
    select nome into v_nome from funcionarios where id = c.aguardando_id;
    update chamados set aguardando_id = null, aguardando_desde = null, aguardando_motivo = null where id = p_chamado;
    insert into chamado_eventos (chamado_id, autor_id, texto)
      values (p_chamado, quem.id,
        case when c.aguardando_id = quem.id then 'Fiz a minha parte' else 'Não está mais aguardando ' || v_nome end
        || coalesce(': ' || nullif(trim(p_motivo), ''), ''));
  end if;
end $$;
grant execute on function aguardar_chamado(uuid, uuid, text) to authenticated;

-- Lista para escolher quem está sendo esperado: a manutenção não vê o cadastro da equipe, só nome e cargo de quem está ativo.
create function pessoas_ativas() returns table (id uuid, nome text, cargo text)
language sql stable security definer set search_path = public as $$
  select f.id, f.nome, f.cargo from funcionarios f where (eu()).id is not null and f.status = 'ativo' order by f.nome
$$;
grant execute on function pessoas_ativas() to authenticated;
