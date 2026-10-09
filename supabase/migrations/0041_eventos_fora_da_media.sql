-- Eventos fora da média (Heitor, 09/10): a gestão escolhe quais eventos entram nas médias do painel e na
-- sugestão da previsão. Marcado = fica fora por padrão (dá para incluir de novo na hora). Só acrescenta a coluna.
alter table eventos add column fora_da_media boolean not null default false;
