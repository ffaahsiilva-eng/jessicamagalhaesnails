import { useState, useRef } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminEdit } from "@/contexts/AdminEditContext";
import { useSiteSettingsAdmin } from "@/hooks/useSiteSettings";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface EditableImageProps {
  settingKey: string;
  defaultImage: string;
  alt?: string;
  className?: string;
  overlayClassName?: string;
}

const EditableImage = ({
  settingKey,
  defaultImage,
  alt = "Imagem editável",
  className,
  overlayClassName,
}: EditableImageProps) => {
  const { isEditMode, isAdmin } = useAdminEdit();
  const { settings, updateSetting } = useSiteSettingsAdmin();
  const { toast } = useToast();
  
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentSetting = settings.find((s) => s.key === settingKey);
  const currentImage = currentSetting?.value || defaultImage;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione uma imagem.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A imagem deve ter no máximo 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${settingKey}-${Date.now()}.${fileExt}`;

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("gallery-images")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("gallery-images")
        .getPublicUrl(uploadData.path);

      // Update setting
      await updateSetting(settingKey, urlData.publicUrl);

      toast({ title: "Imagem atualizada com sucesso!" });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Erro ao fazer upload",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleClick = () => {
    if (isAdmin && isEditMode && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  // If not admin or not in edit mode, just render the image
  if (!isAdmin || !isEditMode) {
    return (
      <img
        src={currentImage}
        alt={alt}
        className={className}
      />
    );
  }

  return (
    <div className="relative group cursor-pointer" onClick={handleClick}>
      <img
        src={currentImage}
        alt={alt}
        className={className}
      />
      
      {/* Edit overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center",
          overlayClassName
        )}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-2 text-white">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm font-medium">Enviando...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-white">
            <div className="p-3 rounded-full bg-primary/80 backdrop-blur-sm">
              <Camera className="h-6 w-6" />
            </div>
            <span className="text-sm font-medium">Clique para trocar</span>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
        disabled={isUploading}
      />

      {/* Edit badge */}
      <span className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <span className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground shadow-lg">
          <Camera className="h-4 w-4" />
        </span>
      </span>
    </div>
  );
};

export default EditableImage;
