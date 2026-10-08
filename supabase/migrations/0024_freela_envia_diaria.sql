-- O próprio freelancer manda as diárias que trabalhou (pedido de 08/10), por um link de cada loja, sem login.
-- Ele se identifica pelo CPF e pelo celular. O envio chega como pendente e só vira diária (e entra no
-- pagamento de segunda) quando a gestão aprova e põe o valor.

create table freela_envios (
  id uuid primary key default gen_random_uuid(),
  cpf text check (cpf ~ '^\d{11}$'), -- funcionário sem CPF no cadastro manda mesmo assim
  celular text check (celular ~ '^\d{10,11}$'),
  nome text not null check (length(trim(nome)) > 0),
  pix text not null check (length(trim(pix)) > 0),
  -- Quem é, quando o CPF já estava no portal (freelancer ou funcionário fazendo diária na folga).
  freelancer_id uuid references freelancers (id),
  funcionario_id uuid references funcionarios (id),
  data date not null,
  turno text not null check (turno in ('manha', 'noite')),
  unidade_id text not null references unidades (id),
  funcao text not null check (length(trim(funcao)) > 0),
  observacao text,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  motivo text, -- por que foi recusado
  diaria_id uuid references freela_diarias (id) on delete set null,
  enviado_em timestamptz not null default now(),
  resolvido_por uuid references funcionarios (id),
  resolvido_em timestamptz,
  check (cpf is not null or funcionario_id is not null)
);
-- O mesmo dia e turno só vale uma vez por pessoa (um recusado pode ser mandado de novo).
create unique index freela_envios_unico on freela_envios (coalesce(funcionario_id::text, cpf), data, turno) where status <> 'recusado';
create index freela_envios_status on freela_envios (status, data);

grant select, update, delete on freela_envios to authenticated;
alter table freela_envios enable row level security;
create policy "gestao ve envios" on freela_envios for select using (sou_gestao());
create policy "funcionario ve os seus envios" on freela_envios for select using (funcionario_id = (eu()).id);
create policy "gestao resolve envios" on freela_envios for update using (sou_gestao()) with check (sou_gestao());
create policy "gestao apaga envios" on freela_envios for delete using (sou_gestao());

create function cpf_valido(c text) returns boolean
language plpgsql immutable as $$
declare
  s int;
  d int;
begin
  if c !~ '^\d{11}$' or c ~ '^(\d)\1{10}$' then return false; end if;
  for n in 9..10 loop
    s := 0;
    for i in 1..n loop
      s := s + substr(c, i, 1)::int * (n + 2 - i);
    end loop;
    d := (s * 10) % 11 % 10;
    if d <> substr(c, n + 1, 1)::int then return false; end if;
  end loop;
  return true;
end $$;

-- Lojas para a página do freelancer (não precisa estar logado).
create function freela_lojas() returns table (id text, nome text)
language sql stable security definer set search_path = public as $$
  select id, nome from unidades order by nome
$$;

-- "Quem é você": com CPF e celular, diz se a pessoa já está no portal, sem mostrar dados dela
-- (só o primeiro nome e o fim da chave Pix, para ela conferir). Funcionário ativo manda pelo próprio login.
create function freela_quem_sou(p_cpf text, p_celular text) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  v_cpf text := regexp_replace(p_cpf, '\D', '', 'g');
  v_cel text := right(regexp_replace(p_celular, '\D', '', 'g'), 11);
  f freelancers;
begin
  if not cpf_valido(v_cpf) then return json_build_object('tipo', 'invalido'); end if;
  if exists (select 1 from funcionarios where cpf = v_cpf and status = 'ativo') then
    return json_build_object('tipo', 'funcionario');
  end if;
  select * into f from freelancers where cpf = v_cpf;
  -- Achou pelo CPF mas o celular é outro: pede tudo de novo, e a gestão vê o aviso ao aprovar.
  if f.id is null or (f.celular is not null and right(f.celular, 11) <> v_cel) then
    return json_build_object('tipo', 'novo');
  end if;
  return json_build_object('tipo', 'freelancer', 'nome', split_part(f.nome, ' ', 1), 'pixFinal', right(f.pix, 4));
end $$;

-- Parte comum dos dois jeitos de mandar: confere os dias e grava um envio por dia/turno.
-- p_dias: [{"data": "AAAA-MM-DD", "turno": "noite", "observacao": "..."}].
create function freela_gravar_envios(
  p_cpf text, p_celular text, p_nome text, p_pix text, p_freelancer uuid, p_funcionario uuid,
  p_unidade text, p_funcao text, p_dias jsonb
) returns int
language plpgsql security definer set search_path = public as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  dia jsonb;
  d date;
  n int := 0;
