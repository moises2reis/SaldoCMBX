import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-xs z-50 flex items-center gap-2.5 rounded-2xl bg-amber-500/90 backdrop-blur-md text-slate-950 px-3.5 py-2.5 text-xs font-semibold shadow-2xl border border-amber-400/50 animate-bounce">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Modo sin conexión. Mostrando datos en caché.</span>
    </div>
  );
};
