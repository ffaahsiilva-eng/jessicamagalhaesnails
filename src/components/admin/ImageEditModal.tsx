import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Link as LinkIcon, RotateCcw, Check, Loader2, Image as ImageIcon } from "lucide-react";
import { useAdminEdit } from "@/contexts/AdminEditContext";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ImageEditModal = () => {
  const { imageModalData, closeImageModal, setDraftSetting, getDraftSetting } = useAdminEdit();
  const { getSetting } = useSiteSettings();
  const { toast } = useToast();
  const [urlInput, setUrlInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!imageModalData) return null;

  const { settingKey, defaultImage, title } = imageModalData;
  const currentImage = getDraftSetting(settingKey) || getSetting(settingKey, defaultImage);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Arquivo inválido",
        description: "Selecione um arquivo de imagem (PNG, JPG, WEBP).",
        variant: "destructive",
      });
      return;
    }

    // 1. Atualização instantânea em tempo real via DataURL
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setDraftSetting(settingKey, event.target.result as string);
      }
    };
    reader.readAsDataURL(file);

    // 2. Upload para o Supabase Storage em segundo plano
    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${settingKey}-${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("gallery-images")
        .upload(fileName, file, { upsert: true });

      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage
          .from("gallery-images")
          .getPublicUrl(uploadData.path);
        if (urlData?.publicUrl) {
          setDraftSetting(settingKey, urlData.publicUrl);
        }
      }
      toast({
        title: "Imagem atualizada!",
        description: "A foto foi alterada em tempo real e será salva ao sair do modo edição.",
      });
    } catch (err: unknown) {
      console.warn("Upload storage error, mantendo DataURL local:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleApplyUrl = () => {
    if (!urlInput.trim()) return;
    setDraftSetting(settingKey, urlInput.trim());
    setUrlInput("");
    toast({
      title: "Foto atualizada!",
      description: "A imagem foi aplicada na tela em tempo real.",
    });
  };

  const handleReset = () => {
    setDraftSetting(settingKey, defaultImage);
    toast({
      title: "Foto restaurada!",
      description: "A foto voltou para a original.",
    });
  };

  return (
    <Dialog open={!!imageModalData} onOpenChange={(open) => !open && closeImageModal()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            {title || "Mudar Foto em Tempo Real"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Visual Preview */}
          <div className="relative aspect-video max-h-56 w-full rounded-xl overflow-hidden border border-border bg-secondary/30 flex items-center justify-center">
            {currentImage ? (
              <img
                src={currentImage}
                alt="Prévia da imagem"
                className="w-full h-full object-contain"
              />
            ) : (
              <p className="text-muted-foreground text-sm font-body">Nenhuma foto selecionada</p>
            )}
            {isUploading && (
              <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center gap-2 text-primary">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-xs font-medium">Otimizando foto...</span>
              </div>
            )}
          </div>

          {/* Option 1: Upload from device */}
          <div className="space-y-2">
            <Label className="font-body text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Opção 1: Enviar do seu dispositivo
            </Label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-dashed border-2 hover:border-primary hover:bg-primary/5 font-body"
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2 text-primary" />
              )}
              Escolher Foto do Computador / Celular
            </Button>
          </div>

          {/* Option 2: Paste URL */}
          <div className="space-y-2">
            <Label className="font-body text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Opção 2: Ou colar link (URL) da internet
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="https://exemplo.com/minha-foto.jpg"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="text-sm font-body"
              />
              <Button type="button" onClick={handleApplyUrl} disabled={!urlInput.trim()} size="sm">
                <Check className="h-4 w-4 mr-1" />
                Aplicar
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={handleReset}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Restaurar Original
          </Button>
          <Button type="button" onClick={closeImageModal} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            Concluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImageEditModal;

