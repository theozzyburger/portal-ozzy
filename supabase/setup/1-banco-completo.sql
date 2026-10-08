-- Banco completo do Portal The Ozzy: todas as migrações em ordem.
-- Rode uma vez só, num projeto Supabase novo: SQL Editor > New query > colar tudo > Run.

-- ===== 0001_portal_funcionario.sql =====
-- Portal The Ozzy: RH, documentos, ocorrências, comunicados e folgas.
-- As regras de acesso ficam no banco (RLS), então valem mesmo se alguém tentar burlar o app.
-- Funcionário e Supervisor só visualizam; Gerente, Administrativo e Proprietário gerenciam.

create type nivel_acesso as enum ('funcionario', 'supervisor', 'gerente', 'administrativo', 'proprietario');
create type status_funcionario as enum ('ativo', 'inativo');
create type tipo_documento as enum ('atestado', 'contrato', 'documento_pessoal', 'exame', 'outro');
create type tipo_ocorrencia as enum ('falta', 'atraso', 'advertencia', 'orientacao', 'elogio', 'outro');

create table unidades (
  id text primary key,
  nome text not null
);

insert into unidades (id, nome) values
  ('burger-psd', 'The Ozzy Burger Parque São Domingos'),
  ('burger-va', 'The Ozzy Burger Vila Anastácio'),
  ('pizza', 'The Ozzy Pizza');

create table funcionarios (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  nome text not null,
  celular text not null unique,
  cargo text not null,
  unidade_id text not null references unidades (id),
  nivel nivel_acesso not null default 'funcionario',
  status status_funcionario not null default 'ativo',
  data_admissao date not null,
  data_desligamento date,
  responde_para uuid references funcionarios (id),
  criado_em timestamptz not null default now()
);

create table documentos (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  tipo tipo_documento not null,
  nome_arquivo text not null,
  caminho text not null,
  observacao text,
  inicio date,
  fim date,
  enviado_por uuid not null references funcionarios (id),
  criado_em timestamptz not null default now()
);

create table ocorrencias (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  tipo tipo_ocorrencia not null,
  data date not null,
  descricao text not null,
  registrado_por uuid not null references funcionarios (id),
  criado_em timestamptz not null default now()
);

create table comunicados (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  corpo text not null,
  unidade_id text references unidades (id), -- null = todas as unidades
  autor_id uuid not null references funcionarios (id),
  criado_em timestamptz not null default now()
);

create table comunicado_leituras (
  comunicado_id uuid not null references comunicados (id) on delete cascade,
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  lido_em timestamptz not null default now(),
  primary key (comunicado_id, funcionario_id)
);

create table folgas (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  data date not null,
  unique (funcionario_id, data)
);

-- Quem está logado. security definer para não cair em recursão nas políticas.
create function eu() returns funcionarios
language sql stable security definer set search_path = public as $$
  select * from funcionarios where auth_user_id = auth.uid() and status = 'ativo'
$$;

create function sou_gestao() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select nivel in ('gerente', 'administrativo', 'proprietario') from eu()), false)
$$;

create function posso_ver_funcionario(alvo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from funcionarios f, eu() e
    where f.id = alvo
      and (f.id = e.id
        or e.nivel in ('gerente', 'administrativo', 'proprietario')
        or (e.nivel = 'supervisor' and e.unidade_id = f.unidade_id))
  )
$$;

-- Nomes de todos (sem outros dados), para qualquer logado ver quem publicou um aviso.
create function nomes_funcionarios() returns table (id uuid, nome text)
language sql stable security definer set search_path = public as $$
  select f.id, f.nome from funcionarios f where (eu()).id is not null
$$;

alter table unidades enable row level security;
alter table funcionarios enable row level security;
alter table documentos enable row level security;
alter table ocorrencias enable row level security;
alter table comunicados enable row level security;
alter table comunicado_leituras enable row level security;
alter table folgas enable row level security;

create policy "logados veem unidades" on unidades for select using ((eu()).id is not null);

create policy "ver funcionarios" on funcionarios for select using (posso_ver_funcionario(id));
create policy "gestao cadastra" on funcionarios for insert with check (sou_gestao());
create policy "gestao edita" on funcionarios for update using (sou_gestao()) with check (sou_gestao());

-- Documentos: só o próprio funcionário e a gestão (dados sensíveis, LGPD).
create policy "ver documentos" on documentos for select
  using (funcionario_id = (eu()).id or sou_gestao());
create policy "enviar documentos" on documentos for insert
  with check (enviado_por = (eu()).id and (funcionario_id = (eu()).id or sou_gestao()));

create policy "ver ocorrencias" on ocorrencias for select using (posso_ver_funcionario(funcionario_id));
create policy "gestao registra ocorrencias" on ocorrencias for insert
  with check (sou_gestao() and registrado_por = (eu()).id);

create policy "ver comunicados" on comunicados for select
  using (unidade_id is null or unidade_id = (eu()).unidade_id or sou_gestao());
create policy "gestao publica" on comunicados for insert with check (sou_gestao() and autor_id = (eu()).id);

create policy "ver leituras" on comunicado_leituras for select
  using (funcionario_id = (eu()).id or sou_gestao());
create policy "marcar lido" on comunicado_leituras for insert with check (funcionario_id = (eu()).id);

create policy "ver folgas" on folgas for select using (posso_ver_funcionario(funcionario_id));
create policy "gestao marca folga" on folgas for insert with check (sou_gestao());
create policy "gestao remove folga" on folgas for delete using (sou_gestao());

-- Arquivos ficam num bucket privado, numa pasta por funcionário: documentos/<funcionario_id>/<arquivo>.
insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false);

create policy "ler arquivos" on storage.objects for select using (
  bucket_id = 'documentos'
  and ((storage.foldername(name))[1] = (eu()).id::text or sou_gestao())
);
create policy "enviar arquivos" on storage.objects for insert with check (
  bucket_id = 'documentos'
  and ((storage.foldername(name))[1] = (eu()).id::text or sou_gestao())
);

-- ===== 0002_painel_pedidos.sql =====
-- Painel da gestão: pedidos/faturamento por dia, loja e canal, e notas no iFood e 99Food.
-- Estas tabelas vão ser preenchidas pela integração com o PDV e com as plataformas.
-- Só Proprietário e Gerente leem (decisão de 06/10); a escrita é feita pela integração (service role).

create type canal_venda as enum ('salao', 'ifood', 'proprio', '99food');
create type plataforma_delivery as enum ('ifood', '99food');

create table vendas_diarias (
  unidade_id text not null references unidades (id),
  data date not null,
  canal canal_venda not null,
  pedidos integer not null default 0,
  faturamento numeric(12, 2) not null default 0,
  primary key (unidade_id, data, canal)
);

create table avaliacoes (
  unidade_id text not null references unidades (id),
  plataforma plataforma_delivery not null,
  nota numeric(2, 1) not null,
  total_avaliacoes integer not null default 0,
  nota_ha_30_dias numeric(2, 1),
  atualizado_em timestamptz not null default now(),
  primary key (unidade_id, plataforma)
);

create function vejo_painel() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select nivel in ('gerente', 'proprietario') from eu()), false)
$$;

alter table vendas_diarias enable row level security;
alter table avaliacoes enable row level security;

create policy "painel le vendas" on vendas_diarias for select using (vejo_painel());
create policy "painel le avaliacoes" on avaliacoes for select using (vejo_painel());

-- ===== 0003_saude_e_uniformes.sql =====
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

-- ===== 0004_caixinha.sql =====
-- Caixinha: setor de cada funcionário (grupos de bônus) e total arrecadado por mês e loja.
-- As regras de divisão ficam no app (src/lib/caixinha.ts), iguais às da planilha.

create type setor_trabalho as enum ('cozinha', 'atendimento', 'producao', 'unidade', 'geral');
alter table funcionarios add column setor setor_trabalho;

create table caixinha_mensal (
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  unidade_id text not null references unidades (id),
  total numeric(12, 2) not null default 0,
  primary key (mes, unidade_id)
);

alter table caixinha_mensal enable row level security;
create policy "gestao ve caixinha" on caixinha_mensal for select using (sou_gestao());
create policy "gestao lanca caixinha" on caixinha_mensal for insert with check (sou_gestao());
create policy "gestao corrige caixinha" on caixinha_mensal for update using (sou_gestao()) with check (sou_gestao());

