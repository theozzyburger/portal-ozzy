-- Diária mandada de dentro da loja vale como presença (pedido de 08/10): o celular manda a localização junto
-- e o portal mede a distância até a loja. Quem manda depois, de casa, ainda consegue, mas a diária chega para
-- a gerente marcada como "fora da loja". A hora do envio na loja fica como registro de chegada.

-- Onde fica cada loja. A gestão marca pelo portal, estando na loja (Freelancers › Enviadas).
alter table unidades add column latitude double precision;
alter table unidades add column longitude double precision;
alter table unidades add column raio_m int not null default 150 check (raio_m between 30 and 2000);

alter table freela_envios add column latitude double precision;
alter table freela_envios add column longitude double precision;
alter table freela_envios add column precisao_m int;
alter table freela_envios add column distancia_loja_m int;
alter table freela_envios add column na_loja boolean not null default false;

-- Distância em metros entre dois pontos (fórmula de haversine).
create function distancia_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    sin(radians(lat2 - lat1) / 2) ^ 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lng2 - lng1) / 2) ^ 2))
$$;

create function definir_local_loja(p_unidade text, p_lat double precision, p_lng double precision) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not sou_gestao() then raise exception 'Só a gestão marca o local da loja.'; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'Localização inválida.'; end if;
  update unidades set latitude = p_lat, longitude = p_lng where id = p_unidade;
end $$;
grant execute on function definir_local_loja(text, double precision, double precision) to authenticated;

-- Os jeitos de mandar diária passam a receber a localização (p_local: {"lat", "lng", "precisao"}).
drop function freela_enviar_diarias(text, text, text, text, text, text, jsonb);
drop function freela_enviar_minhas_diarias(text, text, text, jsonb);
drop function freela_gravar_envios(text, text, text, text, uuid, uuid, text, text, jsonb);

-- Parte comum dos dois jeitos de mandar: confere os dias e grava um envio por dia/turno.
-- p_dias: [{"data": "AAAA-MM-DD", "turno": "noite", "observacao": "..."}].
create function freela_gravar_envios(
  p_cpf text, p_celular text, p_nome text, p_pix text, p_freelancer uuid, p_funcionario uuid,
  p_unidade text, p_funcao text, p_dias jsonb, p_local jsonb
) returns int
language plpgsql security definer set search_path = public as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  dia jsonb;
  d date;
  n int := 0;
  lat double precision := (p_local->>'lat')::double precision;
  lng double precision := (p_local->>'lng')::double precision;
  precisao int := case when (p_local->>'precisao')::numeric between 0 and 100000 then round((p_local->>'precisao')::numeric) end;
  loja unidades;
  distancia int;
begin
  -- Onde o celular estava na hora do envio, e a que distância da loja escolhida.
  select * into loja from unidades where id = p_unidade;
  if lat between -90 and 90 and lng between -180 and 180 and loja.latitude is not null then
    distancia := round(distancia_m(lat, lng, loja.latitude, loja.longitude));
  end if;
  if jsonb_typeof(p_dias) <> 'array' or jsonb_array_length(p_dias) = 0 then raise exception 'Escolha pelo menos um dia.'; end if;
  if jsonb_array_length(p_dias) > 14 then raise exception 'Mande no máximo 14 diárias de uma vez.'; end if;
  if not exists (select 1 from unidades where id = p_unidade) then raise exception 'Loja não encontrada.'; end if;
  if nullif(trim(p_funcao), '') is null then raise exception 'Diga a função que você fez.'; end if;
  if nullif(trim(p_pix), '') is null then raise exception 'Coloque a chave Pix.'; end if;
  -- Trava contra envio em massa: no máximo 30 esperando aprovação por pessoa.
  if (select count(*) from freela_envios e where e.status = 'pendente'
      and (e.cpf = p_cpf or e.funcionario_id = p_funcionario)) + jsonb_array_length(p_dias) > 30 then
    raise exception 'Você já tem muitas diárias esperando aprovação. Fale com a gerente.';
  end if;
  for dia in select * from jsonb_array_elements(p_dias) loop
    d := (dia->>'data')::date;
    if d > hoje or d < hoje - 13 then raise exception 'Só dá para mandar diárias dos últimos 14 dias.'; end if;
    if coalesce(dia->>'turno', '') not in ('manha', 'noite') then raise exception 'Turno inválido.'; end if;
    -- Vale como presença só o dia de hoje, mandado de dentro da loja (a precisão do GPS conta a favor, até 100 m).
    insert into freela_envios (cpf, celular, nome, pix, freelancer_id, funcionario_id, data, turno, unidade_id, funcao, observacao,
      latitude, longitude, precisao_m, distancia_loja_m, na_loja)
    values (p_cpf, p_celular, p_nome, trim(p_pix), p_freelancer, p_funcionario, d, dia->>'turno', p_unidade, trim(p_funcao),
      nullif(trim(dia->>'observacao'), ''), lat, lng, precisao, distancia,
      coalesce(d = hoje and distancia - least(coalesce(precisao, 0), 100) <= loja.raio_m, false))
    on conflict do nothing;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke execute on function freela_gravar_envios(text, text, text, text, uuid, uuid, text, text, jsonb, jsonb) from public, anon, authenticated;

