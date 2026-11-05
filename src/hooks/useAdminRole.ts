import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useAdminRole = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkAdminRole = async (isInitial = false) => {
      if (isInitial) {
        setIsLoading(true);
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsAdmin(false);
        setUserId(null);
        setIsLoading(false);
        return;
      }

      setUserId(user.id);

      // Verificação por role no banco ou e-mail cadastrado de admin
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      const hasAdminRole = !!data && !error;
      const isKnownAdmin = user.email === "jessica@gmail.com";

      setIsAdmin(hasAdminRole || isKnownAdmin);
      setIsLoading(false);
    };

    checkAdminRole(true);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Evita disparar reload de estado e telas de loading no foco de janela
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        checkAdminRole(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { isAdmin, isLoading, userId };
};
