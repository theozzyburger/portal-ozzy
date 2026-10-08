-- Freelancers de eventos (pedido de 08/10): base separada da dos freelas das lojas, dentro de Eventos.
-- Mesmo formato das lojas: um link (e cartaz com QR Code) sem login, a pessoa entra com CPF e celular, escolhe o
-- evento e marca os dias. A diária chega pendente e a gestão aprova com o valor, que pode ser diferente do das
-- lojas: cada evento tem o seu valor de diária e cada freela pode ter um valor próprio (que vale mais).
-- Só acrescenta colunas, tabelas e funções: nada do que já existe muda.

alter table eventos
  add column diaria_freela numeric(10, 2) check (diaria_freela >= 0),
  -- Onde o evento acontece, para a diária mandada de lá valer como presença (a gestão marca estando no local).
  add column latitude double precision,
  add column longitude double precision;

create table freelas_evento (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  cpf text not null unique check (cpf ~ '^\d{11}$'),
  pix text not null check (length(trim(pix)) > 0),
  celular text check (celular ~ '^\d{10,11}$'),
  funcao text, -- o que costuma fazer (sugestão ao aprovar)
  valor_diaria numeric(10, 2) check (valor_diaria >= 0), -- vazio = usa o valor do evento
  observacao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  criado_por uuid default (eu()).id references funcionarios (id)
);

-- Um dia trabalhado num evento. Do link chega 'pendente' (com o que a pessoa mandou); a gestão aprova com o valor.
create table evento_freela_diarias (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos (id) on delete cascade,
  freela_id uuid references freelas_evento (id), -- vazio enquanto é a primeira vez e ninguém aprovou
  cpf text not null check (cpf ~ '^\d{11}$'), -- identifica a pessoa (também nas lançadas pela gestão)
  data date not null,
  funcao text not null check (length(trim(funcao)) > 0),
  valor numeric(10, 2) check (valor >= 0),
  observacao text,
  -- O que veio pelo link (fica guardado mesmo depois de aprovar).
  celular text,
  nome text,
  pix text,
  origem text not null default 'gestao' check (origem in ('link', 'gestao')),
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  motivo text,
  latitude double precision,
  longitude double precision,
  precisao_m int,
  distancia_m int,
  no_local boolean not null default false,
  enviado_em timestamptz not null default now(),
  enviado_por uuid default (eu()).id references funcionarios (id),
  resolvido_por uuid references funcionarios (id),
  resolvido_em timestamptz,
  pago_em timestamptz,
  pago_por uuid references funcionarios (id),
  check (status <> 'aprovado' or (freela_id is not null and valor is not null))
);
-- Um dia por pessoa por evento (um recusado pode ser mandado de novo).
create unique index on evento_freela_diarias (evento_id, cpf, data) where status <> 'recusado';
create index on evento_freela_diarias (status, evento_id);

alter table freelas_evento enable row level security;
alter table evento_freela_diarias enable row level security;
create policy "gestao edita freelas de evento" on freelas_evento for all using (sou_gestao()) with check (sou_gestao());
create policy "gestao edita diarias de evento" on evento_freela_diarias for all using (sou_gestao()) with check (sou_gestao());

-- Eventos que aparecem no link: os que tiveram dia nas últimas duas semanas (até hoje). Só nome e dias.
create function freela_eventos_abertos() returns table (id uuid, nome text, dias date[])
language sql stable security definer set search_path = public as $$
  select e.id, e.nome, array_agg(d.data order by d.data)
  from eventos e join evento_dias d on d.evento_id = e.id
  where e.status <> 'cancelado'
    and d.data between (now() at time zone 'America/Sao_Paulo')::date - 13 and (now() at time zone 'America/Sao_Paulo')::date
  group by e.id, e.nome
  order by min(d.data) desc
$$;

-- Com CPF e celular, diz se a pessoa já está na base de eventos (só o primeiro nome e o fim do Pix, para conferir).
create function freela_evento_quem_sou(p_cpf text, p_celular text) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  v_cpf text := regexp_replace(p_cpf, '\D', '', 'g');
  v_cel text := right(regexp_replace(p_celular, '\D', '', 'g'), 11);
  f freelas_evento;
begin
  if not cpf_valido(v_cpf) then return json_build_object('tipo', 'invalido'); end if;
  select * into f from freelas_evento where cpf = v_cpf;
  if f.id is null or (f.celular is not null and right(f.celular, 11) <> v_cel) then
    return json_build_object('tipo', 'novo');
  end if;
  return json_build_object('tipo', 'freelancer', 'nome', split_part(f.nome, ' ', 1), 'pixFinal', right(f.pix, 4));
end $$;

