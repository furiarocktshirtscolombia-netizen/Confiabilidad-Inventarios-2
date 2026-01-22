
import * as XLSX from 'xlsx';
import { LocalDatabase } from '../types';

const STORAGE_KEY = 'MAESTRO_LOCAL_DB';

export const parseExcelFile = async (file: File): Promise<LocalDatabase> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        
        if (json.length === 0) {
          throw new Error("El archivo no contiene filas de datos.");
        }

        const db: LocalDatabase = {
          name: file.name,
          headers: Object.keys(json[0] as object),
          rows: json,
          lastUpdated: new Date().toLocaleString(),
          fileSize: file.size
        };
        
        resolve(db);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Error al leer el archivo."));
    reader.readAsBinaryString(file);
  });
};

export const saveLocalDb = (db: LocalDatabase) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
};

export const loadLocalDb = (): LocalDatabase | null => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : null;
};

export const clearLocalDb = () => {
  localStorage.removeItem(STORAGE_KEY);
};