begin
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
    insert into freela_envios (cpf, celular, nome, pix, freelancer_id, funcionario_id, data, turno, unidade_id, funcao, observacao)
    values (p_cpf, p_celular, p_nome, trim(p_pix), p_freelancer, p_funcionario, d, dia->>'turno', p_unidade, trim(p_funcao),
      nullif(trim(dia->>'observacao'), ''))
    on conflict do nothing;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke execute on function freela_gravar_envios(text, text, text, text, uuid, uuid, text, text, jsonb) from public, anon, authenticated;

-- Freelancer, pelo link da loja (sem login). Nome e Pix vazios = usa os do cadastro (só quando CPF e celular conferem).
create function freela_enviar_diarias(
  p_cpf text, p_celular text, p_nome text, p_pix text, p_unidade text, p_funcao text, p_dias jsonb
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
  return freela_gravar_envios(v_cpf, v_cel, v_nome, v_pix, f.id, null, p_unidade, p_funcao, p_dias);
end $$;

-- Funcionário fazendo diária na folga, pelo próprio login.
create function freela_enviar_minhas_diarias(p_pix text, p_unidade text, p_funcao text, p_dias jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare
  u funcionarios := eu();
  fl uuid;
begin
  if u.id is null then raise exception 'Entre no portal para mandar a diária.'; end if;
  select id into fl from freelancers where funcionario_id = u.id;
  return freela_gravar_envios(u.cpf, right(u.celular, 11), u.nome, coalesce(nullif(trim(p_pix), ''), u.pix), fl, u.id, p_unidade, p_funcao, p_dias);
end $$;

grant execute on function freela_lojas() to anon, authenticated;
grant execute on function freela_quem_sou(text, text) to anon, authenticated;
grant execute on function freela_enviar_diarias(text, text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function freela_enviar_minhas_diarias(text, text, text, jsonb) to authenticated;

-- A gestão aprova: cria o cadastro de freelancer se for a primeira vez, lança a diária com o valor e fecha o envio.
-- p_usar_pix: troca o Pix (e o celular) do cadastro pelos que a pessoa mandou.
create function freela_aprovar_envio(p_envio uuid, p_valor numeric, p_funcao text, p_usar_pix boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  e freela_envios;
  fl uuid;
  diaria uuid;
begin
  if not sou_gestao() then raise exception 'Só a gestão aprova diárias.'; end if;
  if p_valor is null or p_valor < 0 then raise exception 'Valor inválido.'; end if;
  select * into e from freela_envios where id = p_envio and status = 'pendente' for update;
  if e.id is null then raise exception 'Esse envio já foi resolvido.'; end if;

  fl := e.freelancer_id;
  if fl is null and e.funcionario_id is not null then select id into fl from freelancers where funcionario_id = e.funcionario_id; end if;
  if fl is null then select id into fl from freelancers where cpf = e.cpf; end if;
  if fl is null then
    insert into freelancers (nome, cpf, pix, celular, funcionario_id, criado_por)
    values (e.nome, e.cpf, e.pix, e.celular, e.funcionario_id, (eu()).id)
    returning id into fl;
  elsif p_usar_pix then
    update freelancers set pix = e.pix, celular = coalesce(e.celular, celular), ativo = true where id = fl;
  else
    update freelancers set ativo = true where id = fl;
  end if;

  insert into freela_diarias (freelancer_id, data, turno, unidade_id, funcao, valor, observacao)
  values (fl, e.data, e.turno, e.unidade_id, coalesce(nullif(trim(p_funcao), ''), e.funcao), p_valor, e.observacao)
  on conflict (freelancer_id, data, turno) do nothing
  returning id into diaria;
  -- A gerente já tinha lançado esse dia: só liga o envio à diária que existe.
  if diaria is null then
    select id into diaria from freela_diarias where freelancer_id = fl and data = e.data and turno = e.turno;
  end if;

  update freela_envios set status = 'aprovado', freelancer_id = fl, diaria_id = diaria, resolvido_por = (eu()).id, resolvido_em = now()
  where id = e.id;
  return diaria;
end $$;

grant execute on function freela_aprovar_envio(uuid, numeric, text, boolean) to authenticated;