-- Freelancer, pelo link da loja (sem login). Nome e Pix vazios = usa os do cadastro (só quando CPF e celular conferem).
create function freela_enviar_diarias(
  p_cpf text, p_celular text, p_nome text, p_pix text, p_unidade text, p_funcao text, p_dias jsonb, p_local jsonb default null
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_cpf text := regexp_replace(p_cpf, '\D', '', 'g');
  v_cel text := right(regexp_replace(p_celular, '\D', '', 'g'), 11);
  quem json := freela_quem_sou(p_cpf, p_celular);
  f freelancers;
  v_nome text := nullif(trim(p_nome), '');
  v_pix text := nullif(trim(p_pix), '');
begin
  if quem->>'tipo' = 'invalido' then raise exception 'CPF inválido. Confira os números.'; end if;
  if quem->>'tipo' = 'funcionario' then raise exception 'Esse CPF é de alguém do time. Mande a diária pelo Portal do Time, com o seu login.'; end if;
  if length(v_cel) < 10 then raise exception 'Celular inválido. Coloque com DDD.'; end if;
  -- Guarda o vínculo mesmo quando o celular não confere: a gestão vê o aviso ao aprovar.
  select * into f from freelancers where cpf = v_cpf;
  if quem->>'tipo' = 'freelancer' then
    v_nome := coalesce(v_nome, f.nome);
    v_pix := coalesce(v_pix, f.pix);
  end if;
  if v_nome is null or array_length(regexp_split_to_array(v_nome, '\s+'), 1) < 2 then raise exception 'Coloque o nome completo.'; end if;
  return freela_gravar_envios(v_cpf, v_cel, v_nome, v_pix, f.id, null, p_unidade, p_funcao, p_dias, p_local);
end $$;

-- Funcionário fazendo diária na folga, pelo próprio login.
create function freela_enviar_minhas_diarias(p_pix text, p_unidade text, p_funcao text, p_dias jsonb, p_local jsonb default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  u funcionarios := eu();
  fl uuid;
begin
  if u.id is null then raise exception 'Entre no portal para mandar a diária.'; end if;
  select id into fl from freelancers where funcionario_id = u.id;
  return freela_gravar_envios(u.cpf, case when right(u.celular, 11) ~ '^\d{10,11}$' then right(u.celular, 11) end, u.nome, coalesce(nullif(trim(p_pix), ''), u.pix), fl, u.id, p_unidade, p_funcao, p_dias, p_local);
end $$;

grant execute on function freela_enviar_diarias(text, text, text, text, text, text, jsonb, jsonb) to anon, authenticated;
grant execute on function freela_enviar_minhas_diarias(text, text, text, jsonb, jsonb) to authenticated;
