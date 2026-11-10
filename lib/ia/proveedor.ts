import { ClienteGemini } from "./gemini";
import { ClienteGroq, MODELO_GROQ_POR_DEFECTO } from "./groq";
import { ModeloConRespaldo } from "./respaldo";
import type { ModeloIA } from "./tipos";

/**
 * Modelo de IA según las variables de entorno (patrón Factory):
 *  - GROQ_API_KEY y GEMINI_API_KEY → Groq, con Gemini de respaldo automático
 *  - solo una de las dos           → ese proveedor
 *  - ninguna                       → null (el sistema funciona sin el agente y con explicaciones básicas)
 */
export function modeloDesdeEntorno(entorno: Record<string, string | undefined> = process.env): ModeloIA | null {
  const claveGroq = entorno.GROQ_API_KEY?.trim();
  const groq = claveGroq ? new ClienteGroq(claveGroq, entorno.GROQ_MODEL?.trim() || MODELO_GROQ_POR_DEFECTO) : null;
  const gemini = ClienteGemini.desdeEntorno(entorno);
  if (groq && gemini) return new ModeloConRespaldo(groq, gemini, "groq");
  return groq ?? gemini;
}
