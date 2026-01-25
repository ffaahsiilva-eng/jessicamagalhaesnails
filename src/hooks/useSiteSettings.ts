import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SiteSetting {
  id: string;
  key: string;
  value: string;
  label: string | null;
  type: string;
  category: string;
  updated_at: string;
}

export const useSiteSettings = () => {
  const { data: settings, isLoading, error } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*");

      if (error) throw error;
      
      // Convert to a key-value map for easy access
      const settingsMap: Record<string, string> = {};
      data?.forEach((setting: SiteSetting) => {
        settingsMap[setting.key] = setting.value;
      });
      
      return settingsMap;
    },
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });

  const getSetting = useCallback(
    (key: string, fallback: string = "") => settings?.[key] || fallback,
    [settings]
  );

  return {
    settings: settings || {},
    isLoading,
    error,
    getSetting,
  };
};

export const useSiteSettingsAdmin = () => {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["site-settings-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .order("category", { ascending: true });

      if (error) throw error;
      return data as SiteSetting[];
    },
  });

  const updateSetting = async (key: string, value: string) => {
    const { error } = await supabase
      .from("site_settings")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("key", key);

    if (error) throw error;

    queryClient.invalidateQueries({ queryKey: ["site-settings"] });
    queryClient.invalidateQueries({ queryKey: ["site-settings-admin"] });
  };

  return {
    settings: settings || [],
    isLoading,
    updateSetting,
  };
};
