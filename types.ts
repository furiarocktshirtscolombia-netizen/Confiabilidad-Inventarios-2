
export interface LocalDatabase {
  name: string;
  headers: string[];
  rows: any[];
  lastUpdated: string;
  fileSize: number;
  source: 'public' | 'upload' | 'cache';
}

export interface AnalysisResult {
  summary: string;
  insights: string[];
  suggestedActions: string[];
}
