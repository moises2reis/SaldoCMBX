import { createClient, SupabaseClient } from '@supabase/supabase-js';

const ENV_SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const ENV_SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

let supabaseInstance: SupabaseClient | null = null;

export function cleanSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let cleaned = rawUrl.trim();
  // Quitar rutas si el usuario pegó la URL del endpoint directamente
  cleaned = cleaned.replace(/\/functions\/.*$/i, '');
  cleaned = cleaned.replace(/\/rest\/.*$/i, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
}

export function getSupabaseConfig(): { url: string; anonKey: string; isConfigured: boolean } {
  const rawUrl =
    ENV_SUPABASE_URL ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('sb_project_url') || '' : '');
  const url = cleanSupabaseUrl(rawUrl);
  const anonKey =
    ENV_SUPABASE_ANON_KEY ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('sb_anon_key') || '' : '');

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
  supabaseInstance = null; // Reiniciar instancia
}

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const { url, anonKey } = getSupabaseConfig();
  if (url && anonKey) {
    try {
      supabaseInstance = createClient(url, anonKey);
      return supabaseInstance;
    } catch (e) {
      console.warn('Error inicializando cliente de Supabase:', e);
    }
  }

  return null;
}

/**
 * Función central callSupabase() con arquitectura serverless y fallback de 2 capas:
 * 1. Intento por proxy local (/api/...)
 * 2. Fallback a Supabase Edge Function ('swift-handler')
 */
export async function callSupabase<T = any>(
  action: string,
  payload: Record<string, any> = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  // 1. Normalización de fechas (YYYY-MM-DD -> DD/MM/YYYY) para Binance
  const processedPayload = { ...payload };
  if (action === 'binance' && processedPayload.fechaPago) {
    const parts = String(processedPayload.fechaPago).split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      processedPayload.fechaPago = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }

  // 2. Capa 1: Intento por proxy local (Express / Node.js en desarrollo)
  try {
    const response = await fetch(`/api/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(processedPayload),
    });
    if (response.ok) {
      const json = await response.json();
      return { success: true, data: json };
    }
  } catch (apiErr) {
    // Si falla o no existe backend (ej. en GitHub Pages), continúa al fallback
  }

  // 3. Capa 2: Fallback a Supabase Edge Function ('swift-handler')
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client.functions.invoke('swift-handler', {
        body: { action, ...processedPayload },
        headers: { 'x-region': 'sa-east-1' },
      });

      if (!error && data) {
        return { success: true, data };
      }
      if (error) {
        return { success: false, error: error.message };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error invocando Edge Function' };
    }
  }

  return { success: false, error: 'No backend or Supabase configuration available' };
}
