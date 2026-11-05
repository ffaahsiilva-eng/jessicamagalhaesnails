import { Pencil, Check, Palette, Loader2, Save, X } from "lucide-react";
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
    exitWithoutSaving,
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
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-1.5 sm:gap-2 bg-card/95 backdrop-blur-md border border-primary/30 shadow-2xl rounded-full px-3 sm:px-4 py-2 animate-in slide-in-from-top-4 duration-300 max-w-[95vw]">
          <div className="flex items-center gap-1.5 sm:gap-2 pr-2 border-r border-border shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="font-display font-semibold text-xs sm:text-sm text-foreground whitespace-nowrap">
              Modo Edição
            </span>
          </div>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setIsStyleDrawerOpen(true)}
            className="h-8 px-2 sm:px-2.5 text-xs font-body gap-1.5 hover:bg-primary/10 hover:text-primary shrink-0"
            title="Mudar cores da faixa rolante, rodapé e seções"
          >
            <Palette className="h-3.5 w-3.5 text-primary" />
            <span className="hidden md:inline">Cores de Barras</span>
          </Button>

          {pendingCount > 0 && (
            <span className="text-[11px] font-body text-primary font-medium hidden lg:inline px-1">
              {pendingCount} alteração(ões) pendente(s)
            </span>
          )}

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={exitWithoutSaving}
            className="h-8 px-2.5 text-xs font-body text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1 rounded-full transition-colors shrink-0"
            title="Descartar alterações e sair do modo de edição sem salvar"
          >
            <X className="h-3.5 w-3.5 text-destructive" />
            <span className="hidden sm:inline">Sair sem salvar</span>
            <span className="sm:hidden text-destructive font-medium">Descartar</span>
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={isSaving}
            onClick={toggleEditMode}
            className="h-8 px-3 text-xs font-body bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 rounded-full shadow-md shrink-0"
            title="Ao sair do modo de edição, todas as alterações são salvas automaticamente"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Sair e Salvar</span>
            <span className="sm:hidden">Salvar</span>
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
