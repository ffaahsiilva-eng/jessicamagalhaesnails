import { Wifi, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export const ConnectionStatus = () => {
  const { isOnline } = useOnlineStatus();

  return (
    <AnimatePresence mode="wait">
      {!isOnline && (
        <motion.div
          key="offline-banner"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white py-2 px-4 text-center text-sm font-medium flex items-center justify-center gap-2"
        >
          <WifiOff className="w-4 h-4" />
          Modo offline - dados em cache
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const ConnectionIndicator = () => {
  const { isOnline } = useOnlineStatus();

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {isOnline ? (
        <>
          <Wifi className="w-3.5 h-3.5 text-green-500" />
          <span className="text-muted-foreground">Online</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-amber-600">Offline</span>
        </>
      )}
    </div>
  );
};
