import { Pencil, PencilOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminEdit } from "@/contexts/AdminEditContext";
import { cn } from "@/lib/utils";

const AdminEditToggle = () => {
  const { isAdmin, isEditMode, toggleEditMode, isLoading } = useAdminEdit();

  if (isLoading || !isAdmin) {
    return null;
  }

  return (
    <Button
      variant={isEditMode ? "default" : "outline"}
      size="sm"
      onClick={toggleEditMode}
      className={cn(
        "fixed bottom-36 right-4 z-50 shadow-lg gap-2 transition-all",
        isEditMode
          ? "bg-primary hover:bg-primary/90 text-primary-foreground"
          : "bg-card hover:bg-accent border-border"
      )}
    >
      {isEditMode ? (
        <>
          <PencilOff className="h-4 w-4" />
          Sair do Modo Edição
        </>
      ) : (
        <>
          <Pencil className="h-4 w-4" />
          Modo Edição
        </>
      )}
    </Button>
  );
};

export default AdminEditToggle;
