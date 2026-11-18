// ============================================================
// Edge Function: convidar-membro — Peso Certo
//
// O ADMIN de uma empresa convida alguém para a equipe:
//   * e-mail novo     -> envia convite do Supabase (a pessoa cria a senha)
//   * e-mail que já existe sem empresa -> só vincula à empresa
//   * já na equipe (ativo)             -> erro claro
//   * desativado nesta empresa         -> reativa com o papel escolhido
//   * ativo em OUTRA empresa           -> erro (o app usa 1 empresa por usuário)
//
// Precisa da chave secreta (criar usuário), por isso roda no servidor.
// Usa a chave nova "secret" (SUPABASE_SECRET_KEYS, formato sb_secret_...) e,
// se o projeto ainda não tiver chaves novas, a antiga SUPABASE_SERVICE_ROLE_KEY.
// Ambas já vêm configuradas automaticamente nas Edge Functions do Supabase.
//
// Publicar: painel > Edge Functions > Deploy a new function > Via Editor,
// nome "convidar-membro", colar este arquivo. Ou: supabase functions deploy convidar-membro
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
type Cliente = any;

export interface Dependencias {
  // cliente com a chave secreta: identifica quem chamou (pelo token da
  // sessão), envia o convite e grava o vínculo
  clienteAdmin: () => Cliente;
}

export async function tratar(req: Request, deps: Dependencias) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ erro: "Método não permitido." }, 405);

  try {
    // 1. Quem está chamando? (token da sessão do usuário logado)
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return resposta({ erro: "Sessão expirada. Entre novamente." }, 401);
    const admin = deps.clienteAdmin();
    const {
      data: { user },
      error: erroUsuario,
    } = await admin.auth.getUser(token);
    if (erroUsuario || !user) return resposta({ erro: "Sessão expirada. Entre novamente." }, 401);

    // 2. Dados do convite
    let corpo: Record<string, unknown>;
    try {
      corpo = await req.json();
    } catch {
      return resposta({ erro: "Requisição inválida." }, 400);
    }
    const email = String(corpo.email ?? "").trim().toLowerCase();
    const nome = String(corpo.nome ?? "").trim().slice(0, 80);
    const role = String(corpo.role ?? "operator");
    const companyId = String(corpo.company_id ?? "");
    const redirectTo = typeof corpo.redirect_to === "string" ? corpo.redirect_to : undefined;

    if (!EMAIL_RE.test(email)) return resposta({ erro: "E-mail inválido." }, 400);
    if (!["admin", "operator"].includes(role)) return resposta({ erro: "Papel inválido." }, 400);
    if (!UUID_RE.test(companyId)) return resposta({ erro: "Empresa inválida." }, 400);

    // 3. Quem chama é admin ativo desta empresa (ativa)?
    const { data: souAdmin, error: erroAdmin } = await admin
      .from("company_members")
      .select("id, companies!inner(ativo)")
      .eq("company_id", companyId)
      .eq("user_id", user.id)
      .eq("role", "admin")
      .eq("ativo", true)
      .eq("companies.ativo", true)
      .maybeSingle();
    if (erroAdmin) throw erroAdmin;
    if (!souAdmin) {
      return resposta({ erro: "Apenas o administrador da empresa pode convidar." }, 403);
    }

    // 4. O e-mail já tem conta?
    const { data: perfil, error: erroPerfil } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (erroPerfil) throw erroPerfil;

    let userId: string;
    let convidado = false;

    if (perfil) {
      userId = perfil.id;

      // Já está ativo em outra empresa?
      const { data: outra, error: erroOutra } = await admin
        .from("company_members")
        .select("id")
        .eq("user_id", userId)
        .eq("ativo", true)
        .neq("company_id", companyId)
        .limit(1);
      if (erroOutra) throw erroOutra;
      if (outra?.length) {
        return resposta(
          { erro: "Este e-mail já está em uso em outra empresa. Use outro e-mail." },
          409,
        );
      }
    } else {
      const { data: convite, error: erroConvite } =
        await admin.auth.admin.inviteUserByEmail(email, {
          data: { nome: nome || undefined },
          redirectTo,
        });
      if (erroConvite) {
        return resposta(
          { erro: "Não foi possível enviar o convite: " + erroConvite.message },
          400,
        );
      }
      userId = convite.user.id;
      convidado = true;
    }

    // 5. Vínculo com a empresa
    const { data: vinculo, error: erroVinculo } = await admin
      .from("company_members")
      .select("id, ativo")
      .eq("company_id", companyId)
      .eq("user_id", userId)
      .maybeSingle();
    if (erroVinculo) throw erroVinculo;

    if (vinculo?.ativo) {
      return resposta({ erro: "Esta pessoa já faz parte da equipe." }, 409);
    }

    const gravacao = vinculo
      ? admin.from("company_members").update({ ativo: true, role }).eq("id", vinculo.id)
      : admin.from("company_members").insert({ company_id: companyId, user_id: userId, role, ativo: true });
    const { error: erroGravar } = await gravacao;
    if (erroGravar) throw erroGravar;

    // Nome informado pelo admin vira o nome do perfil, se ainda não houver
    if (nome && !convidado) {
      await admin.from("profiles").update({ nome }).eq("id", userId).is("nome", null);
    }

    return resposta({ ok: true, convidado, reativado: Boolean(vinculo), user_id: userId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e);
    return resposta({ erro: "Erro inesperado ao convidar: " + msg }, 500);
  }
}

// Chave secreta: nova (SUPABASE_SECRET_KEYS = {"default": "sb_secret_..."})
// com fallback para a antiga (SUPABASE_SERVICE_ROLE_KEY).
export function chaveSecreta(env: (nome: string) => string | undefined): string {
  try {
    const chaves = JSON.parse(env("SUPABASE_SECRET_KEYS") ?? "{}");
    const nova = chaves.default ?? Object.values(chaves)[0];
    if (typeof nova === "string" && nova) return nova;
  } catch {
    /* variável ausente ou fora do formato: tenta a antiga */
  }
  return env("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SECRET_KEY = chaveSecreta((n) => Deno.env.get(n));

Deno.serve((req) => {
  if (!SUPABASE_URL || !SECRET_KEY) {
    return resposta(
      { erro: "Função sem chave secreta do Supabase configurada (SUPABASE_SECRET_KEYS / SUPABASE_SERVICE_ROLE_KEY)." },
      500,
    );
  }
  return tratar(req, {
    clienteAdmin: () =>
      createClient(SUPABASE_URL, SECRET_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
  });
});
