import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useAdminRole = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkAdminRole = async (isInitial = false) => {
      if (isInitial && isMounted) {
        setIsLoading(true);
      }
      
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user ?? null;
        
        if (!user) {
          if (isMounted) {
            setIsAdmin(false);
            setUserId(null);
            setIsLoading(false);
          }
          return;
        }

        if (isMounted) {
          setUserId(user.id);
        }

        // Verificação por role no banco ou e-mail cadastrado de admin
        const { data: roleData, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        const hasAdminRole = !!roleData && !error;
        const isKnownAdmin = user.email === "jessica@gmail.com";

        if (isMounted) {
          setIsAdmin(hasAdminRole || isKnownAdmin);
        }
      } catch (err) {
        console.warn("Error checking admin role:", err);
        if (isMounted) {
          setIsAdmin(false);
          setUserId(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    checkAdminRole(true);

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        checkAdminRole(false);
      }
    });

    return () => {
      isMounted = false;
      data?.subscription?.unsubscribe();
    };
  }, []);

  return { isAdmin, isLoading, userId };
};
