import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_URL = 'https://htxzsefmejercvwlarfl.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0eHpzZWZtZWplcmN2d2xhcmZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMzE2NjIsImV4cCI6MjEwNDgwNzY2Mn0.oxjaY99j5dvFWfOPiXSVCigc1MKKLxTXMjNB1m_IxVw';

const ENV_SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const ENV_SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

let supabaseInstance: SupabaseClient | null = null;

export function cleanSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let cleaned = rawUrl.trim();
  cleaned = cleaned.replace(/\/functions\/.*$/i, '');
  cleaned = cleaned.replace(/\/rest\/.*$/i, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
}

export function getSupabaseConfig(): { url: string; anonKey: string; isConfigured: boolean } {
  const rawUrl =
    ENV_SUPABASE_URL ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('sb_project_url') || '' : '') ||
    DEFAULT_SUPABASE_URL;
  const url = cleanSupabaseUrl(rawUrl);
  const anonKey =
    ENV_SUPABASE_ANON_KEY ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('sb_anon_key') || '' : '') ||
    DEFAULT_SUPABASE_ANON_KEY;

  return {
    url,
    anonKey,
    isConfigured: Boolean(url && anonKey),
  };
}

export function saveSupabaseConfig(rawUrl: string, anonKey: string) {
  const url = cleanSupabaseUrl(rawUrl);
  if (typeof localStorage !== 'undefined') {
    if (url) localStorage.setItem('sb_project_url', url);
    else localStorage.removeItem('sb_project_url');

    if (anonKey) localStorage.setItem('sb_anon_key', anonKey.trim());
    else localStorage.removeItem('sb_anon_key');
  }
  supabaseInstance = null;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const { url, anonKey } = getSupabaseConfig();
  if (url && anonKey) {
    try {
      supabaseInstance = createClient(url, anonKey);
      return supabaseInstance;
    } catch {
      // Ignorar errores de instanciación silenciosamente
    }
  }

  return null;
}

/**
 * Función central callSupabase() con arquitectura serverless y fallback de 2 capas:
 * 1. Intento por proxy local (/api/...)
 * 2. Fallback a Supabase Edge Function ('swift-handler') en Brasil (sa-east-1)
 */
export async function callSupabase<T = any>(
  action: string,
  payload: Record<string, any> = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  // 1. Normalización de fechas si aplica
  const processedPayload = { ...payload };
  if (action === 'binance' && processedPayload.fechaPago) {
    const parts = String(processedPayload.fechaPago).split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      processedPayload.fechaPago = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }

  const requestBody = { action, ...processedPayload };

  // 2. Capa 1: Intento por proxy local Express (desarrollo local)
  try {
    const localRes = await fetch(`/api/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(processedPayload),
      signal: AbortSignal.timeout(3500),
    });
    if (localRes.ok) {
      const contentType = localRes.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await localRes.json();
        return { success: true, data: json };
      }
    }
  } catch {
    // Si no hay backend local (ej. GitHub Pages), continuar directamente a Supabase Edge Function
  }

  // 3. Capa 2: Consulta directa a Supabase Edge Function ('swift-handler')
  const { url, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    return { success: false, error: 'No backend or Supabase configuration available' };
  }

  const endpoint = `${url}/functions/v1/swift-handler`;

  try {
    const directResp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
        'x-region': 'sa-east-1',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(12000),
    });

    if (directResp.ok) {
      const directJson = await directResp.json();
      return { success: true, data: directJson };
    }
  } catch (err: any) {
    // Fallback con SDK de Supabase si fetch directo falló por CORS o red
    try {
      const client = getSupabaseClient();
      if (client) {
        const { data, error } = await client.functions.invoke('swift-handler', {
          body: requestBody,
          headers: { 'x-region': 'sa-east-1' },
        });

        if (!error && data) {
          return { success: true, data };
        }
      }
    } catch {}

    return { success: false, error: err?.message || 'Error invocando Edge Function' };
  }

  return { success: false, error: 'Respuesta no disponible de Supabase' };
}
