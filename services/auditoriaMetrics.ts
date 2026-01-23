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
  const correctas = items.filter(i => i.diff === 0).length;

  let impactoFaltantes = 0;
  let impactoSobrantes = 0;

  const sedeGroups: Record<string, number[]> = {};
  const centroGroups: Record<string, number[]> = {};
  const globalReliabilities: number[] = [];

  items.forEach(i => {
    // 1. Impacto Financiero (acumulado)
    const imp = i.impacto || 0;
    if (imp < 0) impactoFaltantes += Math.abs(imp);
    if (imp > 0) impactoSobrantes += imp;

    // 2. Confiabilidad Física por Ítem
    // REGLA: Confiabilidad_item = MIN(Stock_inventario / Stock_a_fecha, 1) * 100
    // EXCEPCIÓN: Si stock a fecha = 0 -> excluir del promedio (regla clave)
    if (i.sis > 0) {
      const reliability = Math.min(i.con / i.sis, 1) * 100;
      
      const sName = i.sede || "N/A";
      if (!sedeGroups[sName]) sedeGroups[sName] = [];
      sedeGroups[sName].push(reliability);

      const cName = i.centro || "N/A";
      if (!centroGroups[cName]) centroGroups[cName] = [];
      centroGroups[cName].push(reliability);

      globalReliabilities.push(reliability);
    }
  });

  const calculateAverage = (reliabilities: number[]) => 
    reliabilities.length > 0 
      ? reliabilities.reduce((a, b) => a + b, 0) / reliabilities.length 
      : 0;

  const bySede = Object.entries(sedeGroups).map(([name, rels]) => ({
    name,
    pct: calculateAverage(rels)
  })).sort((a, b) => a.pct - b.pct);

  const byCentro = Object.entries(centroGroups).map(([name, rels]) => ({
    name,
    pct: calculateAverage(rels)
  })).sort((a, b) => a.pct - b.pct);

  const calidadConteoPct = globalReliabilities.length > 0 
    ? calculateAverage(globalReliabilities) 
    : 100;

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