-- Envio pelo link (sem login). p_dias: [{"data": "AAAA-MM-DD", "observacao": "..."}]; p_local: {"lat", "lng", "precisao"}.
-- Nome e Pix vazios = usa os do cadastro (só quando CPF e celular conferem).
create function freela_evento_enviar(
  p_cpf text, p_celular text, p_nome text, p_pix text, p_evento uuid, p_funcao text, p_dias jsonb, p_local jsonb default null
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_cpf text := regexp_replace(p_cpf, '\D', '', 'g');
  v_cel text := right(regexp_replace(p_celular, '\D', '', 'g'), 11);
  quem json := freela_evento_quem_sou(p_cpf, p_celular);
  f freelas_evento;
  ev eventos;
  v_nome text := nullif(trim(p_nome), '');
  v_pix text := nullif(trim(p_pix), '');
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  lat double precision := (p_local->>'lat')::double precision;
  lng double precision := (p_local->>'lng')::double precision;
  precisao int := case when (p_local->>'precisao')::numeric between 0 and 100000 then round((p_local->>'precisao')::numeric) end;
  distancia int;
  dia jsonb;
  d date;
  n int := 0;
begin
  if quem->>'tipo' = 'invalido' then raise exception 'CPF inválido. Confira os números.'; end if;
  if length(v_cel) < 10 then raise exception 'Celular inválido. Coloque com DDD.'; end if;
  select * into ev from eventos where id = p_evento and status <> 'cancelado';
  if ev.id is null then raise exception 'Evento não encontrado.'; end if;
  select * into f from freelas_evento where cpf = v_cpf;
  if quem->>'tipo' = 'freelancer' then
    v_nome := coalesce(v_nome, f.nome);
    v_pix := coalesce(v_pix, f.pix);
  end if;
  if v_nome is null or array_length(regexp_split_to_array(v_nome, '\s+'), 1) < 2 then raise exception 'Coloque o nome completo.'; end if;
  if v_pix is null then raise exception 'Coloque a chave Pix.'; end if;
  if nullif(trim(p_funcao), '') is null then raise exception 'Diga a função que você fez.'; end if;
  if jsonb_typeof(p_dias) <> 'array' or jsonb_array_length(p_dias) = 0 then raise exception 'Escolha pelo menos um dia.'; end if;
  if jsonb_array_length(p_dias) > 14 then raise exception 'Mande no máximo 14 diárias de uma vez.'; end if;
  if (select count(*) from evento_freela_diarias x where x.status = 'pendente' and x.cpf = v_cpf) + jsonb_array_length(p_dias) > 30 then
    raise exception 'Você já tem muitas diárias esperando aprovação. Fale com a gerente.';
  end if;
  if lat between -90 and 90 and lng between -180 and 180 and ev.latitude is not null then
    distancia := round(distancia_m(lat, lng, ev.latitude, ev.longitude));
  end if;
  for dia in select * from jsonb_array_elements(p_dias) loop
    d := (dia->>'data')::date;
    if d > hoje or d < hoje - 13 then raise exception 'Só dá para mandar diárias dos últimos 14 dias.'; end if;
    if not exists (select 1 from evento_dias where evento_id = ev.id and data = d) then raise exception 'O evento não teve o dia %.', to_char(d, 'DD/MM'); end if;
    -- Vale como presença: mandada no dia, a até 300 m do local marcado (evento é grande; a precisão do GPS conta até 100 m).
    insert into evento_freela_diarias (evento_id, freela_id, data, funcao, observacao, cpf, celular, nome, pix, origem,
      latitude, longitude, precisao_m, distancia_m, no_local)
    values (ev.id, f.id, d, trim(p_funcao), nullif(trim(dia->>'observacao'), ''), v_cpf, v_cel, v_nome, v_pix, 'link',
      lat, lng, precisao, distancia, coalesce(d = hoje and distancia - least(coalesce(precisao, 0), 100) <= 300, false))
    on conflict do nothing;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- A gestão aprova: cria o cadastro na base de eventos se for a primeira vez e põe o valor.
create function freela_evento_aprovar(p_diaria uuid, p_valor numeric, p_funcao text, p_usar_pix boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  x evento_freela_diarias;
  fl uuid;
begin
  if not sou_gestao() then raise exception 'Só a gestão aprova diárias.'; end if;
  if p_valor is null or p_valor < 0 then raise exception 'Valor inválido.'; end if;
  select * into x from evento_freela_diarias where id = p_diaria and status = 'pendente' for update;
  if x.id is null then raise exception 'Essa diária já foi resolvida.'; end if;
  fl := x.freela_id;
  if fl is null then select id into fl from freelas_evento where cpf = x.cpf; end if;
  if fl is null then
    insert into freelas_evento (nome, cpf, pix, celular, funcao) values (x.nome, x.cpf, x.pix, x.celular, x.funcao) returning id into fl;
  elsif p_usar_pix then
    update freelas_evento set pix = x.pix, celular = coalesce(x.celular, celular), ativo = true where id = fl;
  else
    update freelas_evento set ativo = true where id = fl;
  end if;
  update evento_freela_diarias set status = 'aprovado', freela_id = fl, valor = p_valor,
    funcao = coalesce(nullif(trim(p_funcao), ''), funcao), resolvido_por = (eu()).id, resolvido_em = now()
  where id = x.id;
end $$;

-- Marca onde o evento acontece (a gestão, estando lá).
create function definir_local_evento(p_evento uuid, p_lat double precision, p_lng double precision) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not sou_gestao() then raise exception 'Só a gestão marca o local do evento.'; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'Localização inválida.'; end if;
  update eventos set latitude = p_lat, longitude = p_lng where id = p_evento;
end $$;

grant execute on function freela_eventos_abertos() to anon, authenticated;
grant execute on function freela_evento_quem_sou(text, text) to anon, authenticated;
grant execute on function freela_evento_enviar(text, text, text, text, uuid, text, jsonb, jsonb) to anon, authenticated;
grant execute on function freela_evento_aprovar(uuid, numeric, text, boolean) to authenticated;
grant execute on function definir_local_evento(uuid, double precision, double precision) to authenticated;
