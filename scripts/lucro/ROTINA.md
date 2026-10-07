# Cópia diária do Lucro Fácil para o portal

Roda como rotina agendada do Claude (todo dia de madrugada), com o conector do Lucro Fácil.
Só LEITURA no Lucro Fácil: nunca chamar ferramentas que criam, alteram ou apagam.

1. Clone `https://github.com/theozzyburger/portal-ozzy` (se ainda não estiver no ambiente) e crie uma pasta de trabalho vazia, ex. `/tmp/lucro`.
2. Resultado do mês: `get-financial-summary` para as empresas 410, 411 e 412, mês atual (AAAA-MM, fuso de São Paulo).
   Nos dias 1 a 5 do mês, também o mês anterior (fecha os números).
   Salve cada resposta como veio em `/tmp/lucro/resultado-<empresa>-<AAAA-MM>.json`.
3. Fichas técnicas (só às segundas-feiras; nos outros dias pule este passo):
   - `get-abc-curve` com dimension=products, últimos 60 dias, limit=100, para 410, 411 e 412.
     Salve em `/tmp/lucro/abc-<empresa>.json` (chaves items com id, name, quantity, revenue, is_unmapped).
   - Para cada id numérico vendido (is_unmapped=false), `get-product-recipe` (com company_id de uma loja que vendeu).
     Para cada item da ficha com ingredient_source=product, busque também a ficha desse produto (preparos).
     Salve cada resposta como veio em `/tmp/lucro/receitas/<id>.json`. Copie números exatamente.
     São muitas chamadas: divida entre subagentes, cada um gravando seus arquivos.
   - Sem fichas no arquivo, a importação mantém as que já estão no banco.
4. `node scripts/lucro/montar.mjs /tmp/lucro lucro.json`
5. Publique só o `lucro.json` no branch `dados-lucro`, num commit único (branch órfão, push forçado),
   para não acumular histórico de dados financeiros. Depois rode a importação:
   `gh workflow run importar-lucro.yml -R theozzyburger/portal-ozzy --ref main`
   (o workflow fica no main e lê o arquivo do branch `dados-lucro`).
6. Confira em Actions se a importação ficou verde. Se algo falhar, diga o que falhou no resumo final.
