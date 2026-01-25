import { Wifi, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export const ConnectionStatus = () => {
  const { isOnline } = useOnlineStatus();

  return (
    <>
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-destructive text-destructive-foreground py-2 px-4 text-center text-sm font-medium flex items-center justify-center gap-2 animate-in slide-in-from-top duration-300">
          <WifiOff className="w-4 h-4" />
          Modo offline - dados em cache
        </div>
      )}
    </>
  );
};

export const ConnectionIndicator = () => {
  const { isOnline } = useOnlineStatus();

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {isOnline ? (
        <>
          <Wifi className="w-3.5 h-3.5 text-primary" />
          <span className="text-muted-foreground">Online</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3.5 h-3.5 text-destructive" />
          <span className="text-destructive">Offline</span>
        </>
      )}
    </div>
  );
};
