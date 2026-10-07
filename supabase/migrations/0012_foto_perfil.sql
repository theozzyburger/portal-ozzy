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
