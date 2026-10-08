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