-- ===== 0005_turnos_e_regulamento.sql =====
-- Turnos-padrão (horários do Cronograma 2026) e assinatura do regulamento interno.

-- dias: 7 posições, de segunda a domingo. Cada uma é null (folga) ou
-- {"inicio": "HH:MM", "fim": "HH:MM", "pausaMin": 60}. Fim menor que o início = vira a noite.
create table turnos (
  id text primary key,
  local text not null, -- id da loja, 'producao' ou 'escritorio'
  nome text not null,
  dias jsonb not null check (jsonb_typeof(dias) = 'array' and jsonb_array_length(dias) = 7),
  ordem int not null default 0
);

alter table turnos enable row level security;
create policy "todos veem turnos" on turnos for select using ((eu()).id is not null);
create policy "gestao cria turnos" on turnos for insert with check (sou_gestao());
create policy "gestao edita turnos" on turnos for update using (sou_gestao()) with check (sou_gestao());

alter table funcionarios add column turno_id text references turnos (id) on delete set null;

insert into turnos (id, local, nome, ordem, dias) values
  ('t-psd-manha', 'burger-psd', 'Manhã', 1, '[null, null, {"inicio":"09:00","fim":"18:45","pausaMin":60}, {"inicio":"09:00","fim":"18:45","pausaMin":60}, {"inicio":"09:00","fim":"18:45","pausaMin":60}, {"inicio":"09:00","fim":"18:45","pausaMin":60}, {"inicio":"13:45","fim":"23:30","pausaMin":60}]'),
  ('t-psd-cozinha', 'burger-psd', 'Cozinha (noite)', 2, '[null, null, {"inicio":"13:30","fim":"23:15","pausaMin":60}, {"inicio":"13:30","fim":"23:15","pausaMin":60}, {"inicio":"14:45","fim":"00:30","pausaMin":60}, {"inicio":"14:45","fim":"00:30","pausaMin":60}, {"inicio":"13:45","fim":"23:30","pausaMin":60}]'),
  ('t-psd-atendimento', 'burger-psd', 'Atendimento (noite)', 3, '[null, null, {"inicio":"13:30","fim":"23:15","pausaMin":60}, {"inicio":"13:30","fim":"23:15","pausaMin":60}, {"inicio":"14:45","fim":"00:30","pausaMin":60}, {"inicio":"14:45","fim":"00:30","pausaMin":60}, {"inicio":"13:45","fim":"23:30","pausaMin":60}]'),
  ('t-va-cozinha', 'burger-va', 'Cozinha', 4, '[null, null, {"inicio":"13:30","fim":"23:15","pausaMin":60}, {"inicio":"13:30","fim":"23:15","pausaMin":60}, {"inicio":"13:00","fim":"23:45","pausaMin":120}, {"inicio":"14:00","fim":"23:45","pausaMin":60}, {"inicio":"13:30","fim":"23:15","pausaMin":60}]'),
  ('t-va-atendimento', 'burger-va', 'Atendimento', 5, '[null, null, {"inicio":"13:30","fim":"23:15","pausaMin":60}, {"inicio":"13:30","fim":"23:15","pausaMin":60}, {"inicio":"14:00","fim":"23:45","pausaMin":120}, {"inicio":"11:30","fim":"22:15","pausaMin":60}, {"inicio":"13:30","fim":"23:15","pausaMin":60}]'),
  ('t-pizza-cozinha', 'pizza', 'Cozinha', 6, '[null, null, {"inicio":"13:15","fim":"23:00","pausaMin":60}, {"inicio":"13:15","fim":"23:00","pausaMin":60}, {"inicio":"13:45","fim":"23:30","pausaMin":60}, {"inicio":"13:45","fim":"23:30","pausaMin":60}, {"inicio":"13:15","fim":"23:00","pausaMin":60}]'),
  ('t-producao', 'producao', 'Produção', 7, '[null, null, {"inicio":"08:00","fim":"17:45","pausaMin":60}, {"inicio":"08:00","fim":"17:45","pausaMin":60}, {"inicio":"08:00","fim":"17:45","pausaMin":60}, {"inicio":"08:00","fim":"17:45","pausaMin":60}, {"inicio":"08:00","fim":"17:45","pausaMin":60}]'),
  ('t-escritorio', 'escritorio', 'Escritório', 8, '[{"inicio":"08:30","fim":"17:45","pausaMin":30}, {"inicio":"08:30","fim":"17:45","pausaMin":30}, {"inicio":"08:30","fim":"17:45","pausaMin":30}, {"inicio":"08:30","fim":"17:45","pausaMin":30}, {"inicio":"08:30","fim":"17:45","pausaMin":30}, null, null]'),
  ('t-manutencao', 'escritorio', 'Manutenção', 9, '[{"inicio":"10:00","fim":"19:45","pausaMin":60}, {"inicio":"10:00","fim":"19:45","pausaMin":60}, {"inicio":"10:00","fim":"19:45","pausaMin":60}, {"inicio":"10:00","fim":"19:45","pausaMin":60}, {"inicio":"10:00","fim":"19:45","pausaMin":60}, null, null]');

-- Regulamento interno em versões. A gestão publica uma versão nova pelo portal; todos assinam de novo.
-- O hash (SHA-256 do texto) prova qual texto exato cada pessoa assinou.
create table regulamento_versoes (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique,
  texto text not null,
  nota text,
  hash text not null,
  publicado_em timestamptz not null default now(),
  publicado_por uuid references funcionarios (id)
);

-- Número e hash são calculados pelo banco; o texto nunca muda depois de publicado.
create function preparar_versao_regulamento() returns trigger
language plpgsql as $$
begin
  new.numero := coalesce((select max(numero) from regulamento_versoes), 0) + 1;
  new.hash := encode(sha256(convert_to(new.texto, 'UTF8')), 'hex');
  new.publicado_em := now();
  return new;
end $$;
create trigger antes_de_publicar before insert on regulamento_versoes
  for each row execute function preparar_versao_regulamento();

alter table regulamento_versoes enable row level security;
create policy "todos leem o regulamento" on regulamento_versoes for select using ((eu()).id is not null);
create policy "gestao publica o regulamento" on regulamento_versoes for insert
  with check (sou_gestao() and publicado_por = (eu()).id);

-- Assinaturas: uma por pessoa e versão. Ninguém edita nem apaga (não há política de update/delete).
create table regulamento_leituras (
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  versao_id uuid not null references regulamento_versoes (id),
  assinatura text not null, -- PNG em base64
  assinado_em timestamptz not null default now(),
  hash text not null,
  dispositivo text,
  ip text,
  primary key (funcionario_id, versao_id)
);

-- Data, hash e IP vêm do servidor, não do aparelho de quem assina.
create function registrar_leitura_regulamento() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.assinado_em := now();
  new.hash := (select hash from regulamento_versoes where id = new.versao_id);
  new.ip := split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1);
  return new;
end $$;
create trigger antes_de_assinar before insert on regulamento_leituras
  for each row execute function registrar_leitura_regulamento();

alter table regulamento_leituras enable row level security;
create policy "ver assinaturas do regulamento" on regulamento_leituras for select
  using (funcionario_id = (eu()).id or sou_gestao());
create policy "assino o regulamento" on regulamento_leituras for insert
  with check (funcionario_id = (eu()).id);

