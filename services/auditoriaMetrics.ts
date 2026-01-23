export interface AuditoriaMetrics {
  total: number;
  correctas: number;
  calidadConteoPct: number;
  impactoFaltantes: number;
  impactoSobrantes: number;
  bySede: Array<{ name: string; pct: number }>;
  byCentro: Array<{ name: string; pct: number }>;
}

export function buildAuditoriaMetrics(items: any[]): AuditoriaMetrics {
  const total = items.length;
  // Una referencia está correcta únicamente si el conteo físico es igual al stock del sistema (variación = 0)
  const correctas = items.filter(i => i.diff === 0).length;

  let impactoFaltantes = 0;
  let impactoSobrantes = 0;

  // Estructuras para agrupar por Sede y Centro
  const sedeStats: Record<string, { total: number; correctas: number }> = {};
  const centroStats: Record<string, { total: number; correctas: number }> = {};

  items.forEach(i => {
    // 1. Impacto Financiero
    // Se mantiene el cálculo: Variación * Costo de línea
    const imp = i.impacto || 0;
    if (imp < 0) impactoFaltantes += Math.abs(imp);
    if (imp > 0) impactoSobrantes += imp;

    // 2. Confiabilidad basada en Referencias Correctas (Lógica Binaria)
    const sName = i.sede || "N/A";
    const cName = i.centro || "N/A";
    const isCorrect = i.diff === 0;

    if (!sedeStats[sName]) sedeStats[sName] = { total: 0, correctas: 0 };
    sedeStats[sName].total++;
    if (isCorrect) sedeStats[sName].correctas++;

    if (!centroStats[cName]) centroStats[cName] = { total: 0, correctas: 0 };
    centroStats[cName].total++;
    if (isCorrect) centroStats[cName].correctas++;
  });

  // Confiabilidad (%) = (Referencias correctas / Total de referencias) * 100
  const bySede = Object.entries(sedeStats).map(([name, stats]) => ({
    name,
    pct: (stats.correctas / stats.total) * 100
  })).sort((a, b) => a.pct - b.pct);

  const byCentro = Object.entries(centroStats).map(([name, stats]) => ({
    name,
    pct: (stats.correctas / stats.total) * 100
  })).sort((a, b) => a.pct - b.pct);

  // Calidad del conteo global
  const calidadConteoPct = total > 0 ? (correctas / total) * 100 : 100;

  return {
    total,
    correctas,
    calidadConteoPct,
    impactoFaltantes,
    impactoSobrantes,
    bySede,
    byCentro
  };
}
