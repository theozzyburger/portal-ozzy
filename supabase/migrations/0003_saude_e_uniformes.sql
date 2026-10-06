-- Saúde ocupacional e uniformes.
-- Exames com data e vencimento (NR-7 e Portaria CVS 3/2026: coprocultura e coproparasitológico
-- na admissão e anualmente para manipuladores de alimentos) e entrega de uniforme com termo assinado na tela.

alter type tipo_documento add value 'aso_admissional';
alter type tipo_documento add value 'aso_periodico';
alter type tipo_documento add value 'aso_retorno';
alter type tipo_documento add value 'aso_mudanca_funcao';
alter type tipo_documento add value 'aso_demissional';
alter type tipo_documento add value 'coprocultura';
alter type tipo_documento add value 'coproparasitologico';
alter type tipo_documento add value 'curso_manipulador';

alter table documentos add column realizado_em date;
alter table documentos add column vence date;
create index documentos_vence on documentos (vence) where vence is not null;

create table uniforme_entregas (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  data date not null,
  itens jsonb not null,                 -- [{ item, tamanho, quantidade }]
  observacao text,
  entregue_por uuid not null references funcionarios (id),
  assinatura text,                      -- imagem PNG em base64 (data URL)
  assinado_em timestamptz,
  assinado_via text check (assinado_via in ('presencial', 'portal')),
  criado_em timestamptz not null default now()
);

alter table uniforme_entregas enable row level security;

create policy "ver entregas" on uniforme_entregas for select using (posso_ver_funcionario(funcionario_id));
create policy "gestao registra entrega" on uniforme_entregas for insert
  with check (sou_gestao() and entregue_por = (eu()).id);

-- A própria pessoa assina pelo portal, uma vez só. Ninguém troca uma assinatura depois de feita.
create function assinar_uniforme(entrega uuid, imagem text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update uniforme_entregas
     set assinatura = imagem, assinado_em = now(), assinado_via = 'portal'
   where id = entrega and funcionario_id = (eu()).id and assinatura is null;
  if not found then
    raise exception 'Termo não encontrado ou já assinado.';
  end if;
end;
$$;
