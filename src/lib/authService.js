import { supabase } from "./supabase";

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw error;
}

export async function sendPasswordReset(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) throw error;
  return data;
}

export async function updateUserPassword(password) {
  const { data, error } = await supabase.auth.updateUser({ password });

  if (error) throw error;
  return data;
}

// Vínculo ativo do usuário com uma empresa ativa, incluindo os dados da empresa.
// Mesma regra de current_company_id() no banco: prefere vínculo de admin,
// depois o mais antigo. Retorna null se não houver vínculo ativo.
export async function getMembership(userId) {
  const { data, error } = await supabase
    .from("company_members")
    .select(
      "company_id, role, criado_em, companies!inner(id, nome, slug, ativo, telefone, endereco, bairro, cnpj, logo_url)",
    )
    .eq("user_id", userId)
    .eq("ativo", true)
    .eq("companies.ativo", true);

  if (error) throw error;
  if (!data?.length) return null;

  data.sort(
    (a, b) =>
      (a.role === "admin" ? 0 : 1) - (b.role === "admin" ? 0 : 1) ||
      new Date(a.criado_em) - new Date(b.criado_em),
  );
  return data[0];
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, nome, role, ativo, criado_em, atualizado_em")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}
