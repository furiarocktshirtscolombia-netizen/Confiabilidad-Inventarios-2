
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

export const analyzeData = async (csvContent: string): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Analyze the following CSV data and provide a structured summary, key insights, and suggested actions.
    The output must be a JSON object matching the requested schema.
    
    DATA:
    ${csvContent.slice(0, 5000)} // Truncate for token limits if necessary
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
    return JSON.parse(response.text || '{}') as AnalysisResult;
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    throw new Error("Analysis failed");
  }
};
