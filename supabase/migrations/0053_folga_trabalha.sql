-- Folgas do turno (Heitor, 09/10): o dia sem horário no turno (ex.: segunda) já aparece como folga sozinho.
-- 'trabalha' marca a exceção: a pessoa vem trabalhar num dia em que o turno dela é fechado.
alter table folgas drop constraint folgas_tipo_check;
alter table folgas add constraint folgas_tipo_check check (tipo in ('normal', 'feriado', 'trabalha'));
