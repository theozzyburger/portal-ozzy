-- Setor Escritório (não faz exames de manipulador) e hierarquia nas alterações (pedido de 07/10).
-- Ninguém altera dados de quem está acima nem dá um nível acima do seu. Gerente e Administrativo ficam no mesmo degrau.

alter type setor_trabalho add value if not exists 'escritorio';

create function degrau(n nivel_acesso) returns int
language sql immutable as $$
  select case n when 'proprietario' then 4 when 'administrativo' then 3 when 'gerente' then 3 when 'supervisor' then 2 else 1 end
$$;

-- Gestão sobre esta pessoa: quem é gestão e está no mesmo degrau ou acima.
create function posso_alterar(alvo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select sou_gestao() and coalesce((select degrau(f.nivel) from funcionarios f where f.id = alvo), 0) <= degrau((eu()).nivel)
$$;

drop policy "gestao cadastra" on funcionarios;
create policy "gestao cadastra" on funcionarios for insert
  with check (sou_gestao() and degrau(nivel) <= degrau((eu()).nivel));
drop policy "gestao edita" on funcionarios;
create policy "gestao edita" on funcionarios for update
  using (sou_gestao() and degrau(nivel) <= degrau((eu()).nivel))
  with check (sou_gestao() and degrau(nivel) <= degrau((eu()).nivel));

drop policy "enviar documentos" on documentos;
create policy "enviar documentos" on documentos for insert
  with check (enviado_por = (eu()).id and (funcionario_id = (eu()).id or posso_alterar(funcionario_id)));

drop policy "gestao registra ocorrencias" on ocorrencias;
create policy "gestao registra ocorrencias" on ocorrencias for insert
  with check (posso_alterar(funcionario_id) and registrado_por = (eu()).id);

drop policy "gestao registra entrega" on uniforme_entregas;
create policy "gestao registra entrega" on uniforme_entregas for insert
  with check (posso_alterar(funcionario_id) and entregue_por = (eu()).id);

create or replace function definir_foto(alvo uuid, caminho text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if (eu()).id is null or alvo is null or (alvo <> (eu()).id and not posso_alterar(alvo)) then
    raise exception 'Sem permissão para trocar esta foto';
  end if;
  update funcionarios set foto = caminho where id = alvo;
end;
$$;
