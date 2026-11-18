import { useCallback, useEffect, useState } from "react";
import { Mail, ShieldCheck, UserPlus, Users } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { atualizarMembro, convidarMembro, listarEquipe } from "../lib/db";

function fmtAcesso(data) {
  if (!data) return null;
  return new Date(data).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Equipe() {
  const { company, user, reloadProfile } = useAuth();
  const [membros, setMembros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [ocupado, setOcupado] = useState(null); // user_id em alteração

  // Formulário de convite
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [papel, setPapel] = useState("operator");
  const [convidando, setConvidando] = useState(false);

  const carregar = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    try {
      setMembros(await listarEquipe(company.id));
    } catch (e) {
      setErro("Erro ao carregar a equipe: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [company]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!company) return null;

  async function convidar(e) {
    e.preventDefault();
    setErro("");
    setSucesso("");
    setConvidando(true);
    try {
      const r = await convidarMembro({
        companyId: company.id,
        email: email.trim(),
        nome: nome.trim(),
        role: papel,
      });
      setSucesso(
        r.convidado
          ? `Convite enviado para ${email.trim()}. A pessoa recebe um e-mail para criar a senha.`
          : r.reativado
            ? `${email.trim()} voltou para a equipe.`
            : `${email.trim()} já tinha conta e foi adicionado à equipe. Pode entrar com a senha atual.`,
      );
      setEmail("");
      setNome("");
      setPapel("operator");
      await carregar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setConvidando(false);
    }
  }

  async function alterar(membro, campos, confirmacao) {
    if (confirmacao && !confirm(confirmacao)) return;
    setErro("");
    setSucesso("");
    setOcupado(membro.user_id);
    try {
      await atualizarMembro(company.id, membro.user_id, campos);
      await carregar();
      // Se mexeu no próprio papel, atualiza o acesso (pode perder telas de admin)
      if (membro.user_id === user?.id) await reloadProfile();
    } catch (err) {
      setErro(err.message);
    } finally {
      setOcupado(null);
    }
  }

  const ativos = membros.filter((m) => m.ativo);
  const inativos = membros.filter((m) => !m.ativo);

  function cartaoMembro(m) {
    const souEu = m.user_id === user?.id;
    const ehAdmin = m.role === "admin";
    const nomeExibido = m.nome || m.email;
    return (
      <div key={m.user_id} className="px-4 py-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {nomeExibido}
              {souEu && <span className="text-gray-400 font-normal"> (você)</span>}
            </p>
            {m.nome && <p className="text-xs text-gray-500 truncate">{m.email}</p>}
            <p className="text-xs text-gray-400 mt-0.5">
              {m.convite_pendente
                ? "Convite enviado, ainda não entrou"
                : `Último acesso: ${fmtAcesso(m.ultimo_acesso)}`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={ehAdmin ? "badge-blue" : "badge bg-gray-100 text-gray-700"}>
              {ehAdmin ? "Admin" : "Operador"}
            </span>
            {!m.ativo && <span className="badge-red">Desativado</span>}
            {m.ativo && m.convite_pendente && <span className="badge-yellow">Pendente</span>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {m.ativo && (
            <button
              type="button"
              disabled={ocupado === m.user_id}
              onClick={() =>
                alterar(
                  m,
                  { role: ehAdmin ? "operator" : "admin" },
                  ehAdmin
                    ? souEu
                      ? "Deixar de ser administrador? Você perde o acesso a Financeiro, Relatórios, Configurações e Equipe."
                      : `Tornar ${nomeExibido} operador?`
                    : `Tornar ${nomeExibido} administrador? Ele poderá ver o financeiro e gerenciar a equipe.`,
                )
              }
              className="btn-secondary text-xs py-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {ehAdmin ? "Tornar operador" : "Tornar admin"}
            </button>
          )}
          {!souEu &&
            (m.ativo ? (
              <button
                type="button"
                disabled={ocupado === m.user_id}
                onClick={() =>
                  alterar(
                    m,
                    { ativo: false },
                    `Desativar ${nomeExibido}? A pessoa perde o acesso imediatamente.`,
                  )
                }
                className="btn text-xs py-1.5 text-red-600 hover:bg-red-50"
              >
                Desativar
              </button>
            ) : (
              <button
                type="button"
                disabled={ocupado === m.user_id}
                onClick={() => alterar(m, { ativo: true })}
                className="btn-secondary text-xs py-1.5"
              >
                Reativar
              </button>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Equipe</h1>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          {sucesso}
        </div>
      )}

      {/* Convidar */}
      <form onSubmit={convidar} className="card card-body space-y-3">
        <h2 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          Convidar pessoa
        </h2>
        <div>
          <label className="label">E-mail *</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              required
              autoComplete="off"
              className="input pl-9"
              placeholder="pessoa@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Nome</label>
            <input
              className="input"
              placeholder="Como aparece na equipe"
              value={nome}
              maxLength={80}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Acesso</label>
            <select
              className="input"
              value={papel}
              onChange={(e) => setPapel(e.target.value)}
            >
              <option value="operator">Operador (compras e histórico)</option>
              <option value="admin">Administrador (acesso total)</option>
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={convidando || !email.trim()}
          className="btn-primary w-full sm:w-auto justify-center"
        >
          <UserPlus className="w-4 h-4" />
          {convidando ? "Enviando convite..." : "Enviar convite"}
        </button>
      </form>

      {/* Lista */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            Com acesso ({ativos.length})
          </h2>
        </div>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {ativos.map(cartaoMembro)}
          </div>
        )}
      </div>

      {inativos.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-500 text-sm">
              Desativados ({inativos.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {inativos.map(cartaoMembro)}
          </div>
        </div>
      )}
    </div>
  );
}
