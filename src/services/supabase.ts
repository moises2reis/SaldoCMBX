import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { debugLogger } from './debugLogger';

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
  supabaseInstance = null;
  debugLogger.addLog('info', 'Supabase', `Configuración guardada. URL: ${url ? url : '(vacía)'}`);
}

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const { url, anonKey } = getSupabaseConfig();
  if (url && anonKey) {
    try {
      supabaseInstance = createClient(url, anonKey);
      return supabaseInstance;
    } catch (e: any) {
      debugLogger.addLog('error', 'Supabase', `Error inicializando SupabaseClient: ${e?.message}`);
    }
  }

  return null;
}

/**
 * Función central callSupabase() con logging detallado y fallback serverless:
 * 1. Intento por proxy local (/api/...)
 * 2. Fallback a Supabase Edge Function ('swift-handler')
 */
export async function callSupabase<T = any>(
  action: string,
  payload: Record<string, any> = {}
): Promise<{ success: boolean; data?: T; error?: string; raw?: any }> {
  // Normalización de fechas si aplica
  const processedPayload = { ...payload };
  if (action === 'binance' && processedPayload.fechaPago) {
    const parts = String(processedPayload.fechaPago).split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      processedPayload.fechaPago = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }

  debugLogger.addLog('info', 'Supabase', `Iniciando petición para acción "${action}"`, {
    action,
    payload: processedPayload,
  });

  // Capa 1: Intento por proxy local Express (desarrollo local)
  try {
    const localRes = await fetch(`/api/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(processedPayload),
    });
    if (localRes.ok) {
      const json = await localRes.json();
      debugLogger.addLog('success', 'Supabase', `Respuesta exitosa desde proxy local (/api/${action})`, json);
      return { success: true, data: json };
    }
  } catch {
    // Si no hay backend local, continuar a Supabase Edge Function
  }

  // Capa 2: Supabase Edge Function ('swift-handler')
  const { url, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    const msg = 'No hay configuración de Supabase (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY no configurados)';
    debugLogger.addLog('warn', 'Supabase', msg);
    return { success: false, error: msg };
  }

  const client = getSupabaseClient();
  if (!client) {
    const msg = 'No se pudo instanciar el cliente de Supabase';
    debugLogger.addLog('error', 'Supabase', msg);
    return { success: false, error: msg };
  }

  const requestBody = { action, ...processedPayload };
  debugLogger.addLog('info', 'Supabase', `Invocando Edge Function 'swift-handler'`, {
    endpoint: `${url}/functions/v1/swift-handler`,
    body: requestBody,
    headers: { 'x-region': 'sa-east-1' },
  });

  try {
    const { data, error } = await client.functions.invoke('swift-handler', {
      body: requestBody,
      headers: { 'x-region': 'sa-east-1' },
    });

    if (error) {
      debugLogger.addLog('error', 'Supabase', `Error devuelto por Edge Function: ${error.message}`, error);
      
      // Intento de inspección HTTP directa para capturar el cuerpo exacto del error o respuesta
      try {
        const directResp = await fetch(`${url}/functions/v1/swift-handler`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${anonKey}`,
            apikey: anonKey,
            'x-region': 'sa-east-1',
          },
          body: JSON.stringify(requestBody),
        });
        const directText = await directResp.text();
        let directJson: any = null;
        try {
          directJson = JSON.parse(directText);
        } catch {}

        debugLogger.addLog(
          directResp.ok ? 'warn' : 'error',
          'Binance',
          `Inspección HTTP Directa (Status ${directResp.status})`,
          directJson || directText
        );

        if (directResp.ok && directJson) {
          return { success: true, data: directJson, raw: directJson };
        }
      } catch (fetchErr: any) {
        debugLogger.addLog('error', 'Supabase', `Fallo en fetch directo: ${fetchErr?.message}`);
      }

      return { success: false, error: error.message, raw: error };
    }

    if (data) {
      debugLogger.addLog('success', 'Binance', `Datos recibidos de swift-handler / Binance`, data);
      return { success: true, data, raw: data };
    }
  } catch (err: any) {
    const errMsg = err?.message || 'Excepción invocando Edge Function';
    debugLogger.addLog('error', 'Supabase', errMsg, err);
    return { success: false, error: errMsg };
  }

  return { success: false, error: 'Respuesta vacía de Supabase' };
}

/**
 * Función de prueba para diagnóstico directo e inspección completa
 */
export async function testSupabaseConnection(customPayload?: any): Promise<{
  success: boolean;
  status: number;
  body: any;
  logs: string[];
}> {
  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
  };

  const { url, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    log('❌ URL o Anon Key no configurados');
    return { success: false, status: 0, body: 'Configuración faltante', logs };
  }

  const payloadToSend = customPayload || { action: 'balance' };
  log(`Conectando a: ${url}/functions/v1/swift-handler`);
  log(`Enviando payload: ${JSON.stringify(payloadToSend)}`);

  try {
    const res = await fetch(`${url}/functions/v1/swift-handler`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
        'x-region': 'sa-east-1',
      },
      body: JSON.stringify(payloadToSend),
    });

    log(`Código de estado HTTP: ${res.status} ${res.statusText}`);
    const text = await res.text();
    log(`Cuerpo de respuesta recibido (${text.length} bytes)`);

    let parsed: any;
    try {
      parsed = JSON.parse(text);
      log(`JSON parseado correctamente: ${JSON.stringify(parsed)}`);
    } catch {
      parsed = text;
      log(`Respuesta no es JSON: ${text}`);
    }

    if (res.ok) {
      debugLogger.addLog('success', 'Binance', 'Prueba de diagnóstico exitosa', parsed);
      return { success: true, status: res.status, body: parsed, logs };
    } else {
      debugLogger.addLog('error', 'Binance', `Prueba de diagnóstico falló (HTTP ${res.status})`, parsed);
      return { success: false, status: res.status, body: parsed, logs };
    }
  } catch (err: any) {
    log(`❌ Error de conexión / CORS: ${err?.message}`);
    debugLogger.addLog('error', 'Supabase', `Error de red en test: ${err?.message}`, err);
    return { success: false, status: 0, body: err?.message, logs };
  }
}
