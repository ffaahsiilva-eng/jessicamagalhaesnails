import { Pencil, Check, Palette, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminEdit } from "@/contexts/AdminEditContext";
import { cn } from "@/lib/utils";
import ImageEditModal from "@/components/admin/ImageEditModal";
import SiteStyleDrawer from "@/components/admin/SiteStyleDrawer";

const AdminEditToggle = () => {
  const {
    isAdmin,
    isEditMode,
    toggleEditMode,
    isLoading,
    isSaving,
    pendingCount,
    setIsStyleDrawerOpen,
  } = useAdminEdit();

  if (isLoading || !isAdmin) {
    return null;
  }

  return (
    <>
      <ImageEditModal />
      <SiteStyleDrawer />

      {isEditMode ? (
        /* Top Floating Control Bar when in Edit Mode */
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-2 bg-card/95 backdrop-blur-md border border-primary/30 shadow-2xl rounded-full px-4 py-2 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2 pr-2 border-r border-border">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-display font-semibold text-xs sm:text-sm text-foreground">
              Modo Edição
            </span>
          </div>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setIsStyleDrawerOpen(true)}
            className="h-8 px-2.5 text-xs font-body gap-1.5 hover:bg-primary/10 hover:text-primary"
            title="Mudar cores da faixa rolante, rodapé e seções"
          >
            <Palette className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Cores de Barras</span>
          </Button>

          {pendingCount > 0 && (
            <span className="text-[11px] font-body text-primary font-medium hidden md:inline px-1">
              {pendingCount} alteração(ões) pendente(s)
            </span>
          )}

          <Button
            type="button"
            size="sm"
            disabled={isSaving}
            onClick={toggleEditMode}
            className="h-8 px-3 text-xs font-body bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 rounded-full shadow-md"
            title="Ao sair do modo de edição, todas as alterações são salvas automaticamente"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            <span>Sair e Salvar</span>
          </Button>
        </div>
      ) : (
        /* Fixed bottom button when edit mode is OFF */
        <Button
          variant="outline"
          size="sm"
          onClick={toggleEditMode}
          className={cn(
            "fixed bottom-36 right-4 z-50 shadow-lg gap-2 transition-all",
            "bg-card hover:bg-accent border-border font-body text-xs"
          )}
        >
          <Pencil className="h-4 w-4 text-primary" />
          Modo Edição
        </Button>
      )}
    </>
  );
};

export default AdminEditToggle;
