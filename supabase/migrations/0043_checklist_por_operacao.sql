-- Checklist do evento por operação (Heitor, 09/10): cada item fixo pertence a uma operação (The Ozzy Pizza, Foca…)
-- e a separação do evento só puxa os itens das operações que vão para aquele evento. Item sem operação vai sempre.
-- A praça (Foca, Pizza, Romana…) continua como detalhe. Só acrescenta: nada do que já existe é apagado.

insert into operacoes (id, nome) values ('foca', 'Foca') on conflict (id) do nothing;

alter table checklist_evento_modelo add column operacao_id text references operacoes (id);

-- Itens que já existem: a praça diz a operação.
update checklist_evento_modelo set operacao_id = 'pizza' where operacao_id is null and lower(operacao) in ('pizza', 'romana');
update checklist_evento_modelo set operacao_id = 'foca' where operacao_id is null and lower(operacao) = 'foca';
