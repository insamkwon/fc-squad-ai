/**
 * Gemini API client wrapper for the AI squad parser.
 *
 * Uses the Google Generative AI SDK (@google/generative-ai) with
 * the Gemini 2.0 Flash model for fast, cost-effective structured
 * output generation.
 *
 * Environment: GOOGLE_GENERATIVE_AI_KEY or GEMINI_API_KEY
 */

import { GoogleGenerativeAI, type GenerateContentResult } from '@google/generative-ai';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_MODEL = 'gemini-2.0-flash';
const MAX_TOKENS = 2048;
const REQUEST_TIMEOUT_MS = 10_000; // 10 seconds — must respond quickly

/** Get API key from environment */
function getApiKey(): string | null {
  // Try Google's standard env var first, then our custom one
  return (
    process.env.GOOGLE_GENERATIVE_AI_KEY ??
    process.env.GEMINI_API_KEY ??
    null
  );
}

// ---------------------------------------------------------------------------
// Client Singleton
// ---------------------------------------------------------------------------

let clientInstance: GoogleGenerativeAI | null = null;
let clientModelId: string | null = null;

function getClient(modelId?: string): GoogleGenerativeAI | null {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const effectiveModelId = modelId ?? DEFAULT_MODEL;

  // Reuse client if API key hasn't changed and same model
  if (clientInstance && clientModelId === effectiveModelId) {
    return clientInstance;
  }

  clientInstance = new GoogleGenerativeAI(apiKey);
  clientModelId = effectiveModelId;
  return clientInstance;
}

// ---------------------------------------------------------------------------
// API Call
// ---------------------------------------------------------------------------

export interface GeminiRequestOptions {
  /** Model ID (default: gemini-2.0-flash) */
  model?: string;
  /** System prompt */
  systemPrompt: string;
  /** User prompt */
  userPrompt: string;
  /** Temperature for response randomness (0.0 - 1.0). Lower = more deterministic */
  temperature?: number;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
}

export interface GeminiResponse {
  /** The raw text response from the model */
  text: string;
  /** Whether the request was successful */
  success: boolean;
  /** Error message if the request failed */
  error?: string;
  /** Time taken in milliseconds */
  durationMs: number;
}

/**
 * Send a prompt to the Gemini API and get the text response.
 * Returns a GeminiResponse with the result or error.
 */
export async function callGemini(options: GeminiRequestOptions): Promise<GeminiResponse> {
  const {
    model: modelId,
    systemPrompt,
    userPrompt,
    temperature = 0.1, // Low temperature for structured/consistent output
    timeoutMs = REQUEST_TIMEOUT_MS,
  } = options;

  const startTime = Date.now();

  // Check if API key is configured
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      text: '',
      success: false,
      error: 'Gemini API key not configured. Set GOOGLE_GENERATIVE_AI_KEY or GEMINI_API_KEY environment variable.',
      durationMs: Date.now() - startTime,
    };
  }

  const client = getClient(modelId);
  if (!client) {
    return {
      text: '',
      success: false,
      error: 'Failed to initialize Gemini client.',
      durationMs: Date.now() - startTime,
    };
  }

  try {
    const effectiveModel = modelId ?? DEFAULT_MODEL;
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: effectiveModel,
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature,
        maxOutputTokens: MAX_TOKENS,
        // Request JSON-like output (no guaranteed JSON mode, but helps)
        responseMimeType: 'application/json',
      },
    });

    // Race against timeout
    const result = await Promise.race([
      model.generateContent(userPrompt),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Gemini request timed out after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);

    const responseText = result.response.text();

    return {
      text: responseText,
      success: true,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Gemini API error';
    return {
      text: '',
      success: false,
      error: message,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Check if the Gemini API is properly configured and available.
 */
export function isGeminiConfigured(): boolean {
  return getApiKey() !== null;
}
