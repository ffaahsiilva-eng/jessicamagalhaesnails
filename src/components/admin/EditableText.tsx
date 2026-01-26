import { useState, useRef, useEffect } from "react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAdminEdit } from "@/contexts/AdminEditContext";
import { useSiteSettingsAdmin } from "@/hooks/useSiteSettings";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface EditableTextProps {
  settingKey: string;
  defaultValue: string;
  className?: string;
  multiline?: boolean;
  as?: "h1" | "h2" | "h3" | "p" | "span";
}

const EditableText = ({
  settingKey,
  defaultValue,
  className,
  multiline = false,
  as: Component = "span",
}: EditableTextProps) => {
  const { isEditMode, isAdmin } = useAdminEdit();
  const { settings, updateSetting } = useSiteSettingsAdmin();
  const { toast } = useToast();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const currentSetting = settings.find((s) => s.key === settingKey);
  const currentValue = currentSetting?.value || defaultValue;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    setEditValue(currentValue);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (editValue.trim() === currentValue) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await updateSetting(settingKey, editValue.trim());
      toast({ title: "Salvo com sucesso!" });
      setIsEditing(false);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (!isAdmin || !isEditMode) {
    return <Component className={className}>{currentValue}</Component>;
  }

  if (isEditing) {
    return (
      <div className="inline-flex items-center gap-2 min-w-[200px]">
        {multiline ? (
          <Textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[80px] text-sm"
            disabled={isSaving}
          />
        ) : (
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="text-sm"
            disabled={isSaving}
          />
        )}
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleSave}
            disabled={isSaving}
            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleCancel}
            disabled={isSaving}
            className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <span
      className={cn(
        "group relative inline-block cursor-pointer rounded-md transition-all",
        "ring-2 ring-transparent hover:ring-primary/50 hover:bg-primary/5",
        className
      )}
      onClick={handleStartEdit}
      title="Clique para editar"
    >
      <Component className={className}>{currentValue}</Component>
      <span className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground shadow-md">
          <Pencil className="h-3 w-3" />
        </span>
      </span>
    </span>
  );
};

export default EditableText;
