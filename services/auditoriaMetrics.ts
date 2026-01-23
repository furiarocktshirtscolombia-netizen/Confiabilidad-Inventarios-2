
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
  const correctas = items.filter(i => i.diff === 0 || i.sis === i.con).length;
  const calidadConteoPct = total > 0 ? (correctas / total) * 100 : 100;

  let impactoFaltantes = 0;
  let impactoSobrantes = 0;

  const sedeGroups: Record<string, { total: number; ok: number }> = {};
  const centroGroups: Record<string, { total: number; ok: number }> = {};

  items.forEach(i => {
    // Calculamos impactos basados en el campo 'impacto' o calculado de diff * cost
    const imp = i.impacto !== undefined ? i.impacto : (i.diff * (i.unitCost || 0));
    if (imp < 0) impactoFaltantes += Math.abs(imp);
    if (imp > 0) impactoSobrantes += imp;

    // Agrupación por Sede
    const sName = i.sede || "N/A";
    if (!sedeGroups[sName]) sedeGroups[sName] = { total: 0, ok: 0 };
    sedeGroups[sName].total++;
    if (i.diff === 0 || i.sis === i.con) sedeGroups[sName].ok++;

    // Agrupación por Centro
    const cName = i.centro || "N/A";
    if (!centroGroups[cName]) centroGroups[cName] = { total: 0, ok: 0 };
    centroGroups[cName].total++;
    if (i.diff === 0 || i.sis === i.con) centroGroups[cName].ok++;
  });

  const getGroupArray = (groups: Record<string, { total: number; ok: number }>) => 
    Object.entries(groups).map(([name, v]) => ({
      name,
      pct: (v.ok / v.total) * 100
    })).sort((a, b) => a.pct - b.pct);

  return {
    total,
    correctas,
    calidadConteoPct,
    impactoFaltantes,
    impactoSobrantes,
    bySede: getGroupArray(sedeGroups),
    byCentro: getGroupArray(centroGroups)
  };
}
