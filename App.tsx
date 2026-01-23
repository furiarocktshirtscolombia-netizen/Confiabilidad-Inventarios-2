import React, { useState, useEffect } from 'react';
import { LocalDatabase, AnalysisResult } from './types';
import {
  parseUploadedFile,
  loadDbFromCache,
  clearLocalDb
} from './services/databaseService';
import { analyzeData } from './services/geminiService';
import ComparativoInventarios from './components/ComparativoInventarios';
import Button from './components/Button';
import {
  Database as DbIcon,
  Settings as SettingsIcon,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Zap,
  Trash2,
  HardDrive,
  ArrowRightLeft,
  X,
  Target,
  FileSpreadsheet
} from 'lucide-react';

// 🔹 Excel público en GitHub / Vercel
const EXCEL_URL = "/data/Informe_confiabilidad_empresa.xlsx";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('comparative');
  const [db, setDb] = useState<LocalDatabase | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  // 🔹 Cargar Excel desde el repo
  const loadExcelFromRepo = async () => {
    setLoading(true);
    try {
      const url = `${EXCEL_URL}?v=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });

      if (!res.ok) {
        throw new Error(`No se encontró el Excel en ${EXCEL_URL}`);
      }

      const blob = await res.blob();
      const file = new File([blob], "Informe_confiabilidad_empresa.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });

      const parsedDb = await parseUploadedFile(file);
      setDb(parsedDb);

      setStatus({ type: 'success', message: 'Excel cargado automáticamente desde GitHub' });
    } catch (err: any) {
      setStatus({ type: 'error', message: err?.message || 'Error cargando el Excel' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const cached = loadDbFromCache();
      if (cached) setDb(cached);
      await loadExcelFromRepo();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAnalyze = async () => {
    if (!db || db.rows.length === 0) return;
    setLoading(true);
    try {
      const sampleRows = db.rows.slice(0, 50);
      const csvHeader = db.headers.join('|');
      const csvBody = sampleRows
        .map(row => db.headers.map(h => String(row[h] ?? "")).join('|'))
        .join('\n');

      const dataContent = `Headers: ${csvHeader}\nSample Data:\n${csvBody}`;
      const result = await analyzeData(dataContent);
      setAnalysis(result);

      setStatus({ type: 'success', message: 'Reporte de IA generado correctamente' });
    } catch {
      setStatus({ type: 'error', message: 'Error al generar el análisis de IA' });
    } finally {
      setLoading(false);
    }
  };

  const mainAppUI = db ? (
    <div className="min-h-screen bg-brand-bg text-slate-900">
      {/* NAVBAR */}
      <nav className="bg-white/90 backdrop-blur-xl border-b px-6 py-4 flex justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-brand-primary p-2 rounded-xl">
            <DbIcon className="text-white w-5 h-5" />
          </div>
          <div className="flex flex-col leading-none">
            <h1 className="text-xl font-black uppercase text-brand-primary">MarQ Control</h1>
            <span className="text-[10px] font-bold tracking-widest text-brand-muted uppercase">
              Mary Quality Control
            </span>
          </div>
        </div>

        <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl">
          {[
            { id: 'comparative', icon: ArrowRightLeft, label: 'Comparativo' },
            { id: 'analysis', icon: Zap, label: 'IA Analítica' },
            { id: 'settings', icon: SettingsIcon, label: 'Gestión' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
                activeTab === tab.id
                  ? 'bg-brand-primary text-white'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* MAIN */}
      <main className="max-w-6xl mx-auto p-6 space-y-8">
        {activeTab === 'comparative' && (
          <ComparativoInventarios headers={db.headers} rows={db.rows} />
        )}

        {activeTab === 'analysis' && (
          <div className="text-center space-y-6">
            {!analysis ? (
              <>
                <Zap className="w-20 h-20 text-brand-primary mx-auto" />
                <h2 className="text-4xl font-black">IA Analítica MarQ</h2>
                <Button onClick={handleAnalyze} leftIcon={<Zap />}>
                  Generar Reporte IA
                </Button>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-black">Resumen Estratégico</h2>
                <p className="italic">"{analysis.summary}"</p>
              </>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="text-center space-y-6">
            <HardDrive className="w-16 h-16 mx-auto text-slate-400" />
            <Button onClick={loadExcelFromRepo} leftIcon={<FileSpreadsheet />}>
              Recargar Excel (GitHub)
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                clearLocalDb();
                setDb(null);
                loadExcelFromRepo();
              }}
              leftIcon={<Trash2 />}
            >
              Borrar Caché
            </Button>
          </div>
        )}
      </main>
    </div>
  ) : (
    <div className="min-h-screen flex items-center justify-center">
      <RefreshCw className="w-12 h-12 animate-spin text-brand-primary" />
    </div>
  );

  return (
    <>
      {mainAppUI}

      {status.type && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl text-white flex gap-2 items-center
          bg-black/80">
          {status.type === 'success' ? <CheckCircle2 /> : <AlertCircle />}
          <span>{status.message}</span>
          <button onClick={() => setStatus({ type: null, message: '' })}>
            <X />
          </button>
        </div>
      )}
    </>
  );
};

export default App;

