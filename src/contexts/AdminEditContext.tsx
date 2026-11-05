import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";
import { useAdminRole } from "@/hooks/useAdminRole";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface ImageModalData {
  settingKey: string;
  defaultImage: string;
  title?: string;
}

interface AdminEditContextType {
  isEditMode: boolean;
  toggleEditMode: () => Promise<void>;
  isAdmin: boolean;
  isLoading: boolean;
  isSaving: boolean;
  draftSettings: Record<string, string>;
  setDraftSetting: (key: string, value: string) => void;
  getDraftSetting: (key: string, fallback?: string) => string;
  saveAllChanges: () => Promise<void>;
  exitWithoutSaving: () => void;
  hasPendingChanges: boolean;
  pendingCount: number;
  // Image modal
  imageModalData: ImageModalData | null;
  openImageModal: (settingKey: string, defaultImage: string, title?: string) => void;
  closeImageModal: () => void;
  // Style Drawer for bars & colors
  isStyleDrawerOpen: boolean;
  setIsStyleDrawerOpen: (open: boolean) => void;
}

const AdminEditContext = createContext<AdminEditContextType | undefined>(undefined);

export const AdminEditProvider = ({ children }: { children: ReactNode }) => {
  const { isAdmin, isLoading } = useAdminRole();
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftSettings, setDraftSettings] = useState<Record<string, string>>({});
  const [imageModalData, setImageModalData] = useState<ImageModalData | null>(null);
  const [isStyleDrawerOpen, setIsStyleDrawerOpen] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const setDraftSetting = useCallback((key: string, value: string) => {
    setDraftSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const getDraftSetting = useCallback(
    (key: string, fallback: string = "") => {
      return draftSettings[key] !== undefined ? draftSettings[key] : fallback;
    },
    [draftSettings]
  );

  const saveAllChanges = useCallback(async () => {
    const keys = Object.keys(draftSettings);
    if (keys.length === 0) return;

    setIsSaving(true);
    try {
      const records = keys.map((key) => ({
        key,
        value: draftSettings[key],
        updated_at: new Date().toISOString(),
      }));

      // Upsert batch
      const { error } = await supabase
        .from("site_settings")
        .upsert(records, { onConflict: "key" });

      if (error) {
        // Fallback item by item
        for (const [k, v] of Object.entries(draftSettings)) {
          await supabase.from("site_settings").upsert(
            { key: k, value: v, updated_at: new Date().toISOString() },
            { onConflict: "key" }
          );
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["site-settings-admin"] });

      setDraftSettings({});
      toast({
        title: "Alterações salvas!",
        description: `${keys.length} item(ns) salvo(s) automaticamente com sucesso.`,
      });
    } catch (err: unknown) {
      console.error("Erro ao salvar edições:", err);
      toast({
        title: "Erro ao salvar",
        description: (err as Error).message || "Não foi possível salvar as alterações.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [draftSettings, queryClient, toast]);

  const toggleEditMode = useCallback(async () => {
    if (!isAdmin) return;

    if (isEditMode) {
      // Exiting edit mode -> Auto-save all changes!
      if (Object.keys(draftSettings).length > 0) {
        await saveAllChanges();
      }
      setIsEditMode(false);
      setIsStyleDrawerOpen(false);
      setImageModalData(null);
      toast({
        title: "Modo de edição finalizado",
        description: "Suas alterações estão salvas e ativas no site.",
      });
    } else {
      setIsEditMode(true);
      toast({
        title: "Modo de edição ativado",
        description: "Clique em qualquer texto para digitar ou trocar cor e fonte. Suas alterações salvam automaticamente ao sair.",
      });
    }
  }, [isAdmin, isEditMode, draftSettings, saveAllChanges, toast]);

  const exitWithoutSaving = useCallback(() => {
    if (Object.keys(draftSettings).length > 0) {
      const confirmDiscard = window.confirm(
        "Deseja sair sem salvar? Todas as alterações não salvas serão descartadas."
      );
      if (!confirmDiscard) return;
    }

    setDraftSettings({});
    setIsEditMode(false);
    setIsStyleDrawerOpen(false);
    setImageModalData(null);
    toast({
      title: "Edições descartadas",
      description: "Você saiu do modo de edição sem salvar as alterações.",
    });
  }, [draftSettings, toast]);

  const openImageModal = useCallback((settingKey: string, defaultImage: string, title?: string) => {
    setImageModalData({ settingKey, defaultImage, title });
  }, []);

  const closeImageModal = useCallback(() => {
    setImageModalData(null);
  }, []);

  const pendingCount = Object.keys(draftSettings).length;
  const hasPendingChanges = pendingCount > 0;

  return (
    <AdminEditContext.Provider
      value={{
        isEditMode,
        toggleEditMode,
        exitWithoutSaving,
        isAdmin,
        isLoading,
        isSaving,
        draftSettings,
        setDraftSetting,
        getDraftSetting,
        saveAllChanges,
        hasPendingChanges,
        pendingCount,
        imageModalData,
        openImageModal,
        closeImageModal,
        isStyleDrawerOpen,
        setIsStyleDrawerOpen,
      }}
    >
      {children}
    </AdminEditContext.Provider>
  );
};

export const useAdminEdit = () => {
  const context = useContext(AdminEditContext);
  if (!context) {
    return {
      isEditMode: false,
      toggleEditMode: async () => {},
      exitWithoutSaving: () => {},
      isAdmin: false,
      isLoading: false,
      isSaving: false,
      draftSettings: {},
      setDraftSetting: () => {},
      getDraftSetting: (_key: string, fallback: string = "") => fallback,
      saveAllChanges: async () => {},
      hasPendingChanges: false,
      pendingCount: 0,
      imageModalData: null,
      openImageModal: () => {},
      closeImageModal: () => {},
      isStyleDrawerOpen: false,
      setIsStyleDrawerOpen: () => {},
    };
  }
  return context;
};
