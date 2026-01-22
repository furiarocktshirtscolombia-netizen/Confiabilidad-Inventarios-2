
import React, { useState, useEffect, useCallback } from 'react';
import { GitHubConfig, FileData, AnalysisResult } from './types';
import { getGitHubFile, pushGitHubFile } from './services/githubService';
import { analyzeData } from './services/geminiService';
import { 
  Layout, 
  Database, 
  Settings as SettingsIcon, 
  Upload, 
  PieChart, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw,
  Github,
  Zap
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

// Sub-components
const Navbar = ({ activeTab, setTab }: { activeTab: string, setTab: (t: string) => void }) => (
  <nav className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
    <div className="flex items-center gap-3">
      <div className="bg-indigo-600 p-2 rounded-lg">
        <Database className="text-white w-6 h-6" />
      </div>
      <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
        MaestroBridge
      </h1>
    </div>
    <div className="flex gap-1 bg-slate-800 p-1 rounded-xl">
      {[
        { id: 'dashboard', icon: PieChart, label: 'Dashboard' },
        { id: 'upload', icon: Upload, label: 'Upload' },
        { id: 'settings', icon: SettingsIcon, label: 'Settings' }
      ].map((tab) => (
        <button
          key={tab.id}
          onClick={() => setTab(tab.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            activeTab === tab.id 
              ? 'bg-indigo-600 text-white shadow-lg' 
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700'
          }`}
        >
          <tab.icon className="w-4 h-4" />
          <span className="text-sm font-medium">{tab.label}</span>
        </button>
      ))}
    </div>
  </nav>
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [config, setConfig] = useState<GitHubConfig>(() => {
    const saved = localStorage.getItem('gh_config');
    return saved ? JSON.parse(saved) : { owner: '', repo: '', path: 'data/registros.csv', token: '' };
  });
  
  const [currentFile, setCurrentFile] = useState<FileData | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  // Load file on mount/config change
  useEffect(() => {
    const init = async () => {
      if (config.token && config.owner && config.repo) {
        setLoading(true);
        try {
          const file = await getGitHubFile(config);
          setCurrentFile(file);
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      }
    };
    init();
  }, [config.owner, config.repo, config.path]);

  const handleSaveConfig = (newConfig: GitHubConfig) => {
    setConfig(newConfig);
    localStorage.setItem('gh_config', JSON.stringify(newConfig));
    setStatus({ type: 'success', message: 'Configuraciones guardadas localmente.' });
    setTimeout(() => setStatus({ type: null, message: '' }), 3000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatus({ type: null, message: '' });

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const newFileData: FileData = {
          name: file.name,
          content: base64,
          sha: currentFile?.sha,
        };

        const newSha = await pushGitHubFile(config, newFileData);
        setCurrentFile({ ...newFileData, sha: newSha });
        setStatus({ type: 'success', message: '¡Archivo sincronizado con GitHub con éxito!' });
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      setStatus({ type: 'error', message: error.message || 'Error al subir el archivo' });
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!currentFile) return;
    setLoading(true);
    try {
      const csvText = atob(currentFile.content);
      const result = await analyzeData(csvText);
      setAnalysis(result);
    } catch (e) {
      setStatus({ type: 'error', message: 'Fallo el análisis de IA' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <Navbar activeTab={activeTab} setTab={setActiveTab} />
      
      <main className="max-w-6xl mx-auto p-6 md:p-8">
        {status.type && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 border ${
            status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-red-500/10 border-red-500/50 text-red-400'
          }`}>
            {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="text-sm font-medium">{status.message}</span>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Estado de la Base de Datos</h2>
                <p className="text-slate-400 text-sm">Monitoreo en tiempo real de tu repositorio GitHub</p>
              </div>
              <button 
                onClick={handleAnalyze}
                disabled={!currentFile || loading}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Analizar con Gemini AI
              </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-slate-400 text-sm font-medium">Archivo Activo</span>
                  <Database className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="text-xl font-bold text-white truncate">
                  {currentFile ? currentFile.name : 'Ninguno'}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {currentFile ? `SHA: ${currentFile.sha?.substring(0, 8)}...` : 'Configura GitHub para empezar'}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-slate-400 text-sm font-medium">Ubicación</span>
                  <Github className="w-5 h-5 text-slate-400" />
                </div>
                <div className="text-lg font-bold text-white truncate">
                  {config.owner}/{config.repo}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  /{config.path}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-slate-400 text-sm font-medium">Sincronización</span>
                  <div className={`w-3 h-3 rounded-full ${currentFile ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`} />
                </div>
                <div className="text-xl font-bold text-white">
                  {currentFile ? 'Conectado' : 'Desconectado'}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  GitHub API v3
                </div>
              </div>
            </div>

            {analysis && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                <div className="bg-indigo-600/10 px-6 py-4 border-b border-slate-800 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-indigo-500" />
                  <h3 className="font-bold text-indigo-400">Insights de Inteligencia Artificial</h3>
                </div>
                <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Resumen Ejecutivo</h4>
                      <p className="text-slate-300 leading-relaxed">{analysis.summary}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Hallazgos Clave</h4>
                      <ul className="space-y-2">
                        {analysis.insights.map((ins, i) => (
                          <li key={i} className="flex gap-3 text-sm text-slate-300">
                            <span className="text-indigo-500 font-bold">•</span>
                            {ins}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Acciones Recomendadas</h4>
                    <div className="space-y-3">
                      {analysis.suggestedActions.map((action, i) => (
                        <div key={i} className="bg-slate-900 p-3 rounded-lg border border-slate-700 text-sm flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-500 flex items-center justify-center text-xs font-bold shrink-0">
                            {i+1}
                          </div>
                          <span className="text-slate-200">{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!analysis && !currentFile && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="bg-slate-900 p-6 rounded-full mb-4">
                  <Database className="w-12 h-12 text-slate-700" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No hay datos disponibles</h3>
                <p className="text-slate-500 max-w-md">
                  Configura tu repositorio de GitHub y sube un archivo CSV/Excel para habilitar el dashboard y el análisis inteligente.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="max-w-2xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
              <h2 className="text-2xl font-bold text-white mb-6">Sincronizar Archivo</h2>
              <div className="space-y-6">
                <div className="border-2 border-dashed border-slate-700 rounded-2xl p-10 flex flex-col items-center justify-center transition-colors hover:border-indigo-500 group relative">
                  <input 
                    type="file" 
                    onChange={handleFileUpload} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    accept=".csv,.xlsx,.xls"
                    disabled={loading || !config.token}
                  />
                  <div className="bg-slate-800 p-4 rounded-2xl mb-4 group-hover:bg-indigo-600/20 group-hover:scale-110 transition-all">
                    <Upload className="w-10 h-10 text-slate-400 group-hover:text-indigo-500" />
                  </div>
                  <p className="text-lg font-medium text-slate-300">Haz clic o arrastra para subir</p>
                  <p className="text-sm text-slate-500 mt-2">CSV, Excel (máx. 10MB)</p>
                </div>
                
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex gap-3 text-amber-500">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p className="text-xs">
                    Importante: Al subir un archivo con el mismo nombre y ruta definida en settings, se creará un nuevo commit en GitHub reemplazando el anterior.
                  </p>
                </div>

                {!config.token && (
                  <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex gap-3 text-red-500">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-sm">Configura primero tu GitHub Token en la pestaña de ajustes.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
              <h2 className="text-2xl font-bold text-white mb-6">Configuración de GitHub</h2>
              <form className="space-y-5" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleSaveConfig({
                  owner: formData.get('owner') as string,
                  repo: formData.get('repo') as string,
                  path: formData.get('path') as string,
                  token: formData.get('token') as string,
                });
              }}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Usuario / Org</label>
                    <input name="owner" defaultValue={config.owner} placeholder="e.g. google" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Repositorio</label>
                    <input name="repo" defaultValue={config.repo} placeholder="e.g. storage-db" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Ruta del Archivo (.csv)</label>
                  <input name="path" defaultValue={config.path} placeholder="data/registros.csv" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Personal Access Token</label>
                  <input type="password" name="token" defaultValue={config.token} placeholder="ghp_xxxxxxxxxxxx" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <p className="mt-2 text-[11px] text-slate-500">
                    Requiere permisos de <b>Contents: Read & Write</b>. El token se guarda localmente en tu navegador.
                  </p>
                </div>
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20">
                  Guardar Cambios
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {loading && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] flex flex-col items-center justify-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
            <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-indigo-500 animate-pulse" />
          </div>
          <p className="mt-4 font-medium text-slate-300">Procesando con precisión...</p>
        </div>
      )}
    </div>
  );
};

export default App;
