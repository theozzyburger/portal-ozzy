-- Razão social x nome fantasia (Heitor, 09/10: "Pama entrou como Gaivota"). O fornecedor guarda as duas;
-- o extrato e a nota costumam trazer a razão social, a gente chama pelo nome fantasia.
alter table fornecedores add column razao_social text;

-- A nota fiscal ensina a razão social: o emitente da NF-e é a razão social do fornecedor ligado a ela.
update fornecedores f set razao_social = x.emitente_nome
from (select distinct on (fornecedor_id) fornecedor_id, emitente_nome from notas_fiscais
      where fornecedor_id is not null and coalesce(trim(emitente_nome), '') <> '' order by fornecedor_id, emissao desc) x
where f.id = x.fornecedor_id and f.razao_social is null and lower(f.nome) <> lower(x.emitente_nome);

create function nota_ensina_razao_social() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.fornecedor_id is not null and coalesce(trim(new.emitente_nome), '') <> '' then
    update fornecedores set razao_social = new.emitente_nome
    where id = new.fornecedor_id and razao_social is null and lower(nome) <> lower(new.emitente_nome);
  end if;
  return new;
end $$;
create trigger nota_ensina_razao_social after insert or update of fornecedor_id on notas_fiscais
  for each row execute function nota_ensina_razao_social();
