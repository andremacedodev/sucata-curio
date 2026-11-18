import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltam as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env",
  );
}

// Lido ANTES de criar o cliente: o supabase-js limpa o endereço (#access_token,
// type=invite...) assim que processa a sessão do link do e-mail.
export const entrouPorConvite =
  typeof window !== "undefined" &&
  /type=invite/.test(window.location.hash + window.location.search);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
