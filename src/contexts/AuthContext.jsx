import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { getMembership, getProfile, signOutUser } from "../lib/authService";

const AuthContext = createContext(null);

// company_members.role ('admin' | 'operator') -> papel usado nas telas.
// O banco (RLS) decide permissões por company_members; a tela usa a MESMA
// fonte para não mostrar botões que o banco vai recusar.
function papelDaEmpresa(membership) {
  if (!membership) return null;
  return membership.role === "admin" ? "ADMIN" : "OPERADOR";
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  // Erro de acesso (usuário inativo, sem empresa...). Mostrado na tela de login.
  const [authError, setAuthError] = useState("");

  async function loadProfile(currentUser) {
    if (!currentUser) {
      setProfile(null);
      setMembership(null);
      return null;
    }

    const [dataProfile, dataMembership] = await Promise.all([
      getProfile(currentUser.id),
      getMembership(currentUser.id),
    ]);

    if (!dataProfile.ativo) {
      await signOutUser();
      throw new Error("Usuário inativo. Fale com o administrador.");
    }

    if (!dataMembership) {
      await signOutUser();
      throw new Error(
        "Seu usuário não está vinculado a nenhuma empresa ativa. Fale com o administrador.",
      );
    }

    setProfile(dataProfile);
    setMembership(dataMembership);
    setAuthError("");
    return dataProfile;
  }

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          await loadProfile(currentSession.user);
        }
      } catch (err) {
        if (mounted) setAuthError(err.message || "Erro ao carregar o usuário.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecovery(true);
      }

      if (event === "SIGNED_OUT") {
        setProfile(null);
        setMembership(null);
        setPasswordRecovery(false);
        setLoading(false);
        return;
      }

      if (currentSession?.user) {
        // setTimeout: a supabase-js recomenda não chamar o banco direto
        // dentro do onAuthStateChange (pode travar a sessão).
        setTimeout(() => {
          loadProfile(currentSession.user)
            .catch((err) =>
              setAuthError(err.message || "Erro ao carregar o usuário."),
            )
            .finally(() => setLoading(false));
        }, 0);
      } else {
        setProfile(null);
        setMembership(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => {
    const role = papelDaEmpresa(membership);
    return {
      session,
      user,
      profile,
      membership,
      company: membership?.companies ?? null,
      role,
      loading,
      passwordRecovery,
      authError,
      clearAuthError: () => setAuthError(""),
      isAuthenticated: Boolean(session?.user),
      isAdmin: role === "ADMIN",
      isOperator: role === "OPERADOR",
      signOut: signOutUser,
      reloadProfile: () => loadProfile(user),
    };
  }, [session, user, profile, membership, loading, passwordRecovery, authError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  }

  return context;
}
