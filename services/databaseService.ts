
import * as XLSX from 'xlsx';
import { LocalDatabase } from '../types';

export const DB_FILE_NAME = 'BASE.xlsx';
const STORAGE_KEY = 'MAESTRO_LOCAL_DB';
const DB_SHEET_INDEX = 0;

/**
 * Procesa un buffer de Excel y lo convierte al formato LocalDatabase
 */
const processWorkbook = (buffer: ArrayBuffer, name: string, source: LocalDatabase['source']): LocalDatabase => {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[DB_SHEET_INDEX];
  const worksheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

  if (json.length === 0) {
    throw new Error("El archivo no contiene filas de datos.");
  }

  return {
    name,
    headers: Object.keys(json[0] as object),
    rows: json,
    lastUpdated: new Date().toLocaleString(),
    fileSize: buffer.byteLength,
    source
  };
};

/**
 * Carga archivo manual (Upload)
 */
export const parseUploadedFile = async (file: File): Promise<LocalDatabase> => {
  const buffer = await file.arrayBuffer();
  const db = processWorkbook(buffer, file.name, 'upload');
  saveLocalDb(db);
  return db;
};

/**
 * Intenta cargar BASE.xlsx desde la carpeta pública (Automático)
 */
export const loadExcelFromPublic = async (): Promise<LocalDatabase | null> => {
  try {
    const response = await fetch(`/${DB_FILE_NAME}`, { cache: "no-store" });
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const db = processWorkbook(buffer, DB_FILE_NAME, 'public');
    saveLocalDb(db);
    return db;
  } catch (err) {
    console.warn("No se encontró el archivo base en /public.");
    return null;
  }
};

export const saveLocalDb = (db: LocalDatabase) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
};

export const loadDbFromCache = (): LocalDatabase | null => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return null;
  const db = JSON.parse(data) as LocalDatabase;
  return { ...db, source: 'cache' };
};

export const clearLocalDb = () => {
  localStorage.removeItem(STORAGE_KEY);
};
