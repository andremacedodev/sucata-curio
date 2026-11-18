import { useState, useEffect, useRef } from "react";
import {
  Search,
  Printer,
  MessageCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { buscarCompras, deleteCompra } from "../lib/db";
import { inicioDoDiaISO, fimDoDiaISO } from "../lib/datas";
import { useAuth } from "../contexts/AuthContext";
import { fmtKg } from "../lib/formato";
import { baixarPDF, compartilharWhatsApp } from "../lib/pdf";

const POR_PAGINA = 30;

function fmt(v) {
  return Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function Compras() {
  const { isAdmin } = useAuth();
  const [compras, setCompras] = useState([]);
  const [total, setTotal] = useState(0);
  const [valorTotal, setValorTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [expandida, setExpandida] = useState(null);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  // Descarta respostas antigas quando o filtro muda no meio do carregamento
  const requisicaoAtual = useRef(0);

  // Espera a pessoa parar de digitar (400 ms) antes de buscar no banco
  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(busca.trim()), 400);
    return () => clearTimeout(t);
  }, [busca]);

  function filtros(offset) {
    return {
      busca: buscaAplicada,
      dataInicio: dataInicio ? inicioDoDiaISO(dataInicio) : null,
      dataFim: dataFim ? fimDoDiaISO(dataFim) : null,
      limite: POR_PAGINA,
      offset,
    };
  }

  // Primeira página sempre que busca ou datas mudam
  useEffect(() => {
    const id = ++requisicaoAtual.current;
    setLoading(true);
    setErro("");
    setExpandida(null);
    buscarCompras(filtros(0))
      .then((r) => {
        if (id !== requisicaoAtual.current) return;
        setCompras(r.compras);
        setTotal(r.total);
        setValorTotal(r.valorTotal);
      })
      .catch((e) => {
        if (id !== requisicaoAtual.current) return;
        setCompras([]);
        setTotal(0);
        setValorTotal(0);
        setErro("Erro ao carregar o histórico: " + e.message);
      })
      .finally(() => {
        if (id === requisicaoAtual.current) setLoading(false);
      });
  }, [buscaAplicada, dataInicio, dataFim]);

  async function carregarMais() {
    const id = requisicaoAtual.current;
    setCarregandoMais(true);
    setErro("");
    try {
      const r = await buscarCompras(filtros(compras.length));
      if (id !== requisicaoAtual.current) return;
      // Evita duplicar se uma compra nova entrou entre uma página e outra
      setCompras((prev) => {
        const ids = new Set(prev.map((c) => c.id));
        return [...prev, ...r.compras.filter((c) => !ids.has(c.id))];
      });
      setTotal(r.total);
      setValorTotal(r.valorTotal);
    } catch (e) {
      setErro("Erro ao carregar mais compras: " + e.message);
    } finally {
      setCarregandoMais(false);
    }
  }

  async function excluir(compra) {
    if (
      !confirm(
        "Excluir esta compra? O registro financeiro também será removido.",
      )
    )
      return;
    try {
      await deleteCompra(compra.id);
      setCompras((prev) => prev.filter((c) => c.id !== compra.id));
      setTotal((t) => Math.max(0, t - 1));
      setValorTotal((v) => v - Number(compra.valor_total || 0));
    } catch (e) {
      alert("Erro ao excluir: " + e.message);
    }
  }

  const temFiltro = Boolean(busca || dataInicio || dataFim);
  const faltam = total - compras.length;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Histórico de Compras</h1>

      {/* Filtros */}
      <div className="card card-body space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9 pr-9"
            type="search"
            enterKeyHint="search"
            placeholder="Recibo, cliente ou material"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              aria-label="Limpar busca"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label text-xs">De</label>
            <input
              type="date"
              className="input"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs">Até</label>
            <input
              type="date"
              className="input"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Contagem (considera todas as encontradas, não só as carregadas) */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-gray-500">
          {loading ? (
            "Buscando..."
          ) : (
            <>
              {total} {total === 1 ? "compra encontrada" : "compras encontradas"}{" "}
              · Total: <strong className="valor">{fmt(valorTotal)}</strong>
            </>
          )}
        </p>
        {temFiltro && (
          <button
            type="button"
            onClick={() => {
              setBusca("");
              setDataInicio("");
              setDataFim("");
            }}
            className="text-sm text-indigo-600 font-medium"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <div className="space-y-2">
          {compras.length === 0 && !erro && (
            <div className="card p-8 text-center text-gray-400 text-sm">
              {temFiltro
                ? "Nenhuma compra encontrada com esses filtros."
                : "Nenhuma compra registrada ainda."}
            </div>
          )}
          {compras.map((compra) => (
            <div key={compra.id} className="card overflow-hidden">
              {/* Cabeçalho do card */}
              <button
                className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors"
                onClick={() =>
                  setExpandida(expandida === compra.id ? null : compra.id)
                }
              >
                <div className="flex items-center gap-3 text-left min-w-0 flex-1">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      #{String(compra.numero_recibo).padStart(4, "0")}
                      {compra.cliente_nome && (
                        <span className="text-gray-500 font-normal">
                          {" "}
                          — {compra.cliente_nome}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(compra.data_hora).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {compra.itens_compra?.length}{" "}
                      {compra.itens_compra?.length === 1 ? "item" : "itens"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="valor font-bold text-gray-900 text-sm sm:text-base">
                    {fmt(compra.valor_total)}
                  </span>
                  {expandida === compra.id ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Detalhe expandido */}
              {expandida === compra.id && (
                <div className="border-t border-gray-100">
                  {/* Itens */}
                  <div className="divide-y divide-gray-100">
                    {compra.itens_compra?.map((item) => (
                      <div
                        key={item.id}
                        className="px-4 py-2 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.material_nome}
                          </p>
                          <p className="valor text-xs text-gray-500">
                            {fmtKg(item.peso_kg)} × {fmt(item.preco_por_kg)}/kg
                          </p>
                        </div>
                        <span className="valor text-sm font-bold text-gray-900">
                          {fmt(item.valor_total)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {compra.observacoes && (
                    <p className="px-4 py-2 text-xs text-gray-500 italic border-t border-gray-100">
                      Obs: {compra.observacoes}
                    </p>
                  )}

                  {/* Ações */}
                  <div className="px-4 py-3 border-t border-gray-100 flex gap-2 flex-wrap">
                    <button
                      onClick={() => baixarPDF(compra)}
                      className="btn-secondary text-xs py-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      PDF
                    </button>
                    <button
                      onClick={() => compartilharWhatsApp(compra)}
                      className="btn-success text-xs py-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      WhatsApp
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => excluir(compra)}
                        className="btn-danger text-xs py-1.5 ml-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Excluir
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {faltam > 0 && (
            <button
              type="button"
              onClick={carregarMais}
              disabled={carregandoMais}
              className="btn-secondary w-full justify-center py-3"
            >
              {carregandoMais
                ? "Carregando..."
                : `Carregar mais (${Math.min(faltam, POR_PAGINA)} de ${faltam} restantes)`}
            </button>
          )}
          {faltam <= 0 && compras.length > POR_PAGINA && (
            <p className="text-center text-xs text-gray-400 py-2">
              Todas as {total} compras foram carregadas.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