-- Versão 1: Regulamento_Interno_Revisado-2025.docx (mesmo texto de src/lib/regulamento-2025.md).
insert into regulamento_versoes (texto, nota) values ($reg$# Regulamento Interno The Ozzy

## Introdução

O regulamento interno tem como objetivo orientar todos os colaboradores sobre as normas da empresa, estabelecendo direitos e deveres, garantindo organização, segurança, qualidade de vida e produtividade no ambiente de trabalho. O cumprimento dessas normas é obrigatório e o descumprimento poderá gerar medidas disciplinares.

## Contratação e transferência

A empresa poderá realizar transferências de equipe entre unidades sempre que houver necessidade operacional, podendo ocorrer de forma diária, semanal, mensal ou anual. Em caso de mudança de unidade durante o turno, poderá ser concedido adicional de deslocamento equivalente a uma passagem de ônibus ou transporte por aplicativo.

## Armários, vestiários e pertences pessoais

Os armários são de uso individual e fornecidos ao colaborador no início de suas atividades. O colaborador receberá um cadeado com senha, cujo uso é obrigatório. Em caso de perda, o valor de reposição será descontado em folha (R$ 20). Pertences deixados fora dos armários poderão ser recolhidos e armazenados no setor de 'Achados e Perdidos' pelo prazo de 30 dias, após o qual poderão ser descartados ou doados.

## EPIs e higiene

A empresa fornecerá gratuitamente todos os Equipamentos de Proteção Individual (EPIs), que são de uso obrigatório. O não uso ou uso incorreto poderá gerar medidas disciplinares. Colaboradores que manipulam alimentos devem seguir todas as normas de higiene e asseio pessoal, incluindo: unhas curtas e limpas, cabelos protegidos, ausência de barba e bigode, e uso de uniforme limpo e completo.

## Uniformes

Os uniformes devem ser utilizados durante a jornada de trabalho e mantidos limpos e em bom estado de conservação. A substituição por desgaste natural será responsabilidade da empresa. Em casos de mau uso, perda ou extravio, o custo poderá ser repassado ao colaborador. O uniforme não deve ser utilizado fora das dependências da empresa.

## Uso de celular

Durante o expediente, é proibido o uso de celular pessoal, exceto em pausas. Aos líderes, a empresa poderá fornecer celular corporativo, de uso exclusivo para fins profissionais. Não é permitido utilizar celular pessoal na presença de clientes ou em áreas de atendimento.

## Pausas e intervalos

- Cada colaborador terá 1 hora de intervalo por turno, destinada a refeição e descanso.
- O intervalo é parte da jornada de trabalho.
- O horário será definido pela gerência no início do turno, de acordo com a necessidade operacional.
- Refeições devem ser feitas exclusivamente na sala de descanso. É proibido consumir alimentos na cozinha ou em áreas de atendimento.
- Pausas adicionais para fumo ou celular devem ocorrer apenas no período de intervalo.
- Fumantes não devem fumar utilizando o uniforme da empresa.
- Pausas devem ocorrer até as 19h.
- É proibido o consumo de bebidas alcoólicas ou substâncias alucinógenas durante o expediente.

## Registro de ponto

- O registro de ponto é obrigatório na entrada, início e fim do intervalo, e saída do expediente.
- O ponto deve ser registrado imediatamente, sem atrasos.
- O colaborador é responsável por seus registros.
- Esquecimentos devem ser comunicados no mesmo dia à gerência, com justificativa válida.
- Atrasos ou saídas antecipadas poderão gerar descontos e medidas disciplinares.

## Coleta de óleo

A coleta de óleo é responsabilidade de quem recebe a empresa responsável. O líder deverá comunicar a empresa responsável via WhatsApp, agendando a coleta.

## Medidas disciplinares

O descumprimento das normas poderá resultar em medidas disciplinares progressivas:

- 1ª ocorrência: advertência escrita;
- 2ª ocorrência: advertência escrita;
- 3ª ocorrência: suspensão;
- Reincidência grave ou fraude: desligamento por justa causa.

## Infrações e sanções

| Exemplo no ambiente de trabalho | Medida disciplinar | Grau |
| --- | --- | --- |
| Uso de celular pessoal em horário de produção | Advertência verbal | 1 |
| Descumprimento do horário de pausa | Advertência verbal | 1 |
| Falta de higiene pessoal (unhas, cabelos soltos, sem touca) | Advertência verbal | 1 |
| Não higienizar corretamente a estação de trabalho | Advertência verbal | 1 |
| Desperdício de insumos por descuido (deixar queimar, cortar errado) | Advertência verbal | 1 |
| Não seguir corretamente receitas e padrões da casa | Advertência escrita | 2 |
| Não comunicar problemas com equipamentos ou insumos | Advertência escrita | 2 |
| Uso indevido de equipamentos (facas, fritadeiras, forno etc.) | Advertência escrita | 2 |
| Desrespeito ao uso de EPIs (luvas, avental, protetores) | Advertência escrita | 2 |
| Não respeitar a ordem de limpeza definida pela equipe | Advertência escrita | 2 |
| Discussões e desentendimentos na cozinha | Advertência escrita | 2 |
| Saída não autorizada do posto de trabalho | Advertência escrita | 2 |
| Manipular alimentos sem higienização correta | Advertência escrita | 2 |
| Desrespeito a colegas, superiores ou clientes | Advertência escrita | 2 |
| Linguagem ofensiva ou comportamento agressivo | Advertência escrita | 2 |
| Não registrar corretamente a saída de mercadorias | Advertência escrita | 2 |
| Faltas ou atrasos reincidentes | Suspensão | 3 |
| Consumo inadequado de itens da casa (sem autorização) | Suspensão | 3 |
| Roubo ou furto de insumos, bebidas ou equipamentos | Demissão por justa causa | 4 |
| Consumo de bebidas alcoólicas ou drogas no trabalho | Demissão por justa causa | 4 |
| Agressão física ou ameaça a colegas/superiores | Demissão por justa causa | 4 |
| Fraude em registros de ponto ou documentos internos | Demissão por justa causa | 4 |
| Quebra intencional de equipamentos | Demissão por justa causa | 4 |

## Férias e folgas

As férias devem ser solicitadas com antecedência para organização da equipe. Cada colaborador tem direito a 1 folga semanal às segundas-feiras, e um domingo de folga por mês, definido pela gerência. Os feriados são trabalhados, e é concedido ao empregador o direito de optar pelo pagamento ou concessão de folga futura, sendo avisado previamente aos colaboradores.

## Atestados e licenças

Atestados médicos devem ser apresentados em até 4 dias após a ausência, salvo internação. Atestados de acompanhamento de filhos são reconhecidos uma vez por ano, até os 6 anos de idade da criança. Gravidez deve ser comunicada à empresa para organização da licença-maternidade. Em caso de falecimento de parentes próximos (pais, filhos, cônjuge, avós, netos, irmãos), será concedida licença de acordo com a legislação vigente.

## Salário

O salário é contabilizado do dia 01 ao dia 30/31 de cada mês e pago no dia 05 do mês subsequente. A empresa antecipa 40% do salário em torno do dia 20. O pagamento inclui salário base, vale-transporte e demais benefícios previstos.

## Refeições

O cardápio pré-definido pelos supervisores deverá ser seguido, respeitando os ingredientes permitidos para aquela refeição.

A quantidade deverá ser preparada de acordo com a equipe em expediente e, caso sobre, sob hipótese nenhuma poderá ser levada para casa.

- De terça a sábado, o cardápio de refeições inclui opções com proteína, carboidratos e legumes suficientes para uma alimentação saudável dentro do ambiente de trabalho.
- Aos domingos fica estabelecido o cardápio de burgers do cardápio com até 2 carnes, ou uma pizza broto por pessoa.
- Lanche do mês apenas no último domingo do mês.
- As carnes são de cada indivíduo e não podem ser transferidas para outra pessoa.
- Adicional de alface e tomate é livre.
- Todos os outros adicionais não estão liberados.
- É extremamente proibida a venda de lanches ou pizzas para outros funcionários, sendo cabível pena de suspensão.
- É obrigatório que a comanda de cada pedido seja lançada com o nome do colaborador correspondente. Cozinha não faz pedido sem comanda.
- O lanche deverá ser consumido em loja, fazendo parte da pausa na jornada de trabalho.
- Não poderão ser substituídos por porções, bebidas ou outros pratos do cardápio.

## Descontos para colaboradores

Para todos os colaboradores dentro do expediente, a empresa fornece 15% de desconto para consumo dos itens da loja.

Para bebidas, exceto bebidas alcoólicas, fica estabelecido o desconto de 30%.

Esse desconto é pessoal e intransferível, limitado apenas aos colaboradores.

## Folga de aniversário

- Cada colaborador terá direito a 1 (um) dia de folga remunerada no mês do seu aniversário.
- A data da folga deverá ser definida em conjunto com a gerência, considerando a escala e as necessidades operacionais.
- Caso o aniversário coincida com um dia de folga regular, o colaborador poderá escolher outro dia dentro do mesmo mês.
- A folga de aniversário é pessoal e intransferível, não podendo ser convertida em pagamento adicional ou acumulada para meses posteriores.
- O pedido deve ser feito com antecedência mínima de 15 dias, para que a escala de trabalho seja ajustada.
$reg$, 'Regulamento revisado 2025.');

