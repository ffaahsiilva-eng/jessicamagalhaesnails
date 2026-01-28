import { useState, useCallback } from "react";

interface UseRetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
  onMaxRetriesReached?: (error: Error) => void;
}

export const useRetry = <T>(
  asyncFn: () => Promise<T>,
  options: UseRetryOptions = {}
) => {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    onRetry,
    onMaxRetriesReached,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const execute = useCallback(async (): Promise<T | null> => {
    setIsLoading(true);
    setError(null);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await asyncFn();
        setRetryCount(0);
        setIsLoading(false);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        if (attempt === maxRetries) {
          setError(error);
          setIsLoading(false);
          onMaxRetriesReached?.(error);
          return null;
        }

        setRetryCount(attempt + 1);
        onRetry?.(attempt + 1, error);

        // Exponential backoff with jitter
        const delay = Math.min(
          baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
          maxDelay
        );
        
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    setIsLoading(false);
    return null;
  }, [asyncFn, maxRetries, baseDelay, maxDelay, onRetry, onMaxRetriesReached]);

  const reset = useCallback(() => {
    setError(null);
    setRetryCount(0);
    setIsLoading(false);
  }, []);

  return {
    execute,
    isLoading,
    error,
    retryCount,
    reset,
    hasRetriesLeft: retryCount < maxRetries,
  };
};
