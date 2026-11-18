// Formatação padrão brasileira para valores e pesos.

export function fmtReais(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// 12345.678 -> "12.345,678 kg"
export function fmtKg(valor, casas = 3) {
  return (
    Number(valor || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
    }) + " kg"
  );
}

// Eixo de gráfico (curto, sem "R$"): 2500 -> "2,5 mil", 1200000 -> "1,2 mi"
export function fmtValorCurto(valor) {
  const v = Number(valor || 0);
  const abs = Math.abs(v);
  const n = (x) => x.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  if (abs >= 1e6) return `${n(v / 1e6)} mi`;
  if (abs >= 1e3) return `${n(v / 1e3)} mil`;
  return n(v);
}
