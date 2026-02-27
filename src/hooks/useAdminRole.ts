import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useAdminRole = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const checkInProgress = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const checkAdminRole = async () => {
      if (checkInProgress.current) return;
      checkInProgress.current = true;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (cancelled) return;

        if (!session?.user) {
          setIsAdmin(false);
          setUserId(null);
          setIsLoading(false);
          return;
        }

        setUserId(session.user.id);

        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (cancelled) return;

        setIsAdmin(!!data && !error);
        setIsLoading(false);
      } catch (err) {
        if (cancelled) return;
        // Ignore AbortErrors
        if (err instanceof Error && err.name === "AbortError") return;
        setIsAdmin(false);
        setIsLoading(false);
      } finally {
        checkInProgress.current = false;
      }
    };

    checkAdminRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        checkInProgress.current = false;
        checkAdminRole();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { isAdmin, isLoading, userId };
};