-- ===== 0006_manutencao.sql =====
-- Chamados de manutenção e o acesso "Manutenção" (manutencista), pedidos em 07/10.
-- Qualquer pessoa abre chamado; o manutencista e a gestão veem os de todas as lojas e mudam o andamento.

alter type nivel_acesso add value if not exists 'manutencao';
alter type setor_trabalho add value if not exists 'manutencao';

create function atendo_chamados() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select nivel::text in ('manutencao', 'gerente', 'administrativo', 'proprietario') from eu()), false)
$$;

create type gravidade_chamado as enum ('urgente', 'importante', 'simples');
create type categoria_chamado as enum
  ('equipamento', 'refrigeracao', 'eletrica', 'hidraulica', 'gas', 'reforma', 'computador', 'internet', 'moveis', 'outro');
create type status_chamado as enum ('aberto', 'andamento', 'aguardando', 'resolvido', 'cancelado');

create table chamados (
  id uuid primary key default gen_random_uuid(),
  numero int generated always as identity,
  unidade_id text not null references unidades (id),
  categoria categoria_chamado not null,
  gravidade gravidade_chamado not null,
  titulo text not null check (length(trim(titulo)) > 0),
  descricao text not null default '',
  local text,
  foto text, -- caminho no bucket "chamados"
  status status_chamado not null default 'aberto',
  aberto_por uuid not null references funcionarios (id),
  aberto_em timestamptz not null default now(),
  responsavel_id uuid references funcionarios (id),
  fechado_em timestamptz
);

-- Quem abriu, data e hora vêm do login e do relógio do servidor, nunca do formulário.
create function preparar_chamado() returns trigger
language plpgsql as $$
begin
  new.aberto_por := (eu()).id;
  new.aberto_em := now();
  new.status := 'aberto';
  new.responsavel_id := null;
  new.fechado_em := null;
  return new;
end $$;
create trigger antes_de_abrir before insert on chamados for each row execute function preparar_chamado();

create table chamado_eventos (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references chamados (id) on delete cascade,
  autor_id uuid not null references funcionarios (id),
  em timestamptz not null default now(),
  texto text,
  status status_chamado -- preenchido quando o evento mudou o andamento
);

create function vejo_chamado(c chamados) returns boolean
language sql stable security definer set search_path = public as $$
  select atendo_chamados() or c.aberto_por = (eu()).id or c.unidade_id = (eu()).unidade_id
$$;

alter table chamados enable row level security;
create policy "ver chamados" on chamados for select using (vejo_chamado(chamados));
create policy "abrir chamado" on chamados for insert with check ((eu()).id is not null);
-- Sem update/delete direto: o andamento muda só pela função abaixo, que deixa histórico.

alter table chamado_eventos enable row level security;
create policy "ver historico" on chamado_eventos for select
  using (exists (select 1 from chamados c where c.id = chamado_id and vejo_chamado(c)));

-- Comentar (qualquer um que vê o chamado) e mudar o andamento (manutenção e gestão).
create function atualizar_chamado(chamado uuid, novo_status status_chamado, comentario text)
returns void language plpgsql security definer set search_path = public as $$
declare
  c chamados;
  quem funcionarios := eu();
begin
  select * into c from chamados where id = chamado;
  if c.id is null or quem.id is null or not vejo_chamado(c) then
    raise exception 'Chamado não encontrado.';
  end if;
  if novo_status is not null then
    if not atendo_chamados() then
      raise exception 'Só a manutenção e a gestão mudam o andamento.';
    end if;
    update chamados set
      status = novo_status,
      responsavel_id = coalesce(responsavel_id, case when quem.nivel::text = 'manutencao' then quem.id end),
      fechado_em = case when novo_status in ('resolvido', 'cancelado') then now() end
    where id = chamado;
  elsif coalesce(trim(comentario), '') = '' then
    return;
  end if;
  insert into chamado_eventos (chamado_id, autor_id, texto, status)
    values (chamado, quem.id, nullif(trim(comentario), ''), novo_status);
end $$;

-- Fotos dos chamados: bucket privado, uma pasta por loja.
insert into storage.buckets (id, name, public) values ('chamados', 'chamados', false);
create policy "ver fotos de chamados" on storage.objects for select using (bucket_id = 'chamados' and (eu()).id is not null);
create policy "enviar fotos de chamados" on storage.objects for insert with check (bucket_id = 'chamados' and (eu()).id is not null);

-- ===== 0007_corrige_cadastro.sql =====
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

-- ===== 0008_turnos_editaveis.sql =====
-- Turnos editáveis pelo portal: a gestão já podia criar e alterar; agora também apaga.
-- Quem estava no turno apagado fica sem turno (funcionarios.turno_id usa "on delete set null").
create policy "gestao apaga turnos" on turnos for delete using (sou_gestao());


-- ===== 0009_lucro_facil.sql =====
-- Dados copiados do Lucro Fácil por uma rotina automática (fichas técnicas e resultado do mês).
-- Quem escreve é a importação (.github/workflows/importar-lucro.yml), conectada como dona do banco;
-- pelo portal estas tabelas são só leitura.

-- Fichas técnicas: todos veem os insumos e quantidades.
create table lf_fichas (
  produto_id integer primary key,
  nome text not null,
  categoria text,
  -- Preparo = base usada dentro de outras fichas (molhos, massas, bases de pizza).
  preparo boolean not null default false,
  -- [{nome, unidade, qtd, tamanho, preparoId}]
  itens jsonb not null default '[]'
);

-- Custos das fichas: só a gestão (Gerente para cima).
create table lf_fichas_custo (
  produto_id integer primary key references lf_fichas on delete cascade,
  custo numeric(12, 4) not null default 0,
  preco numeric(12, 2) not null default 0,
  -- [{custoUnit, total}] na mesma ordem dos itens da ficha.
  itens jsonb not null default '[]'
);

-- Resultado (DRE) do mês por loja: só Proprietário e Administrativo.
create table lf_resultados (
  unidade_id text not null references unidades (id),
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  pedidos integer not null default 0,
  faturamento numeric(14, 2) not null default 0,
  cmv numeric(14, 2) not null default 0,
  impostos numeric(14, 2) not null default 0,
  comissoes numeric(14, 2) not null default 0,
  taxas_pagamento numeric(14, 2) not null default 0,
  custos_operacionais numeric(14, 2) not null default 0,
  lucro_operacional numeric(14, 2) not null default 0,
  ticket_medio numeric(10, 2) not null default 0,
  primary key (unidade_id, mes)
);

-- Quando cada conjunto de dados foi copiado pela última vez.
create table lf_sincronizacao (
  dado text primary key,
  em timestamptz not null default now()
);

create function vejo_resultado() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select nivel::text in ('administrativo', 'proprietario') from eu()), false)
$$;

alter table lf_fichas enable row level security;
alter table lf_fichas_custo enable row level security;
alter table lf_resultados enable row level security;
alter table lf_sincronizacao enable row level security;

create policy "todos leem fichas" on lf_fichas for select using ((eu()).id is not null);
create policy "gestao le custos" on lf_fichas_custo for select using (sou_gestao());
create policy "direcao le resultados" on lf_resultados for select using (vejo_resultado());
create policy "todos leem sincronizacao" on lf_sincronizacao for select using ((eu()).id is not null);

-- Recebe o arquivo gerado pela rotina. Cada parte presente substitui a anterior:
--   fichas: [{id, nome, categoria, preparo, custo, preco, itens: [{nome, unidade, qtd, tamanho, preparoId, custoUnit}]}]
--   resultados: [{unidade, mes, pedidos, faturamento, cmv, impostos, comissoes, taxasPagamento, custosOperacionais, lucroOperacional, ticketMedio}]
create function lf_importar(dados jsonb) returns text
language plpgsql set search_path = public as $$
declare
  n_fichas integer := 0;
  n_resultados integer := 0;
