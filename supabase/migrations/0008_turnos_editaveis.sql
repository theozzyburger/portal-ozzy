-- Turnos editáveis pelo portal: a gestão já podia criar e alterar; agora também apaga.
-- Quem estava no turno apagado fica sem turno (funcionarios.turno_id usa "on delete set null").
create policy "gestao apaga turnos" on turnos for delete using (sou_gestao());
