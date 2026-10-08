-- Funcionário que faz diária na folga também manda pelo link dos freelas (pedido de 08/10), em vez de ir para o
-- portal. Com CPF e celular iguais aos do cadastro, o formulário já traz o nome e o Pix dele.

create or replace function freela_quem_sou(p_cpf text, p_celular text) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  v_cpf text := regexp_replace(p_cpf, '\D', '', 'g');
  v_cel text := right(regexp_replace(p_celular, '\D', '', 'g'), 11);
  f freelancers;
  fu funcionarios;
begin
  if not cpf_valido(v_cpf) then return json_build_object('tipo', 'invalido'); end if;
  select * into fu from funcionarios where cpf = v_cpf and status = 'ativo';
  if fu.id is not null then
    -- CPF do time com outro celular: não deixa passar como freela novo.
    if right(fu.celular, 11) <> v_cel then return json_build_object('tipo', 'celular_errado'); end if;
    select * into f from freelancers where funcionario_id = fu.id;
    return json_build_object('tipo', 'funcionario', 'nome', split_part(fu.nome, ' ', 1),
      'pixFinal', right(coalesce(f.pix, fu.pix, ''), 4));
  end if;
  select * into f from freelancers where cpf = v_cpf;
  -- Achou pelo CPF mas o celular é outro: pede tudo de novo, e a gestão vê o aviso ao aprovar.
  if f.id is null or (f.celular is not null and right(f.celular, 11) <> v_cel) then
    return json_build_object('tipo', 'novo');
  end if;
  return json_build_object('tipo', 'freelancer', 'nome', split_part(f.nome, ' ', 1), 'pixFinal', right(f.pix, 4));
end $$;

create or replace function freela_enviar_diarias(
  p_cpf text, p_celular text, p_nome text, p_pix text, p_unidade text, p_funcao text, p_dias jsonb, p_local jsonb default null
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_cpf text := regexp_replace(p_cpf, '\D', '', 'g');
  v_cel text := right(regexp_replace(p_celular, '\D', '', 'g'), 11);
  quem json := freela_quem_sou(p_cpf, p_celular);
  f freelancers;
  fu funcionarios;
  v_nome text := nullif(trim(p_nome), '');
  v_pix text := nullif(trim(p_pix), '');
begin
  if quem->>'tipo' = 'invalido' then raise exception 'CPF inválido. Confira os números.'; end if;
  if quem->>'tipo' = 'celular_errado' then
    raise exception 'Esse CPF é de alguém do time, mas o celular não é o do cadastro. Use o celular cadastrado ou fale com a gerente.';
  end if;
  if length(v_cel) < 10 then raise exception 'Celular inválido. Coloque com DDD.'; end if;
  if quem->>'tipo' = 'funcionario' then
    select * into fu from funcionarios where cpf = v_cpf and status = 'ativo';
    select * into f from freelancers where funcionario_id = fu.id;
    return freela_gravar_envios(v_cpf, v_cel, fu.nome, coalesce(v_pix, f.pix, fu.pix), f.id, fu.id, p_unidade, p_funcao, p_dias, p_local);
  end if;
  -- Guarda o vínculo mesmo quando o celular não confere: a gestão vê o aviso ao aprovar.
  select * into f from freelancers where cpf = v_cpf;
  if quem->>'tipo' = 'freelancer' then
    v_nome := coalesce(v_nome, f.nome);
    v_pix := coalesce(v_pix, f.pix);
  end if;
  if v_nome is null or array_length(regexp_split_to_array(v_nome, '\s+'), 1) < 2 then raise exception 'Coloque o nome completo.'; end if;
  return freela_gravar_envios(v_cpf, v_cel, v_nome, v_pix, f.id, null, p_unidade, p_funcao, p_dias, p_local);
end $$;
