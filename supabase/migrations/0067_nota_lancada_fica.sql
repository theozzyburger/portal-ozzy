-- Revisão (10/10): a regra da gestão nas notas valia para tudo, inclusive apagar uma nota já lançada, o que levava
-- junto (em cascata) as entradas no estoque e as contas a pagar, mesmo pagas. Só nota "a conferir" pode ser apagada;
-- a lançada se desfaz pelo "Desfazer lançamento".
create policy "so apaga nota a conferir" on notas_fiscais as restrictive for delete using (status = 'conferir');
