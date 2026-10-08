-- Local das lojas para a presença dos freelas (antes era o setup/local-das-lojas.sql, rodado à mão em 08/10).
-- Virou migration para o ambiente de testes nascer igual ao real. Rodar de novo não muda nada.
update unidades set latitude = -23.5174364, longitude = -46.7198938 where id in ('burger-va', 'pizza');
update unidades set latitude = -23.5022234, longitude = -46.7391611 where id = 'burger-psd';
