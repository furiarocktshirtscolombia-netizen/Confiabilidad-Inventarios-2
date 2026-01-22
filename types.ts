
export interface GitHubConfig {
  owner: string;
  repo: string;
  path: string;
  token: string;
}

export interface FileData {
  name: string;
  content: string; // Base64
  sha?: string;
  size?: number;
}

export interface AnalysisResult {
  summary: string;
  insights: string[];
  suggestedActions: string[];
}

export interface AppState {
  config: GitHubConfig;
  currentFile: FileData | null;
  analysis: AnalysisResult | null;
  loading: boolean;
  error: string | null;
}
