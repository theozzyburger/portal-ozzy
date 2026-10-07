-- Fichas técnicas só para Gerente, Administrativo e Proprietário (pedido de 07/10).
drop policy "todos leem fichas" on lf_fichas;
create policy "gestao le fichas" on lf_fichas for select using (sou_gestao());
