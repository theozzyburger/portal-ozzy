# Portal do Funcionário The Ozzy

Primeira versão (MVP) do portal interno da The Ozzy Burger e The Ozzy Pizza: cadastro de funcionários, documentos e atestados, ocorrências, avisos com confirmação de leitura, folgas da semana e organograma.

## Níveis de acesso

| Nível | O que vê | O que faz |
| --- | --- | --- |
| Funcionário | Os próprios dados, documentos, ocorrências e folgas; avisos da sua unidade | Envia os próprios atestados e documentos; confirma leitura de avisos |
| Supervisor | Equipe da própria unidade (sem documentos/atestados) | Só visualiza |
| Gerente, Administrativo, Proprietário | Tudo, todas as unidades | Cadastra, edita, desliga, registra ocorrências, publica avisos, marca folgas |

As regras valem no banco de dados (Row Level Security em `supabase/migrations`), não só nas telas.

## Rodar no computador

```bash
npm install
npm run dev
```

Sem as variáveis do Supabase, o portal abre em **modo demonstração** com dados de exemplo (senha `1234` para qualquer celular da lista).

## Colocar no ar com dados reais

1. Criar um projeto no [Supabase](https://supabase.com) (plano gratuito).
2. No SQL Editor, rodar `supabase/migrations/0001_portal_funcionario.sql`.
3. Em Authentication > Sign In / Providers, desligar "Allow new users to sign up" (só a gestão cria acessos).
4. Publicar a função `supabase/functions/criar-acesso` (`supabase functions deploy criar-acesso`).
5. Cadastrar o primeiro Proprietário direto na tabela `funcionarios` e criar o login dele em Authentication > Users com o e-mail `<celular só com números>@portal.theozzy`; depois copiar o id do usuário para `funcionarios.auth_user_id`.
6. Na [Vercel](https://vercel.com), importar este repositório e preencher `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (Settings > API do Supabase).

A partir daí, todo cadastro de funcionário feito pelo portal já cria o login (celular + senha inicial).

## Estrutura

- `src/lib/store.ts`: tudo que as telas pedem ao banco; `demoStore.ts` (exemplo) e `supabaseStore.ts` (real).
- `src/lib/permissoes.ts`: quem pode o quê, espelhando as regras do banco.
- `src/pages/`: Início, Avisos, Folgas, Equipe e Perfil.
- `npm run build:preview` gera um HTML único em modo demonstração, usado na prévia.