begin
  if jsonb_typeof(dados -> 'fichas') = 'array' and jsonb_array_length(dados -> 'fichas') > 0 then
    delete from lf_fichas;
    insert into lf_fichas (produto_id, nome, categoria, preparo, itens)
    select (f ->> 'id')::integer, f ->> 'nome', nullif(f ->> 'categoria', ''), coalesce((f ->> 'preparo')::boolean, false),
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'nome', i ->> 'nome', 'unidade', i ->> 'unidade', 'qtd', (i ->> 'qtd')::numeric,
          'tamanho', nullif(i ->> 'tamanho', ''), 'preparoId', (i ->> 'preparoId')::integer) order by o)
        from jsonb_array_elements(f -> 'itens') with ordinality as x (i, o)
      ), '[]')
    from jsonb_array_elements(dados -> 'fichas') f;
    get diagnostics n_fichas = row_count;

    insert into lf_fichas_custo (produto_id, custo, preco, itens)
    select (f ->> 'id')::integer, coalesce((f ->> 'custo')::numeric, 0), coalesce((f ->> 'preco')::numeric, 0),
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'custoUnit', coalesce((i ->> 'custoUnit')::numeric, 0),
          'total', round(coalesce((i ->> 'custoUnit')::numeric, 0) * coalesce((i ->> 'qtd')::numeric, 0), 4)) order by o)
        from jsonb_array_elements(f -> 'itens') with ordinality as x (i, o)
      ), '[]')
    from jsonb_array_elements(dados -> 'fichas') f;

    insert into lf_sincronizacao (dado, em) values ('fichas', now())
    on conflict (dado) do update set em = excluded.em;
  end if;

  if jsonb_typeof(dados -> 'resultados') = 'array' and jsonb_array_length(dados -> 'resultados') > 0 then
    insert into lf_resultados (unidade_id, mes, pedidos, faturamento, cmv, impostos, comissoes, taxas_pagamento,
      custos_operacionais, lucro_operacional, ticket_medio)
    select r ->> 'unidade', r ->> 'mes', coalesce((r ->> 'pedidos')::integer, 0),
      coalesce((r ->> 'faturamento')::numeric, 0), coalesce((r ->> 'cmv')::numeric, 0), coalesce((r ->> 'impostos')::numeric, 0),
      coalesce((r ->> 'comissoes')::numeric, 0), coalesce((r ->> 'taxasPagamento')::numeric, 0),
      coalesce((r ->> 'custosOperacionais')::numeric, 0), coalesce((r ->> 'lucroOperacional')::numeric, 0),
      coalesce((r ->> 'ticketMedio')::numeric, 0)
    from jsonb_array_elements(dados -> 'resultados') r
    on conflict (unidade_id, mes) do update set
      pedidos = excluded.pedidos, faturamento = excluded.faturamento, cmv = excluded.cmv, impostos = excluded.impostos,
      comissoes = excluded.comissoes, taxas_pagamento = excluded.taxas_pagamento,
      custos_operacionais = excluded.custos_operacionais, lucro_operacional = excluded.lucro_operacional,
      ticket_medio = excluded.ticket_medio;
    get diagnostics n_resultados = row_count;

    insert into lf_sincronizacao (dado, em) values ('resultados', now())
    on conflict (dado) do update set em = excluded.em;
  end if;

  return format('%s fichas, %s resultados', n_fichas, n_resultados);
end;
$$;

revoke execute on function lf_importar(jsonb) from public, anon, authenticated;

-- ===== 0010_pix_e_freelancers.sql =====
-- Pix de cada funcionário e controle de freelancers (pedido de 07/10).

alter table funcionarios add column pix text;

-- Freelancers: cadastro e diárias. Só a gestão (Gerente, Administrativo, Proprietário) vê e lança:
-- CPF e Pix são dados pessoais.
create table freelancers (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf text not null,
  pix text not null,
  celular text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  criado_por uuid references funcionarios (id)
);

create unique index freelancers_cpf on freelancers (cpf);

-- Cada dia trabalhado. Semana de segunda a domingo, paga na segunda seguinte.
create table freela_diarias (
  id uuid primary key default gen_random_uuid(),
  freelancer_id uuid not null references freelancers (id),
  data date not null,
  turno text not null check (turno in ('manha', 'noite')),
  unidade_id text not null references unidades (id),
  funcao text not null,
  valor numeric(10, 2) not null check (valor >= 0),
  observacao text,
  lancado_por uuid references funcionarios (id) default (eu()).id,
  lancado_em timestamptz not null default now(),
  unique (freelancer_id, data, turno)
);

create index freela_diarias_data on freela_diarias (data);

-- Pagamento da semana: quem marcou e quando (uma linha por freelancer por semana).
create table freela_pagamentos (
  freelancer_id uuid not null references freelancers (id),
  semana date not null check (extract(isodow from semana) = 1),
  valor numeric(10, 2) not null,
  pago_em timestamptz not null default now(),
  pago_por uuid references funcionarios (id) default (eu()).id,
  primary key (freelancer_id, semana)
);

alter table freelancers enable row level security;
alter table freela_diarias enable row level security;
alter table freela_pagamentos enable row level security;

create policy "gestao le freelancers" on freelancers for select using (sou_gestao());
create policy "gestao cadastra freelancers" on freelancers for insert with check (sou_gestao());
create policy "gestao altera freelancers" on freelancers for update using (sou_gestao());

create policy "gestao le diarias" on freela_diarias for select using (sou_gestao());
create policy "gestao lanca diarias" on freela_diarias for insert with check (sou_gestao());
create policy "gestao altera diarias" on freela_diarias for update using (sou_gestao());
create policy "gestao apaga diarias" on freela_diarias for delete using (sou_gestao());

create policy "gestao le pagamentos" on freela_pagamentos for select using (sou_gestao());
create policy "gestao marca pagamentos" on freela_pagamentos for insert with check (sou_gestao());
create policy "gestao desfaz pagamentos" on freela_pagamentos for delete using (sou_gestao());

-- ===== 0011_funcionario_freelancer.sql =====
-- Funcionário também pode fazer diária como freelancer na folga (pedido de 07/10).
-- O cadastro de freelancer fica ligado ao funcionário; nesse caso o CPF é opcional.
alter table freelancers add column funcionario_id uuid unique references funcionarios (id);
alter table freelancers alter column cpf drop not null;
alter table freelancers add constraint freelancers_cpf_ou_funcionario check (cpf is not null or funcionario_id is not null);

-- ===== 0012_foto_perfil.sql =====
-- Foto de perfil (pedido de 07/10). Cada pessoa troca a própria; a gestão pode trocar a de qualquer um.
alter table funcionarios add column foto text;

insert into storage.buckets (id, name, public) values ('fotos', 'fotos', false);
create policy "ver fotos de perfil" on storage.objects for select using (bucket_id = 'fotos' and (eu()).id is not null);
create policy "enviar foto de perfil" on storage.objects for insert with check (
  bucket_id = 'fotos' and ((storage.foldername(name))[1] = (eu()).id::text or sou_gestao())
);

