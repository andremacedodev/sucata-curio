import { useEffect, useRef, useState } from "react";
import { Building2, FileText, ImageUp, Save, Trash2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  enviarLogoEmpresa,
  removerLogoEmpresa,
  updateEmpresa,
} from "../lib/db";
import { abrirPDFNovaAba } from "../lib/pdf";

const CAMPOS = ["nome", "telefone", "cnpj", "endereco", "bairro"];

function apenasDigitos(v) {
  return (v || "").replace(/\D/g, "");
}

// 65276996000108 -> 65.276.996/0001-08 (aceita digitação parcial)
function mascaraCnpj(v) {
  const d = apenasDigitos(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

// 65992644949 -> (65) 99264-4949 ; 6533221100 -> (65) 3322-1100
function mascaraTelefone(v) {
  const d = apenasDigitos(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function formDaEmpresa(company) {
  return Object.fromEntries(CAMPOS.map((c) => [c, company?.[c] || ""]));
}

export default function Configuracoes() {
  const { company, reloadProfile } = useAuth();
  const [form, setForm] = useState(() => formDaEmpresa(company));
  const [salvando, setSalvando] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [aviso, setAviso] = useState("");
  const inputLogo = useRef(null);

  // Atualiza o formulário quando os dados da empresa recarregam
  useEffect(() => {
    setForm(formDaEmpresa(company));
  }, [company]);

  if (!company) return null;

  const alterado = CAMPOS.some((c) => (form[c] || "") !== (company[c] || ""));

  function limparMensagens() {
    setErro("");
    setSucesso("");
    setAviso("");
  }

  function alterar(campo, valor) {
    if (campo === "cnpj") valor = mascaraCnpj(valor);
    if (campo === "telefone") valor = mascaraTelefone(valor);
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function salvar(e) {
    e.preventDefault();
    limparMensagens();

    if (!form.nome.trim()) {
      setErro("Informe o nome da empresa.");
      return;
    }
    const cnpj = apenasDigitos(form.cnpj);
    if (cnpj && cnpj.length !== 14) {
      setErro("CNPJ incompleto: deve ter 14 dígitos.");
      return;
    }

    setSalvando(true);
    try {
      const campos = Object.fromEntries(
        CAMPOS.map((c) => [c, form[c].trim() || null]),
      );
      campos.nome = form.nome.trim();
      await updateEmpresa(company.id, campos);
      await reloadProfile();
      setSucesso("Dados salvos. O recibo já sai com as informações novas.");
    } catch (err) {
      setErro("Erro ao salvar: " + err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function trocarLogo(e) {
    const arquivo = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!arquivo) return;
    limparMensagens();
    setEnviandoLogo(true);
    try {
      const { aviso } = await enviarLogoEmpresa(
        company.id,
        arquivo,
        company.logo_url,
      );
      await reloadProfile();
      setSucesso("Logo atualizado.");
      setAviso(aviso);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviandoLogo(false);
    }
  }

  async function removerLogo() {
    if (!confirm("Remover o logo da empresa?")) return;
    limparMensagens();
    setEnviandoLogo(true);
    try {
      const { aviso } = await removerLogoEmpresa(company.id, company.logo_url);
      await reloadProfile();
      setSucesso("Logo removido.");
      setAviso(aviso);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviandoLogo(false);
    }
  }

  function verReciboExemplo() {
    abrirPDFNovaAba({
      company_id: company.id,
      numero_recibo: 1,
      data_hora: new Date().toISOString(),
      cliente_nome: "Cliente de exemplo",
      forma_pagamento: "Pix",
      observacoes: "Recibo de exemplo — não foi registrado no sistema.",
      valor_total: 452.5,
      itens_compra: [
        { material_nome: "Cobre Misto", peso_kg: 8.5, preco_por_kg: 35, valor_total: 297.5 },
        { material_nome: "Latinha", peso_kg: 20, preco_por_kg: 7.75, valor_total: 155 },
      ],
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Configurações</h1>

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
      {aviso && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
          {aviso}
        </div>
      )}

      {/* Logo */}
      <div className="card card-body space-y-3">
        <div>
          <h2 className="font-semibold text-gray-700 text-sm">Logo da empresa</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Aparece no topo do sistema e no recibo. PNG, JPG ou WEBP; imagens
            grandes são reduzidas automaticamente.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="h-20 w-32 shrink-0 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
            {company.logo_url ? (
              <img
                src={company.logo_url}
                alt="Logo atual"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="text-xs text-gray-400 text-center px-2">
                Sem logo
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2 min-w-0">
            <input
              ref={inputLogo}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={trocarLogo}
            />
            <button
              type="button"
              onClick={() => inputLogo.current?.click()}
              disabled={enviandoLogo}
              className="btn-secondary justify-center"
            >
              <ImageUp className="w-4 h-4" />
              {enviandoLogo
                ? "Enviando..."
                : company.logo_url
                  ? "Trocar logo"
                  : "Enviar logo"}
            </button>
            {company.logo_url && (
              <button
                type="button"
                onClick={removerLogo}
                disabled={enviandoLogo}
                className="btn text-red-600 hover:bg-red-50 justify-center"
              >
                <Trash2 className="w-4 h-4" />
                Remover
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dados */}
      <form onSubmit={salvar} className="card card-body space-y-3">
        <div>
          <h2 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Dados da empresa
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Usados no recibo e na mensagem de WhatsApp. Campos vazios não
            aparecem no recibo.
          </p>
        </div>

        <div>
          <label className="label">Nome da empresa *</label>
          <input
            className="input"
            value={form.nome}
            onChange={(e) => alterar("nome", e.target.value)}
            maxLength={80}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Telefone</label>
            <input
              className="input"
              inputMode="tel"
              placeholder="(65) 99999-9999"
              value={form.telefone}
              onChange={(e) => alterar("telefone", e.target.value)}
            />
          </div>
          <div>
            <label className="label">CNPJ</label>
            <input
              className="input"
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              value={form.cnpj}
              onChange={(e) => alterar("cnpj", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">Endereço</label>
          <input
            className="input"
            placeholder="Rua, número"
            value={form.endereco}
            onChange={(e) => alterar("endereco", e.target.value)}
            maxLength={120}
          />
        </div>

        <div>
          <label className="label">Bairro / Cidade</label>
          <input
            className="input"
            placeholder="Bairro - Cidade/UF"
            value={form.bairro}
            onChange={(e) => alterar("bairro", e.target.value)}
            maxLength={120}
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between pt-1">
          <button
            type="button"
            onClick={verReciboExemplo}
            className="btn-secondary justify-center"
          >
            <FileText className="w-4 h-4" />
            Ver recibo de exemplo
          </button>
          <button
            type="submit"
            disabled={!alterado || salvando}
            className="btn-primary justify-center"
          >
            <Save className="w-4 h-4" />
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
