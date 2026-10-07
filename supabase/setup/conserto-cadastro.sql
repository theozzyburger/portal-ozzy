-- Conserto do erro "new row violates row-level security policy for table funcionarios" ao cadastrar.
-- Refaz as regras de acesso da tabela de funcionários exatamente como estão nas migrations (0007 e 0015).
-- Pode rodar quantas vezes quiser: não apaga nem muda nenhum dado.

create or replace function posso_ver_funcionario(alvo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select sou_gestao()
    or alvo = (eu()).id
    or exists (
      select 1 from funcionarios f, eu() e
      where f.id = alvo and e.nivel = 'supervisor' and e.unidade_id = f.unidade_id
    )
$$;

drop policy if exists "ver funcionarios" on funcionarios;
create policy "ver funcionarios" on funcionarios for select using (
  id = (eu()).id
  or sou_gestao()
  or ((eu()).nivel = 'supervisor' and unidade_id = (eu()).unidade_id)
);

drop policy if exists "gestao cadastra" on funcionarios;
create policy "gestao cadastra" on funcionarios for insert
  with check (sou_gestao() and degrau(nivel) <= degrau((eu()).nivel));

drop policy if exists "gestao edita" on funcionarios;
create policy "gestao edita" on funcionarios for update
  using (sou_gestao() and degrau(nivel) <= degrau((eu()).nivel))
  with check (sou_gestao() and degrau(nivel) <= degrau((eu()).nivel));

-- Conferência: quem pode cadastrar (precisa estar ativo e com login).
select nome, nivel, status, auth_user_id is not null as tem_login
from funcionarios
where nivel in ('proprietario', 'administrativo', 'gerente')
order by nivel, nome;
