-- Conserto do erro "new row violates row-level security policy" ao cadastrar funcionário e ao publicar aviso.
-- Refaz as regras de acesso das tabelas de funcionários e de avisos exatamente como estão nas migrations
-- (0007, 0015 e 0022). Pode rodar quantas vezes quiser: não apaga nem muda nenhum dado.

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

-- Avisos: a gestão publica; cada um vê os avisos do seu público (loja, setores ou pessoas escolhidas).
alter table comunicados add column if not exists setores text[];
alter table comunicados add column if not exists destinatarios uuid[];

drop policy if exists "ver comunicados" on comunicados;
create policy "ver comunicados" on comunicados for select using (
  sou_gestao()
  or autor_id = (eu()).id
  or case
    when destinatarios is not null then (eu()).id = any (destinatarios)
    else (unidade_id is null or unidade_id = (eu()).unidade_id)
      and (setores is null or (eu()).setor::text = any (setores))
  end
);

drop policy if exists "gestao publica" on comunicados;
create policy "gestao publica" on comunicados for insert with check (sou_gestao() and autor_id = (eu()).id);

-- Conferência 1: a migration 0022 entrou inteira? (todas as linhas devem dizer "sim")
select 'holerite no salário' as item, case when exists (select 1 from information_schema.columns where table_name = 'salarios' and column_name = 'holerite') then 'sim' else 'NÃO' end as ok
union all select 'outros créditos no salário', case when exists (select 1 from information_schema.columns where table_name = 'salarios' and column_name = 'outros_creditos') then 'sim' else 'NÃO' end
union all select 'histórico de readmissão', case when exists (select 1 from information_schema.tables where table_name = 'vinculos_anteriores') then 'sim' else 'NÃO' end
union all select 'valor do pedido de uniforme', case when exists (select 1 from information_schema.columns where table_name = 'uniforme_pedidos' and column_name = 'valor_total') then 'sim' else 'NÃO' end;

-- Conferência 2: quem pode cadastrar (precisa estar ativo e com login).
select nome, nivel, status, auth_user_id is not null as tem_login
from funcionarios
where nivel in ('proprietario', 'administrativo', 'gerente')
order by nivel, nome;
