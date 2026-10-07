-- Corrige o erro "new row violates row-level security policy for table funcionarios" ao cadastrar.
-- O cadastro devolve a linha recém-criada, e a regra de leitura procurava o funcionário na tabela,
-- onde ele ainda não aparece durante o próprio insert. Agora a regra usa os dados da própria linha.

create or replace function posso_ver_funcionario(alvo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select sou_gestao()
    or alvo = (eu()).id
    or exists (
      select 1 from funcionarios f, eu() e
      where f.id = alvo and e.nivel = 'supervisor' and e.unidade_id = f.unidade_id
    )
$$;

drop policy "ver funcionarios" on funcionarios;
create policy "ver funcionarios" on funcionarios for select using (
  id = (eu()).id
  or sou_gestao()
  or ((eu()).nivel = 'supervisor' and unidade_id = (eu()).unidade_id)
);
