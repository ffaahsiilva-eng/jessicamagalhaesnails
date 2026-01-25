import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const queryClient = useQueryClient();

  const syncData = useCallback(async () => {
    console.log('Sincronizando dados...');
    
    // Invalidate all queries to refetch fresh data
    await queryClient.invalidateQueries();
    
    toast.success('Dados sincronizados!', {
      description: 'Todas as informações foram atualizadas.',
      duration: 3000,
    });
  }, [queryClient]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      
      if (wasOffline) {
        toast.info('Conexão restaurada!', {
          description: 'Sincronizando dados...',
          duration: 2000,
        });
        
        // Small delay to ensure connection is stable
        setTimeout(() => {
          syncData();
        }, 1000);
      }
      
      setWasOffline(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      
      toast.warning('Você está offline', {
        description: 'Os dados em cache continuam disponíveis.',
        duration: 4000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline, syncData]);

  return { isOnline, syncData };
};
