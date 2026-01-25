import { useState, useRef, useEffect } from "react";
import { Settings, Loader2, Upload, X, Save, Phone, Type, Image as ImageIcon, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useSiteSettingsAdmin, SiteSetting } from "@/hooks/useSiteSettings";
import { supabase } from "@/integrations/supabase/client";

const categoryLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  contact: { label: "Contato", icon: <Phone className="h-4 w-4" /> },
  hero: { label: "Hero", icon: <Type className="h-4 w-4" /> },
  branding: { label: "Marca", icon: <ImageIcon className="h-4 w-4" /> },
  theme: { label: "Tema", icon: <Settings className="h-4 w-4" /> },
};

const SiteSettingsManager = () => {
  const { toast } = useToast();
  const { settings, isLoading, updateSetting } = useSiteSettingsAdmin();
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [uploadingKeys, setUploadingKeys] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Group settings by category
  const groupedSettings = settings.reduce((acc, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = [];
    }
    acc[setting.category].push(setting);
    return acc;
  }, {} as Record<string, SiteSetting[]>);

  const handleChange = (key: string, value: string) => {
    setEditedValues(prev => ({ ...prev, [key]: value }));
  };

  const getValue = (setting: SiteSetting) => {
    return editedValues[setting.key] !== undefined
      ? editedValues[setting.key]
      : setting.value;
  };

  const hasChanges = (key: string, originalValue: string) => {
    return editedValues[key] !== undefined && editedValues[key] !== originalValue;
  };

  const handleSave = async (key: string) => {
    const newValue = editedValues[key];
    if (newValue === undefined) return;

    setSavingKeys(prev => new Set(prev).add(key));

    try {
      await updateSetting(key, newValue);
      setEditedValues(prev => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
      toast({ title: "Configuração salva!" });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingKeys(prev => {
        const updated = new Set(prev);
        updated.delete(key);
        return updated;
      });
    }
  };

  const handleImageUpload = async (key: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione uma imagem.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A imagem deve ter no máximo 5MB.",
        variant: "destructive",
      });
      return;
    }

    setUploadingKeys(prev => new Set(prev).add(key));

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${key}-${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("gallery-images")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("gallery-images")
        .getPublicUrl(uploadData.path);

      await updateSetting(key, urlData.publicUrl);
      toast({ title: "Imagem atualizada!" });
    } catch (error: any) {
      toast({
        title: "Erro ao fazer upload",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingKeys(prev => {
        const updated = new Set(prev);
        updated.delete(key);
        return updated;
      });
    }
  };

  // Get preview values
  const getPreviewValue = (key: string) => {
    const setting = settings.find(s => s.key === key);
    if (!setting) return "";
    return editedValues[key] !== undefined ? editedValues[key] : setting.value;
  };

  const renderField = (setting: SiteSetting) => {
    const isSaving = savingKeys.has(setting.key);
    const isUploading = uploadingKeys.has(setting.key);
    const changed = hasChanges(setting.key, setting.value);

    if (setting.type === "image") {
      const currentValue = getValue(setting);
      return (
        <div className="space-y-2">
          <Label className="font-body">{setting.label}</Label>
          {currentValue ? (
            <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-border">
              <img
                src={currentValue}
                alt={setting.label || ""}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => {
                  updateSetting(setting.key, "");
                }}
                className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRefs.current[setting.key]?.click()}
              className="w-32 h-32 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              {isUploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                <>
                  <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">Upload</span>
                </>
              )}
            </div>
          )}
          <input
            ref={(el) => (fileInputRefs.current[setting.key] = el)}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(setting.key, file);
            }}
            className="hidden"
          />
        </div>
      );
    }

    if (setting.type === "textarea") {
      return (
        <div className="space-y-2">
          <Label className="font-body">{setting.label}</Label>
          <div className="flex gap-2">
            <Textarea
              value={getValue(setting)}
              onChange={(e) => handleChange(setting.key, e.target.value)}
              className="bg-secondary/50 min-h-[80px]"
            />
          </div>
          {changed && (
            <Button
              size="sm"
              onClick={() => handleSave(setting.key)}
              disabled={isSaving}
              className="mt-1"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Salvar
                </>
              )}
            </Button>
          )}
        </div>
      );
    }

    // Default: text input
    return (
      <div className="space-y-2">
        <Label className="font-body">{setting.label}</Label>
        <div className="flex gap-2">
          <Input
            value={getValue(setting)}
            onChange={(e) => handleChange(setting.key, e.target.value)}
            className="bg-secondary/50"
          />
          {changed && (
            <Button
              size="icon"
              onClick={() => handleSave(setting.key)}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const categories = Object.keys(groupedSettings);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Configurações do Site
          </CardTitle>
          <Button
            size="sm"
            variant={showPreview ? "default" : "outline"}
            onClick={() => setShowPreview(!showPreview)}
            className="gap-1.5"
          >
            <Eye className="h-4 w-4" />
            {showPreview ? "Fechar Preview" : "Preview"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Live Preview */}
        {showPreview && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-secondary/50 to-muted/30 border border-border">
            <h4 className="font-body font-medium text-sm text-muted-foreground mb-3">Preview ao Vivo</h4>
            <div className="bg-card rounded-lg p-4 shadow-sm space-y-2">
              <p className="text-xs text-primary uppercase tracking-wider">
                {getPreviewValue("hero_subtitle") || "Nail Designer"}
              </p>
              <h3 className="font-display text-2xl font-semibold">
                {getPreviewValue("hero_title") || "Jéssica Magalhães"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {getPreviewValue("hero_description") || "Descrição do site..."}
              </p>
              <div className="pt-2 border-t border-border mt-2 text-xs text-muted-foreground space-y-1">
                <p>📱 WhatsApp: {getPreviewValue("whatsapp_number") || "..."}</p>
                <p>🕐 {getPreviewValue("business_hours_weekday") || "Seg-Sáb: 9h às 19h"}</p>
              </div>
            </div>
          </div>
        )}

        <Tabs defaultValue={categories[0]} className="w-full">
          <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${categories.length}, 1fr)` }}>
            {categories.map((category) => (
              <TabsTrigger key={category} value={category} className="gap-1.5">
                {categoryLabels[category]?.icon}
                {categoryLabels[category]?.label || category}
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((category) => (
            <TabsContent key={category} value={category} className="space-y-4 mt-4">
              {groupedSettings[category].map((setting) => (
                <div key={setting.id}>{renderField(setting)}</div>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default SiteSettingsManager;
