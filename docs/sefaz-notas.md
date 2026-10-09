# Puxar as notas de compra direto da Sefaz (pesquisa de 09/10/2026)

## Dá para fazer?
Sim. A Receita tem um serviço oficial chamado **Distribuição de DF-e** (NFeDistribuicaoDFe, Ambiente Nacional, Nota Técnica 2014.002). Com o certificado digital da empresa, ele devolve todas as NF-e emitidas contra o CNPJ, sem depender do fornecedor mandar o XML.

## Como funciona
1. O portal consulta a Sefaz com o certificado e recebe um **resumo** de cada nota nova (fornecedor, valor, data, chave).
2. Para baixar o **XML completo**, a empresa precisa dar "Ciência da Operação" na nota (manifestação do destinatário). Isso só diz que a nota existe, não confirma o recebimento da mercadoria.
3. Depois da ciência, a próxima consulta traz o XML inteiro. Daí ele entra no portal igual ao XML importado hoje (itens, estoque, boletos).
4. Também dá para registrar "Confirmação da Operação" quando a mercadoria chegar, ou "Operação não Realizada"/"Desconhecimento" quando a nota não é nossa. Isso protege contra nota fria no nosso CNPJ.

## Regras da Sefaz que precisam ser respeitadas
- Quando não há nota nova (código 137), só pode consultar de novo depois de **1 hora**. Consultar demais gera bloqueio (código 656).
- As notas ficam disponíveis por cerca de **90 dias**. Para trás disso, só com o XML do fornecedor.
- É uma consulta por CNPJ. **UN1 e UN2 são matriz e filial** (mesmo CNPJ base; a consulta pode ser feita pela raiz, a confirmar com o certificado). **The Ozzy Pizza tem CNPJ próprio**, então precisa do certificado dela (ou procuração eletrônica).

## O que precisa
- **Certificado A1** (arquivo .pfx com senha). O A3 (token/cartão) não serve para rodar sozinho no servidor.
- Um serviço no servidor que fale com a Sefaz usando o certificado. Duas opções:
  - **Próprio**: uma função no Supabase (edge function) com o certificado guardado nos segredos do Supabase, rodando de hora em hora. Custo zero, mais trabalho de construção. O certificado e a senha são colocados por você direto no Supabase, nunca no chat.
  - **Serviço pronto** (Focus NFe, NFe.io, Qive/Arquivei e outros): eles guardam o certificado, fazem a consulta e a manifestação e o portal só busca o XML pela API deles. Mais rápido de ligar, tem mensalidade.

## Recomendação
Agora: importar os XMLs (já está no portal). Depois que o fluxo de notas, estoque e contas a pagar estiver rodando no dia a dia, ligar a busca automática. Para começar, preciso saber se a empresa tem certificado A1 (ou se prefere um serviço pronto).

## Fontes
- Nota Técnica 2014.002 (NFeDistribuicaoDFe), v1.40: https://www.reformatributaria.com (cópia do documento oficial do Portal da NF-e)
- NFe.io, fluxos e periodicidade da distribuição: https://nfe.io/docs/documentacao/distribuicao/distribuicao-fluxos-de-processamento/ e https://nfe.io/docs/documentacao/distribuicao/distribuicao-processamento-e-periodicidade/
- NFe.io, perguntas frequentes: https://nfe.io/docs/documentacao/distribuicao/distribuicao-nfe-cte-faq/
- Oobj, guia da distribuição e manifestação: https://oobj.com.br/bc/guia-do-oobj-distribuicao-mde/
- Focus NFe, manifestação do destinatário: https://focusnfe.com.br/produtos/manifestacao-destinatario-mde/