-- Funcionário não altera a própria linha em funcionarios; a foto passa por esta função.
create function definir_foto(alvo uuid, caminho text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if (eu()).id is null or alvo is null or (alvo <> (eu()).id and not sou_gestao()) then
    raise exception 'Sem permissão para trocar esta foto';
  end if;
  update funcionarios set foto = caminho where id = alvo;
end;
$$;

-- 0013
-- Fichas técnicas só para Gerente, Administrativo e Proprietário (pedido de 07/10).
drop policy "todos leem fichas" on lf_fichas;
create policy "gestao le fichas" on lf_fichas for select using (sou_gestao());

-- 0014
-- Vale-transporte no cadastro e salário do mês detalhado (pedido de 07/10).
-- A gestão lança os valores que a contabilidade manda; quando libera o mês, cada pessoa vê o seu.

alter table funcionarios add column opta_vt boolean not null default false;

create table salarios (
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  salario numeric(12, 2) not null default 0 check (salario >= 0),
  caixinha numeric(12, 2) not null default 0 check (caixinha >= 0),
  bonus_caixinha numeric(12, 2) not null default 0 check (bonus_caixinha >= 0),
  bonus_conclui numeric(12, 2) not null default 0 check (bonus_conclui >= 0),
  desc_faltas numeric(12, 2) not null default 0 check (desc_faltas >= 0),
  desc_atrasos numeric(12, 2) not null default 0 check (desc_atrasos >= 0),
  inss numeric(12, 2) not null default 0 check (inss >= 0),
  desc_vt numeric(12, 2) not null default 0 check (desc_vt >= 0),
  observacao text,
  liberado boolean not null default false,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default (eu()).id references funcionarios (id),
  primary key (funcionario_id, mes)
);

alter table salarios enable row level security;
create policy "gestao ve salarios, pessoa ve o seu liberado" on salarios for select
  using (sou_gestao() or (funcionario_id = (eu()).id and liberado));
create policy "gestao lanca salarios" on salarios for insert with check (sou_gestao());
create policy "gestao corrige salarios" on salarios for update using (sou_gestao()) with check (sou_gestao());
create policy "gestao apaga salarios" on salarios for delete using (sou_gestao());

-- 0015
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

-- 0016
-- Dois pagamentos por mês (pedido de 07/10): adiantamento no dia 20 e salário no dia 05 do mês seguinte.
-- "mes" é o mês de referência: o adiantamento de outubro sai em 20/10 e o salário de outubro em 05/11.

alter table salarios add column tipo text not null default 'salario' check (tipo in ('salario', 'adiantamento'));
alter table salarios add column desc_adiantamento numeric(12, 2) not null default 0 check (desc_adiantamento >= 0);
alter table salarios drop constraint salarios_pkey;
alter table salarios add primary key (funcionario_id, mes, tipo);

-- 0017
-- Férias por período aquisitivo, 13º, folga de feriado e advertência/suspensão com documento para imprimir (pedido de 07/10).
-- Os períodos (aquisitivo e concessivo) são calculados no app a partir da admissão; aqui ficam só os gozos.

create table ferias (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  aquisitivo_inicio date not null,
  inicio date not null,
  dias int not null check (dias between 1 and 30),
  abono_dias int not null default 0 check (abono_dias between 0 and 10),
  observacao text,
  registrado_por uuid default (eu()).id references funcionarios (id),
  criado_em timestamptz not null default now()
);
create index on ferias (funcionario_id);

alter table ferias enable row level security;
create policy "gestao ve ferias" on ferias for select using (sou_gestao());
create policy "gestao registra ferias" on ferias for insert with check (posso_alterar(funcionario_id));
create policy "gestao apaga ferias" on ferias for delete using (posso_alterar(funcionario_id));

alter type tipo_ocorrencia add value if not exists 'suspensao';
alter table ocorrencias add column natureza text;
alter table ocorrencias add column suspensao_inicio date;
alter table ocorrencias add column suspensao_dias int check (suspensao_dias between 1 and 30);

-- 13º salário: registro de cada parcela paga (a 1ª pode ser adiantada).
create table decimo_terceiro (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  ano int not null check (ano between 2020 and 2100),
  parcela int not null check (parcela in (1, 2)),
  valor numeric(12, 2) not null check (valor >= 0),
  pago_em date not null,
  observacao text,
  registrado_por uuid default (eu()).id references funcionarios (id),
  criado_em timestamptz not null default now(),
  unique (funcionario_id, ano, parcela)
);

alter table decimo_terceiro enable row level security;
create policy "gestao ve 13" on decimo_terceiro for select using (sou_gestao());
create policy "gestao registra 13" on decimo_terceiro for insert with check (posso_alterar(funcionario_id));
create policy "gestao apaga 13" on decimo_terceiro for delete using (posso_alterar(funcionario_id));

-- Folga normal ou folga de feriado (aparece com outra cor no calendário).
alter table folgas add column tipo text not null default 'normal' check (tipo in ('normal', 'feriado'));
create policy "gestao muda folga" on folgas for update using (sou_gestao()) with check (sou_gestao());

-- 0018
-- CPF e sexo no cadastro; tipo de documento para os termos de exame de gravidez no desligamento (pedido de 07/10).
alter table funcionarios add column cpf text check (cpf ~ '^\d{11}$');
create unique index funcionarios_cpf on funcionarios (cpf) where cpf is not null;
alter table funcionarios add column sexo text check (sexo in ('feminino', 'masculino'));
alter type tipo_documento add value if not exists 'termo_gravidez';

-- 0019
-- Data de nascimento (mensagem de aniversário), contrato de experiência e checklist de desligamento (pedido de 07/10).

alter table funcionarios add column data_nascimento date;
-- Contrato de experiência: dias do 1º e do 2º período, contados da admissão. Nulo = sem contrato de experiência.
-- Padrão da casa: 10 + 80 (90 dias no total), mas cada cadastro pode ter o seu.
alter table funcionarios add column experiencia_dias1 int check (experiencia_dias1 between 1 and 90);
alter table funcionarios add column experiencia_dias2 int check (experiencia_dias2 between 0 and 89);
alter table funcionarios add constraint experiencia_ate_90 check (coalesce(experiencia_dias1, 0) + coalesce(experiencia_dias2, 0) <= 90);

-- Checklist de desligamento: uma linha por desligamento; os itens marcados ficam em "itens" ({chave: {por, em}}).
create table desligamentos (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  data date not null,
  tipo text not null check (tipo in ('sem_justa_causa', 'justa_causa', 'pedido', 'acordo', 'fim_experiencia', 'antecipacao_experiencia')),
  itens jsonb not null default '{}',
  observacao text,
  concluido boolean not null default false,
  registrado_por uuid default (eu()).id references funcionarios (id),
  criado_em timestamptz not null default now()
);
create index on desligamentos (funcionario_id);

alter table desligamentos enable row level security;
create policy "gestao ve desligamentos" on desligamentos for select using (sou_gestao());
create policy "gestao abre desligamento" on desligamentos for insert with check (posso_alterar(funcionario_id));
create policy "gestao atualiza desligamento" on desligamentos for update using (posso_alterar(funcionario_id)) with check (posso_alterar(funcionario_id));
create policy "gestao apaga desligamento" on desligamentos for delete using (posso_alterar(funcionario_id));

-- 0020
-- Manutenção preventiva (itens com periodicidade) e cadastro de equipamentos com histórico (pedidos de 07/10).
-- Manutenção e gestão (atendo_chamados) veem e editam tudo; a lista de itens é preenchida pelo próprio portal.

create table equipamentos (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references unidades (id),
  nome text not null check (length(trim(nome)) > 0),
  marca_modelo text,
  numero_serie text,
  local text,
  data_compra date,
  valor_compra numeric(12, 2) check (valor_compra >= 0),
  valor_atual numeric(12, 2) check (valor_atual >= 0),
  foto text, -- caminho no bucket "chamados", pasta equipamentos/
  observacao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index on equipamentos (unidade_id);

-- Histórico de manutenções de cada equipamento (o que aconteceu, quem fez, quanto custou).
create table equipamento_manutencoes (
  id uuid primary key default gen_random_uuid(),
  equipamento_id uuid not null references equipamentos (id) on delete cascade,
  data date not null,
  tipo text not null check (tipo in ('corretiva', 'preventiva')),
  descricao text not null check (length(trim(descricao)) > 0),
  prestador text,
  custo numeric(12, 2) check (custo >= 0),
  chamado_id uuid references chamados (id) on delete set null,
  registrado_por uuid default (eu()).id references funcionarios (id),
  criado_em timestamptz not null default now()
);
create index on equipamento_manutencoes (equipamento_id);

-- Itens de manutenção preventiva: o que verificar e a cada quantos dias (ex.: limpar coifa a cada 90).
-- unidade_id nulo = vale para todas as lojas; equipamento_id opcional.
create table preventivas (
  id uuid primary key default gen_random_uuid(),
  unidade_id text references unidades (id),
  equipamento_id uuid references equipamentos (id) on delete set null,
  titulo text not null check (length(trim(titulo)) > 0),
  descricao text,
  frequencia_dias int not null check (frequencia_dias between 1 and 3650),
  -- Primeira vez que vence (se ainda não foi feita nenhuma vez).
  primeira_em date not null default current_date,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Cada vez que o item foi feito. O próximo vencimento = última execução + frequência.
create table preventiva_execucoes (
  id uuid primary key default gen_random_uuid(),
  preventiva_id uuid not null references preventivas (id) on delete cascade,
  unidade_id text references unidades (id), -- em qual loja foi feito (itens que valem para todas)
  feito_em date not null,
  observacao text,
  feito_por uuid default (eu()).id references funcionarios (id),
  criado_em timestamptz not null default now()
);
create index on preventiva_execucoes (preventiva_id);

alter table equipamentos enable row level security;
alter table equipamento_manutencoes enable row level security;
alter table preventivas enable row level security;
alter table preventiva_execucoes enable row level security;
create policy "manutencao ve equipamentos" on equipamentos for select using (atendo_chamados());
create policy "manutencao edita equipamentos" on equipamentos for all using (atendo_chamados()) with check (atendo_chamados());
create policy "manutencao ve historico" on equipamento_manutencoes for select using (atendo_chamados());
create policy "manutencao edita historico" on equipamento_manutencoes for all using (atendo_chamados()) with check (atendo_chamados());
create policy "manutencao ve preventivas" on preventivas for select using (atendo_chamados());
create policy "manutencao edita preventivas" on preventivas for all using (atendo_chamados()) with check (atendo_chamados());
create policy "manutencao ve execucoes" on preventiva_execucoes for select using (atendo_chamados());
create policy "manutencao edita execucoes" on preventiva_execucoes for all using (atendo_chamados()) with check (atendo_chamados());

-- 0021
-- Uniformes (pedido de 07/10): tamanhos no cadastro, pedido de troca feito pelo próprio funcionário
-- e pedidos de compra de uniformes por leva (para orçamento com o fornecedor).

alter table funcionarios add column tam_camiseta text check (tam_camiseta in ('PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG'));
alter table funcionarios add column tam_calca text check (tam_calca ~ '^\d{2}$');
alter table funcionarios add column tam_calcado int check (tam_calcado between 30 and 50);

-- Pedido de troca: a pessoa diz o que precisa, por quê, e pode mandar foto. Vai para a gestão.
create table uniforme_solicitacoes (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  itens text[] not null check (cardinality(itens) > 0),
  motivo text not null check (length(trim(motivo)) > 0),
  foto text, -- caminho no bucket "fotos", na pasta da pessoa
  status text not null default 'aberta' check (status in ('aberta', 'atendida', 'recusada')),
  resposta text,
  respondido_por uuid references funcionarios (id),
  respondido_em timestamptz,
  criado_em timestamptz not null default now()
);
create index on uniforme_solicitacoes (funcionario_id);

alter table uniforme_solicitacoes enable row level security;
create policy "ver pedidos de troca" on uniforme_solicitacoes for select using (funcionario_id = (eu()).id or sou_gestao());
create policy "pedir troca" on uniforme_solicitacoes for insert with check (funcionario_id = (eu()).id and status = 'aberta');
create policy "gestao responde troca" on uniforme_solicitacoes for update using (sou_gestao()) with check (sou_gestao());

-- Pedido de compra de uniformes, organizado por leva.
create table uniforme_pedidos (
  id uuid primary key default gen_random_uuid(),
  numero int generated always as identity,
  titulo text not null check (length(trim(titulo)) > 0),
  status text not null default 'rascunho' check (status in ('rascunho', 'orcamento', 'pedido', 'recebido')),
  fornecedor text,
  observacao text,
  criado_por uuid default (eu()).id references funcionarios (id),
  criado_em timestamptz not null default now()
);

-- Cada linha: uma peça para uma pessoa (cor e modelagem definidas na hora, a partir do nível e do sexo).
create table uniforme_pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references uniforme_pedidos (id) on delete cascade,
  funcionario_id uuid references funcionarios (id) on delete set null,
  item text not null,
  cor text,
  modelagem text check (modelagem in ('feminina', 'masculina', 'unissex')),
  tamanho text,
  quantidade int not null check (quantidade between 1 and 99)
);
create index on uniforme_pedido_itens (pedido_id);

alter table uniforme_pedidos enable row level security;
alter table uniforme_pedido_itens enable row level security;
create policy "gestao ve pedidos de uniforme" on uniforme_pedidos for select using (sou_gestao());
create policy "gestao edita pedidos de uniforme" on uniforme_pedidos for all using (sou_gestao()) with check (sou_gestao());
create policy "gestao ve itens do pedido" on uniforme_pedido_itens for select using (sou_gestao());
create policy "gestao edita itens do pedido" on uniforme_pedido_itens for all using (sou_gestao()) with check (sou_gestao());

-- 0022
-- Avisos com público escolhido (loja, setores ou pessoas) e holerite da contabilidade anexado ao salário (pedidos de 07/10).

-- Público do aviso: unidade (já existia), setores e pessoas. Nulo = sem filtro.
-- Com pessoas escolhidas, só elas veem (além da gestão).
alter table comunicados add column setores text[];
alter table comunicados add column destinatarios uuid[];

drop policy "ver comunicados" on comunicados;
create policy "ver comunicados" on comunicados for select using (
  sou_gestao()
  or autor_id = (eu()).id
  or case
    when destinatarios is not null then (eu()).id = any (destinatarios)
    else (unidade_id is null or unidade_id = (eu()).unidade_id)
      and (setores is null or (eu()).setor::text = any (setores))
  end
);

-- Holerite (PDF da contabilidade) de cada pagamento. A pessoa baixa o seu quando o mês é liberado.
alter table salarios add column holerite text; -- caminho no bucket "holerites": <funcionario_id>/<mes>-<tipo>.pdf
-- Rubricas do holerite que não têm campo próprio (adicional noturno, auxílio uniforme, consignado…),
-- somadas para o total bater com o líquido do holerite. "rubricas" guarda o detalhe para a pessoa ver.
alter table salarios
  add column outros_creditos numeric(12, 2) not null default 0 check (outros_creditos >= 0),
  add column outros_descontos numeric(12, 2) not null default 0 check (outros_descontos >= 0),
  add column rubricas jsonb;

insert into storage.buckets (id, name, public) values ('holerites', 'holerites', false);
create policy "gestao envia holerites" on storage.objects for insert with check (bucket_id = 'holerites' and sou_gestao());
create policy "gestao troca holerites" on storage.objects for update using (bucket_id = 'holerites' and sou_gestao());
create policy "ver holerites" on storage.objects for select using (
  bucket_id = 'holerites'
  and (
    sou_gestao()
    or exists (select 1 from salarios s where s.holerite = name and s.funcionario_id = (eu()).id and s.liberado)
  )
);

-- Readmissão: quem sai e volta mantém o histórico. Cada período encerrado fica aqui;
-- o cadastro (funcionarios.data_admissao) passa a ser o da volta.
create table vinculos_anteriores (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  admissao date not null,
  desligamento date not null,
  tipo_desligamento text,
  cargo text,
  observacao text,
  registrado_por uuid default (eu()).id references funcionarios (id),
  criado_em timestamptz not null default now()
);
create index on vinculos_anteriores (funcionario_id);
alter table vinculos_anteriores enable row level security;
create policy "gestao ve vinculos" on vinculos_anteriores for select using (sou_gestao());
create policy "gestao registra vinculo" on vinculos_anteriores for insert with check (posso_alterar(funcionario_id));
create policy "gestao apaga vinculo" on vinculos_anteriores for delete using (posso_alterar(funcionario_id));

-- Pedido de uniformes: valor fechado com o fornecedor, data do fechamento e previsão de entrega.
alter table uniforme_pedidos add column valor_total numeric(12, 2) check (valor_total >= 0);
alter table uniforme_pedidos add column fechado_em date;
alter table uniforme_pedidos add column previsao_entrega date;

-- 0023
-- Pagamento pelo banco (pedido de 07/10): o portal gera o arquivo do Itaú (SISPAG, Pix em lote) com os
-- salários do dia 05/20 e as diárias de freelancer da semana. Guarda a conta que paga e o que já foi gerado,
-- para não repetir lote e para, quando a API do Itaú estiver liberada, enviar os mesmos pagamentos por lá.

-- Conta da empresa que paga. Uma linha por conta; "padrao" é a que vem escolhida.
create table contas_pagamento (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0), -- como a gestão chama ("Itaú matriz")
  banco text not null default '341' check (banco ~ '^\d{3}$'),
  empresa_cnpj text not null check (empresa_cnpj ~ '^\d{14}$'),
  empresa_nome text not null check (length(trim(empresa_nome)) > 0),
  agencia text not null check (agencia ~ '^\d{1,5}$'),
  conta text not null check (conta ~ '^\d{1,12}$'),
  dac text not null check (dac ~ '^\d$'), -- dígito da agência/conta
  endereco text,
  numero text,
  cidade text,
  cep text check (cep is null or cep ~ '^\d{8}$'),
  estado text check (estado is null or estado ~ '^[A-Z]{2}$'),
  padrao boolean not null default false,
  criado_em timestamptz not null default now()
);
create unique index on contas_pagamento (padrao) where padrao;

grant all on contas_pagamento to authenticated;
alter table contas_pagamento enable row level security;
create policy "gestao ve contas" on contas_pagamento for select using (sou_gestao());
create policy "gestao mantem contas" on contas_pagamento for all using (sou_gestao()) with check (sou_gestao());

-- Cada arquivo (ou envio por API) gerado, para conferência e para numerar os lotes sem repetir.
create table remessas_pagamento (
  id uuid primary key default gen_random_uuid(),
  numero int generated always as identity, -- nosso número do arquivo
  conta_id uuid not null references contas_pagamento (id),
  tipo text not null check (tipo in ('salario', 'adiantamento', 'freelancer')),
  referencia text not null, -- mês (AAAA-MM) do salário, ou a semana (AAAA-MM-DD da segunda) das diárias
  data_pagamento date not null,
  quantidade int not null check (quantidade > 0),
  valor_total numeric(14, 2) not null check (valor_total > 0),
  via text not null default 'arquivo' check (via in ('arquivo', 'api')),
  arquivo text, -- nome do arquivo gerado, para a gestão achar no computador
  gerado_por uuid references funcionarios (id),
  criado_em timestamptz not null default now()
);
create index on remessas_pagamento (tipo, referencia);

grant all on remessas_pagamento to authenticated;
alter table remessas_pagamento enable row level security;
create policy "gestao ve remessas" on remessas_pagamento for select using (sou_gestao());
create policy "gestao registra remessas" on remessas_pagamento for insert with check (sou_gestao());
create policy "gestao apaga remessas" on remessas_pagamento for delete using (sou_gestao());

-- Setor Pizzaria (pedido de 07/10).
alter type setor_trabalho add value if not exists 'pizzaria';

-- 0024
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

-- Excluir cadastro de freelancer (pedido de 08/10, para tirar os de teste). Leva junto as diárias e os envios
-- dele; não deixa excluir quem já tem pagamento marcado, para não sumir com o histórico do que foi pago.
create function freela_excluir(p_freelancer uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not sou_gestao() then raise exception 'Só a gestão exclui cadastro de freelancer.'; end if;
  if exists (select 1 from freela_pagamentos where freelancer_id = p_freelancer) then
    raise exception 'Esse freelancer já tem pagamento marcado. Desmarque os pagamentos ou deixe o cadastro inativo.';
  end if;
  delete from freela_envios where freelancer_id = p_freelancer;
  delete from freela_diarias where freelancer_id = p_freelancer;
  delete from freelancers where id = p_freelancer;
end $$;
grant execute on function freela_excluir(uuid) to authenticated;

-- 0025
-- Nomes sempre com a inicial maiúscula (pedido de 08/10): "MARIA DA silva" vira "Maria da Silva".
-- Preposições do meio (da, de, do, das, dos, e) ficam minúsculas. Vale para quem já está cadastrado
-- e para tudo que entrar depois, por qualquer tela.

create or replace function nome_proprio(n text) returns text
language plpgsql immutable as $$
declare
  partes text[] := regexp_split_to_array(lower(trim(regexp_replace(n, '\s+', ' ', 'g'))), ' ');
  saida text[] := '{}';
  p text;
  i int := 0;
begin
  if n is null then return null; end if;
  foreach p in array partes loop
    i := i + 1;
    if i > 1 and p in ('da', 'das', 'de', 'di', 'do', 'dos', 'du', 'e') then
      saida := saida || p;
    else
      saida := saida || initcap(p); -- também acerta nome com hífen ou apóstrofo (Ana-Clara, D'Ávila)
    end if;
  end loop;
  return array_to_string(saida, ' ');
end $$;

create or replace function acerta_nome() returns trigger
language plpgsql as $$
begin
  new.nome := nome_proprio(new.nome);
  return new;
end $$;

create trigger nome_com_maiuscula before insert or update of nome on funcionarios
  for each row execute function acerta_nome();
create trigger nome_com_maiuscula before insert or update of nome on freelancers
  for each row execute function acerta_nome();
create trigger nome_com_maiuscula before insert or update of nome on freela_envios
  for each row execute function acerta_nome();

-- Acerta quem já está cadastrado.
update funcionarios set nome = nome where nome is distinct from nome_proprio(nome);
update freelancers set nome = nome where nome is distinct from nome_proprio(nome);
update freela_envios set nome = nome where nome is distinct from nome_proprio(nome);

-- 0026
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

-- 0027
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

-- 0028
alter table funcionarios add column if not exists rg text;
alter table funcionarios add column if not exists ctps text;
alter table funcionarios add column if not exists endereco text;

-- 0029
-- 0029 (reunião de RH de 08/10): tabela de descontos de uniforme, conferência da devolução no desligamento
-- e pedido de ajuste do ponto pelo portal (antes era pelo WhatsApp do escritório).

-- Valor de cada peça, descontado se não for devolvida.
create table uniforme_valores (
  item text primary key,
  valor numeric(10,2) not null check (valor >= 0),
  atualizado_em timestamptz not null default now()
);
alter table uniforme_valores enable row level security;
create policy "ver valores de uniforme" on uniforme_valores for select using ((eu()).id is not null);
create policy "gestao muda valores" on uniforme_valores for all using (sou_gestao()) with check (sou_gestao());

-- Conferência do que voltou: cada linha tem o que foi entregue, o que voltou e o valor da peça.
create table uniforme_devolucoes (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  data date not null,
  itens jsonb not null,                 -- [{ item, tamanho, entregue, devolvido, valor }]
  total_desconto numeric(10,2) not null default 0 check (total_desconto >= 0),
  observacao text,
  conferido_por uuid not null references funcionarios (id),
  criado_em timestamptz not null default now()
);
create index on uniforme_devolucoes (funcionario_id);
alter table uniforme_devolucoes enable row level security;
create policy "ver devolucoes" on uniforme_devolucoes for select using (funcionario_id = (eu()).id or sou_gestao());
create policy "gestao confere devolucao" on uniforme_devolucoes for insert with check (sou_gestao() and conferido_por = (eu()).id);
create policy "gestao apaga devolucao" on uniforme_devolucoes for delete using (sou_gestao());

-- Pedido de ajuste do ponto: a pessoa pede, o escritório ajusta no Control iD e marca como feito.
create table ponto_ajustes (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  data date not null,
  tipo text not null check (tipo in ('esqueci_entrada', 'esqueci_saida', 'horario_errado', 'equipamento', 'outro')),
  horario text check (horario is null or horario ~ '^\d{2}:\d{2}$'),
  motivo text check (char_length(motivo) <= 500),
  status text not null default 'pendente' check (status in ('pendente', 'feito', 'recusado')),
  resposta text,
  criado_em timestamptz not null default now(),
  resolvido_por uuid references funcionarios (id),
  resolvido_em timestamptz
);
create index on ponto_ajustes (status, criado_em);
create index on ponto_ajustes (funcionario_id);
alter table ponto_ajustes enable row level security;
create policy "ver ajustes de ponto" on ponto_ajustes for select using (funcionario_id = (eu()).id or sou_gestao());
create policy "pedir ajuste de ponto" on ponto_ajustes for insert
  with check (funcionario_id = (eu()).id and status = 'pendente' and resolvido_por is null and data <= current_date);
create policy "gestao resolve ajuste" on ponto_ajustes for update using (sou_gestao()) with check (sou_gestao());
create policy "apagar pedido pendente" on ponto_ajustes for delete using (funcionario_id = (eu()).id and status = 'pendente');
