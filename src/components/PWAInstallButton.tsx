import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Share2, PlusSquare, X, Smartphone, Sparkles, MoreVertical } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('pwa_prompt_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  // Si ya está ejecutándose como aplicación instalada (standalone) o el usuario lo descartó en esta sesión
  if (isInstalled || dismissed) {
    return null;
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(true);
    try {
      sessionStorage.setItem('pwa_prompt_dismissed', 'true');
    } catch {}
  };

  const handleInstallClick = async () => {
    // 1. Si el navegador soporta el diálogo nativo directo (Android / Chromium), dispararlo automáticamente
    if (isInstallable) {
      const success = await install();
      if (success) return;
    }

    // 2. Si no se ha capturado el evento nativo o es iOS/Android sin prompt directo, mostrar la guía adaptada
    setShowGuide(true);
  };

  return (
    <>
      {/* Banner / Botón de Instalación PWA */}
      <div className="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-3 sm:p-3.5 shadow-lg flex items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-400">
            <Smartphone className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
                Instalar ComboxBanks
              </span>
              <span className="inline-flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                <Sparkles className="w-2.5 h-2.5" /> App
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {isAndroid
                ? 'Toca para instalar directamente en tu Android'
                : isIOS
                ? 'Úsala en iOS sin barra de navegación'
                : 'Instala la app en tu dispositivo para acceso rápido'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            className="px-3 py-1.5 sm:px-3.5 sm:py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950/40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Instalar</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 text-slate-400 hover:text-slate-300 hover:bg-slate-800 rounded-xl transition-colors"
            title="Descartar por ahora"
            aria-label="Descartar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Modal Guía de Instalación según el Sistema Operativo */}
      {showGuide && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl relative space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    {isAndroid
                      ? 'Instalar en Android'
                      : isIOS
                      ? 'Instalar en iPhone / iPad'
                      : 'Instalar Aplicación'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Añade la app a tu pantalla de inicio
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isAndroid ? (
              /* Instrucciones para Android */
              <div className="space-y-3 text-xs text-slate-300">
                <div className="flex items-start gap-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
                  <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 text-emerald-400 font-bold font-mono text-[11px]">
                    1
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-semibold text-white">
                      <span>Toca el menú</span>
                      <MoreVertical className="w-3.5 h-3.5 text-emerald-400 inline" />
                      <span>(3 puntos)</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      En la esquina superior derecha de Google Chrome o de tu navegador.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
                  <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 text-emerald-400 font-bold font-mono text-[11px]">
                    2
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-semibold text-white">
                      <span>Selecciona</span>
                      <Download className="w-3.5 h-3.5 text-emerald-400 inline" />
                      <span>"Instalar aplicación"</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      O la opción "Agregar a la pantalla principal".
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
                  <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 text-emerald-400 font-bold font-mono text-[11px]">
                    3
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-semibold text-white">Confirma "Instalar"</p>
                    <p className="text-[11px] text-slate-400">
                      La app se guardará en tu teléfono y abrirá en pantalla completa sin barra de navegación.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* Instrucciones para iOS */
              <div className="space-y-3 text-xs text-slate-300">
                <div className="flex items-start gap-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
                  <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 text-emerald-400 font-bold font-mono text-[11px]">
                    1
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-semibold text-white">
                      <span>Toca el botón</span>
                      <Share2 className="w-3.5 h-3.5 text-blue-400 inline" />
                      <span>Compartir</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      En la barra inferior de Safari en tu iPhone.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
                  <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 text-emerald-400 font-bold font-mono text-[11px]">
                    2
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-semibold text-white">
                      <span>Selecciona</span>
                      <PlusSquare className="w-3.5 h-3.5 text-emerald-400 inline" />
                      <span>Agregar a inicio</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Desliza hacia abajo en las opciones hasta encontrar "Agregar a pantalla de inicio".
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
                  <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 text-emerald-400 font-bold font-mono text-[11px]">
                    3
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-semibold text-white">Toca "Agregar"</p>
                    <p className="text-[11px] text-slate-400">
                      ¡Listo! Se creará el acceso directo como una app independiente sin barras del navegador.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
