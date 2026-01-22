
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

export const analyzeData = async (dataContent: string): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Eres un Analista de Datos experto. Analiza la siguiente base de datos cargada desde un Excel local.
    Proporciona un resumen ejecutivo, hallazgos clave (mínimo 3) y sugerencias de acciones estratégicas (mínimo 2).
    
    ESTRUCTURA DE DATOS (CSV):
    ${dataContent.slice(0, 10000)}
    
    Responde ÚNICAMENTE con un objeto JSON siguiendo este esquema:
    {
      "summary": "texto",
      "insights": ["punto 1", "punto 2"],
      "suggestedActions": ["accion 1", "accion 2"]
    }
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          insights: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING } 
          },
          suggestedActions: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING } 
          }
        },
        required: ["summary", "insights", "suggestedActions"]
      }
    }
  });

  try {
    const text = response.text || '{}';
    return JSON.parse(text) as AnalysisResult;
  } catch (e) {
    console.error("Fallo al parsear respuesta de Gemini", e);
    throw new Error("Analysis failed");
  }
};
