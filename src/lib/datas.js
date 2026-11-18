// Helpers de data no fuso LOCAL do navegador (ex.: Cuiabá, UTC-4).
//
// Por que existe: o banco guarda data_hora em UTC (timestamptz).
// Mandar "2026-11-18T23:59:59" sem fuso faz o Postgres ler como UTC,
// o que corta compras feitas depois das 20h em Cuiabá. E
// date.toISOString().slice(0, 10) devolve a data em UTC, então depois
// das 20h o "hoje" virava amanhã.

// Date -> "YYYY-MM-DD" no fuso local (para <input type="date">)
export function paraDataInput(date) {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

// "YYYY-MM-DD" -> ISO UTC do início desse dia no fuso local
export function inicioDoDiaISO(ymd) {
  return new Date(`${ymd}T00:00:00`).toISOString();
}

// "YYYY-MM-DD" -> ISO UTC do fim desse dia no fuso local
export function fimDoDiaISO(ymd) {
  return new Date(`${ymd}T23:59:59.999`).toISOString();
}
