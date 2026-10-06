// Cria (ou redefine) o login de um funcionário: celular + senha inicial.
// Roda no Supabase com a chave de serviço, que nunca vai para o navegador.
// Só Gerente, Administrativo e Proprietário podem chamar.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
}

const emailDoCelular = (celular: string) => `${celular.replace(/\D/g, '')}@portal.theozzy`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  const url = Deno.env.get('SUPABASE_URL')!
  const quemChama = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: gestao } = await quemChama.rpc('sou_gestao')
  if (!gestao) return json({ erro: 'Sem permissão.' }, 403)

  const { funcionarioId, senha } = await req.json()
  if (!funcionarioId || typeof senha !== 'string' || senha.length < 6) {
    return json({ erro: 'Informe o funcionário e uma senha com pelo menos 6 caracteres.' }, 400)
  }

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: func, error } = await admin.from('funcionarios').select('id, celular, auth_user_id').eq('id', funcionarioId).single()
  if (error || !func) return json({ erro: 'Funcionário não encontrado.' }, 404)

  if (func.auth_user_id) {
    const { error: e } = await admin.auth.admin.updateUserById(func.auth_user_id, { password: senha, email: emailDoCelular(func.celular) })
    if (e) return json({ erro: e.message }, 400)
    return json({ ok: true })
  }

  const { data: criado, error: e } = await admin.auth.admin.createUser({
    email: emailDoCelular(func.celular),
    password: senha,
    email_confirm: true,
  })
  if (e || !criado.user) return json({ erro: e?.message ?? 'Falha ao criar acesso.' }, 400)
  await admin.from('funcionarios').update({ auth_user_id: criado.user.id }).eq('id', func.id)
  return json({ ok: true })
})
