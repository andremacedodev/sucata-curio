import { supabase } from "./supabase";

// ============================================================
// MATERIAIS
// ============================================================

export async function getMateriais() {
  const { data, error } = await supabase
    .from("materiais")
    .select("*")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return data;
}

// Quantas vezes cada material aparece nas compras mais recentes da empresa.
// Usa os últimos 1000 itens: reflete o que o pátio compra HOJE, não há anos.
// Retorna { [material_id]: quantidade }.
export async function getFrequenciaMateriais(limite = 1000) {
  const { data, error } = await supabase
    .from("itens_compra")
    .select("material_id")
    .not("material_id", "is", null)
    .order("criado_em", { ascending: false })
    .limit(limite);
  if (error) throw error;

  const freq = {};
  for (const { material_id } of data) {
    freq[material_id] = (freq[material_id] || 0) + 1;
  }
  return freq;
}

export async function createMaterial(nome, preco_padrao_kg = null) {
  const { data, error } = await supabase
    .from("materiais")
    .insert([{ nome, preco_padrao_kg }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMaterial(id, updates) {
  const { data, error } = await supabase
    .from("materiais")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMaterial(id) {
  const { error } = await supabase
    .from("materiais")
    .update({ ativo: false })
    .eq("id", id);
  if (error) throw error;
}

// ============================================================
// COMPRAS
// ============================================================

export async function getCompras({ dataInicio, dataFim, limit = 50 } = {}) {
  let query = supabase
    .from("compras")
    .select(
      `
      *,
      itens_compra (
        id,
        material_nome,
        peso_kg,
        preco_por_kg,
        valor_total
      )
    `,
    )
    .order("data_hora", { ascending: false })
    .limit(limit);

  if (dataInicio) query = query.gte("data_hora", dataInicio);
  if (dataFim) query = query.lte("data_hora", dataFim);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Histórico: busca no banco (recibo, cliente ou material) sobre TODAS as
// compras da empresa, uma página por vez.
// Retorna { total, valorTotal, compras } — total e valorTotal consideram
// todas as compras encontradas, não só a página.
export async function buscarCompras({
  busca = "",
  dataInicio = null,
  dataFim = null,
  limite = 30,
  offset = 0,
} = {}) {
  const { data, error } = await supabase.rpc("buscar_compras", {
    p_busca: busca || null,
    p_inicio: dataInicio,
    p_fim: dataFim,
    p_limite: limite,
    p_offset: offset,
  });
  if (error) throw error;
  return {
    total: Number(data?.total || 0),
    valorTotal: Number(data?.valor_total || 0),
    compras: data?.compras || [],
  };
}

export async function getCompraById(id) {
  const { data, error } = await supabase
    .from("compras")
    .select(
      `
      *,
      itens_compra (*)
    `,
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createCompra({
  cliente_nome,
  forma_pagamento,
  observacoes,
  itens,
}) {
  // Compra + itens + saída no financeiro numa única transação (função
  // criar_compra no banco). Se qualquer parte falhar, nada é gravado.
  // Totais e número do recibo são calculados no banco.
  const { data: compra, error } = await supabase.rpc("criar_compra", {
    p_cliente_nome: cliente_nome,
    p_forma_pagamento: forma_pagamento,
    p_observacoes: observacoes,
    p_itens: itens.map((item) => ({
      material_id: item.material_id || null,
      material_nome: item.material_nome,
      peso_kg: item.peso_kg,
      preco_por_kg: item.preco_por_kg,
    })),
  });

  if (error) throw error;
  return compra;
}

export async function deleteCompra(id) {
  // Apaga compra + lançamento financeiro numa única transação no banco.
  // Se o usuário não tiver permissão, o banco devolve erro explícito
  // (antes o DELETE bloqueado pelo RLS "passava" sem apagar nada).
  const { error } = await supabase.rpc("excluir_compra", { p_compra_id: id });
  if (error) throw error;
}

// ============================================================
// FINANCEIRO
// ============================================================

export async function getFinanceiro({ dataInicio, dataFim } = {}) {
  let query = supabase
    .from("financeiro")
    .select("*")
    .order("data_hora", { ascending: false });

  if (dataInicio) query = query.gte("data_hora", dataInicio);
  if (dataFim) query = query.lte("data_hora", dataFim);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createDespesa({
  descricao,
  valor,
  categoria = "Despesa operacional",
}) {
  const { data, error } = await supabase
    .from("financeiro")
    .insert([
      {
        tipo: "saida",
        categoria,
        valor,
        descricao,
      },
    ])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createEntrada({
  descricao,
  valor,
  categoria = "Venda de material",
}) {
  const { data, error } = await supabase
    .from("financeiro")
    .insert([
      {
        tipo: "entrada",
        categoria,
        valor,
        descricao,
      },
    ])
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// VENDAS
// ============================================================

export async function getVendas({ dataInicio, dataFim } = {}) {
  let query = supabase
    .from("vendas")
    .select("*")
    .order("data_hora", { ascending: false });

  if (dataInicio) query = query.gte("data_hora", dataInicio);
  if (dataFim) query = query.lte("data_hora", dataFim);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createVenda({
  material_nome,
  peso_kg,
  preco_por_kg,
  comprador,
  observacoes,
}) {
  const valor_total = peso_kg * preco_por_kg;

  const { data: venda, error: errVenda } = await supabase
    .from("vendas")
    .insert([
      {
        material_nome,
        peso_kg,
        preco_por_kg,
        valor_total,
        comprador,
        observacoes,
      },
    ])
    .select()
    .single();

  if (errVenda) throw errVenda;

  // Registra entrada no financeiro
  await createEntrada({
    descricao: `Venda: ${material_nome} - ${peso_kg}kg`,
    valor: valor_total,
    categoria: "Venda de material",
  });

  return venda;
}

// ============================================================
// RESUMO DO DIA / MÊS (para dashboard)
// ============================================================

export async function getResumoDia(data = new Date()) {
  const inicio = new Date(data);
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(data);
  fim.setHours(23, 59, 59, 999);

  const { data: registros, error } = await supabase
    .from("financeiro")
    .select("tipo, valor")
    .gte("data_hora", inicio.toISOString())
    .lte("data_hora", fim.toISOString());

  if (error) throw error;

  const entradas = registros
    .filter((r) => r.tipo === "entrada")
    .reduce((s, r) => s + r.valor, 0);
  const saidas = registros
    .filter((r) => r.tipo === "saida")
    .reduce((s, r) => s + r.valor, 0);

  return { entradas, saidas, lucro: entradas - saidas };
}

export async function getResumoMes(
  ano = new Date().getFullYear(),
  mes = new Date().getMonth(),
) {
  const inicio = new Date(ano, mes, 1);
  const fim = new Date(ano, mes + 1, 0, 23, 59, 59, 999);

  const { data: registros, error } = await supabase
    .from("financeiro")
    .select("tipo, valor")
    .gte("data_hora", inicio.toISOString())
    .lte("data_hora", fim.toISOString());

  if (error) throw error;

  const entradas = registros
    .filter((r) => r.tipo === "entrada")
    .reduce((s, r) => s + r.valor, 0);
  const saidas = registros
    .filter((r) => r.tipo === "saida")
    .reduce((s, r) => s + r.valor, 0);

  return { entradas, saidas, lucro: entradas - saidas };
}

export async function getComprasPorMaterial({ dataInicio, dataFim } = {}) {
  let query = supabase
    .from("itens_compra")
    .select("material_nome, peso_kg, valor_total, compras!inner(data_hora)");

  if (dataInicio) query = query.gte("compras.data_hora", dataInicio);
  if (dataFim) query = query.lte("compras.data_hora", dataFim);

  const { data, error } = await query;
  if (error) throw error;

  // Agrupa por material
  const agrupado = {};
  for (const item of data) {
    if (!agrupado[item.material_nome]) {
      agrupado[item.material_nome] = {
        material: item.material_nome,
        totalKg: 0,
        totalReais: 0,
        qtd: 0,
      };
    }
    agrupado[item.material_nome].totalKg += Number(item.peso_kg);
    agrupado[item.material_nome].totalReais += Number(item.valor_total);
    agrupado[item.material_nome].qtd += 1;
  }

  return Object.values(agrupado).sort((a, b) => b.totalReais - a.totalReais);
}

// ============================================================
// EMPRESA (Configurações)
// ============================================================

const BUCKET_LOGOS = "logos";

// Atualiza dados da empresa. RLS: só admin da empresa.
// Se o banco recusar sem erro (0 linhas), avisa explicitamente.
export async function updateEmpresa(companyId, campos) {
  const { data, error } = await supabase
    .from("companies")
    .update(campos)
    .eq("id", companyId)
    .select("id, nome, telefone, endereco, bairro, cnpj, logo_url")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error(
      "Não foi possível salvar: apenas o administrador da empresa pode alterar estes dados.",
    );
  }
  return data;
}

// Reduz a imagem (máx. 600px) e converte para PNG, mantendo transparência.
// Evita estourar o limite de 2 MB com foto tirada no celular.
async function prepararLogo(arquivo) {
  const tiposAceitos = ["image/png", "image/jpeg", "image/webp"];
  if (!tiposAceitos.includes(arquivo.type)) {
    throw new Error("Formato não suportado. Envie PNG, JPG ou WEBP.");
  }

  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      i.src = url;
    });

    const escala = Math.min(1, 600 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("Não foi possível converter a imagem.");
    if (blob.size > 2 * 1024 * 1024) {
      throw new Error("Imagem muito grande mesmo após reduzir (máx. 2 MB).");
    }
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Caminho do arquivo dentro do bucket, a partir da URL pública (ou null se
// o logo não estiver no nosso bucket, ex.: /logo_sucata.jpeg).
function caminhoNoBucket(urlPublica) {
  const marcador = `/storage/v1/object/public/${BUCKET_LOGOS}/`;
  const i = urlPublica?.indexOf(marcador) ?? -1;
  return i >= 0 ? decodeURIComponent(urlPublica.slice(i + marcador.length)) : null;
}

// Envia novo logo para logos/<company_id>/, grava a URL na empresa e apaga
// o arquivo anterior. Retorna { empresa, aviso }.
export async function enviarLogoEmpresa(companyId, arquivo, logoAnterior) {
  const blob = await prepararLogo(arquivo);
  const caminho = `${companyId}/logo-${Date.now()}.png`;

  const { error: errUpload } = await supabase.storage
    .from(BUCKET_LOGOS)
    .upload(caminho, blob, { contentType: "image/png", upsert: false });
  if (errUpload) throw new Error("Erro ao enviar o logo: " + errUpload.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET_LOGOS).getPublicUrl(caminho);

  const empresa = await updateEmpresa(companyId, { logo_url: publicUrl });
  const aviso = await apagarArquivoLogo(logoAnterior);
  return { empresa, aviso };
}

// Remove o logo da empresa (volta a usar o ícone do Peso Certo).
export async function removerLogoEmpresa(companyId, logoAtual) {
  const empresa = await updateEmpresa(companyId, { logo_url: null });
  const aviso = await apagarArquivoLogo(logoAtual);
  return { empresa, aviso };
}

// Apagar o arquivo antigo não é crítico: se falhar, devolve um aviso
// para a tela mostrar, em vez de esconder o problema.
async function apagarArquivoLogo(urlPublica) {
  const caminho = caminhoNoBucket(urlPublica);
  if (!caminho) return "";
  const { error } = await supabase.storage.from(BUCKET_LOGOS).remove([caminho]);
  return error
    ? "Logo atualizado, mas o arquivo antigo não pôde ser apagado: " + error.message
    : "";
}
