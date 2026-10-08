-- Local das lojas para a presença dos freelas. Rodar DEPOIS da migration-0026.
-- Vila Anastácio e Pizza ficam no mesmo endereço (R. Fortunato Ferraz, 768), passado pelo Heitor em 08/10.
update unidades set latitude = -23.5174364, longitude = -46.7198938 where id in ('burger-va', 'pizza');
-- Parque São Domingos (R. Brig. Henrique Fontenelle, 601).
update unidades set latitude = -23.5022234, longitude = -46.7391611 where id = 'burger-psd';
select id, latitude, longitude from unidades order by id;
