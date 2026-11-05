import { memo, useState, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Loader2, ImageIcon, Camera, Plus, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import EditableText from "@/components/admin/EditableText";
import { useAdminEdit } from "@/contexts/AdminEditContext";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useToast } from "@/hooks/use-toast";

// Default images (fallback)
import gallery1 from "@/assets/gallery-1.jpg";
import gallery2 from "@/assets/gallery-2.jpg";
import gallery3 from "@/assets/gallery-3.jpg";
import gallery4 from "@/assets/gallery-4.jpg";
const portfolioPortrait = { url: "/media/jessica-portfolio.png" };

const defaultImages = [
  { src: gallery1, alt: "Nail art floral rosa" },
  { src: gallery2, alt: "Manicure nude com dourado" },
  { src: gallery3, alt: "Unhas glitter rose gold" },
  { src: gallery4, alt: "Francesinha com decoração" },
];

const Gallery = memo(() => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [isAddingImage, setIsAddingImage] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const addFileInputRef = useRef<HTMLInputElement>(null);
  const { isEditMode, isAdmin, openImageModal, getDraftSetting } = useAdminEdit();
  const { getSetting } = useSiteSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const portfolioImg =
    getDraftSetting("portfolio_portrait_url") ||
    getSetting("portfolio_portrait_url", "") ||
    portfolioPortrait.url;

  const { data: dbImages, isLoading } = useQuery({
    queryKey: ["gallery"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_images")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  const hasDbImages = dbImages && dbImages.length > 0;
  const images = hasDbImages
    ? dbImages.map((img) => ({ id: img.id, src: img.image_url, alt: img.alt_text || "Imagem da galeria" }))
    : defaultImages.map((img, i) => ({ id: `default-${i}`, ...img }));

  const handleImageLoad = (index: number) => {
    setLoadedImages((prev) => new Set(prev).add(index));
  };

  const handleReplaceImage = async (file: File, imageId: string) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Selecione uma imagem válida", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Imagem deve ter no máximo 5MB", variant: "destructive" });
      return;
    }

    setUploadingIndex(images.findIndex((img) => img.id === imageId));
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `gallery-${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("gallery-images")
        .upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("gallery-images")
        .getPublicUrl(uploadData.path);

      const { error } = await supabase
        .from("gallery_images")
        .update({ image_url: urlData.publicUrl })
        .eq("id", imageId);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["gallery"] });
      toast({ title: "Imagem atualizada!" });
    } catch (error: any) {
      toast({ title: "Erro ao trocar imagem", description: error.message, variant: "destructive" });
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleAddImage = async (file: File) => {
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      toast({ title: "Imagem inválida ou muito grande (max 5MB)", variant: "destructive" });
      return;
    }

    setIsAddingImage(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `gallery-${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("gallery-images")
        .upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("gallery-images")
        .getPublicUrl(uploadData.path);

      const maxOrder = dbImages?.reduce((max, img) => Math.max(max, img.display_order), 0) || 0;

      const { error } = await supabase.from("gallery_images").insert({
        image_url: urlData.publicUrl,
        display_order: maxOrder + 1,
        is_active: true,
      });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["gallery"] });
      toast({ title: "Imagem adicionada!" });
    } catch (error: any) {
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
    } finally {
      setIsAddingImage(false);
      if (addFileInputRef.current) addFileInputRef.current.value = "";
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm("Remover esta imagem da galeria?")) return;
    setDeletingId(imageId);
    try {
      const { error } = await supabase
        .from("gallery_images")
        .update({ is_active: false })
        .eq("id", imageId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["gallery"] });
      toast({ title: "Imagem removida!" });
    } catch (error: any) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const isEditing = isAdmin && isEditMode;

  return (
    <section id="galeria" className="py-20 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-8 flex justify-center">
            <div className="relative flex items-center justify-center select-none">
              {/* Anel dourado tracejado girando devagar (spinSlow 40s linear infinito) */}
              <svg
                viewBox="0 0 332 332"
                className="absolute -top-3 -left-3 sm:-top-4 sm:-left-4 w-[234px] h-[234px] sm:w-[294px] sm:h-[294px] md:w-[332px] md:h-[332px] pointer-events-none animate-spin-slow select-none will-change-transform"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <circle
                  cx="166"
                  cy="166"
                  r="164"
                  stroke="#c69a5d"
                  strokeWidth="1.5"
                  strokeDasharray="6 10"
                />
              </svg>

              {/* Círculo com a foto do portfólio, fundo bege claro, borda branca de 6px e sombra suave */}
              <div className="relative w-[210px] h-[210px] sm:w-[270px] sm:h-[270px] md:w-[300px] md:h-[300px] rounded-full overflow-hidden border-4 sm:border-[6px] border-white shadow-[0_10px_30px_rgba(0,0,0,0.08)] bg-gradient-to-br from-[#fdfbf7] to-[#f4ece1] flex items-center justify-center group/portfolio">
                <img
                  src={portfolioImg}
                  alt="Jéssica Magalhães"
                  loading="lazy"
                  className="w-full h-full object-cover object-center select-none"
                />

                {/* Botão de edição da foto do portfólio no Modo Edição */}
                {isEditing && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openImageModal("portfolio_portrait_url", portfolioImg, "Foto do Portfólio (Galeria)");
                    }}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover/portfolio:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2 z-30 cursor-pointer"
                    title="Trocar Foto do Portfólio"
                  >
                    <div className="p-3 rounded-full bg-primary text-white shadow-lg">
                      <Camera className="h-6 w-6" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider bg-black/60 px-3 py-1 rounded-full">Trocar Foto</span>
                  </button>
                )}
              </div>

              {/* Selo 1: Topo esquerdo flutuando (floaty2 5.5s) */}
              <div
                className="absolute top-1 sm:top-5 -left-1 sm:-left-6 md:-left-8 bg-white/95 backdrop-blur-sm text-[#3a2e2b] shadow-[0_8px_24px_rgba(0,0,0,0.08)] border border-[#efe8df] rounded-full px-2.5 py-1 sm:px-4 sm:py-2 flex items-center gap-1.5 text-[11px] sm:text-xs md:text-sm font-medium tracking-tight whitespace-nowrap z-20 select-none animate-floaty2 will-change-transform"
                style={{ fontFamily: "'Jost', sans-serif" }}
              >
                <span className="text-xs sm:text-sm">⭐</span>
                <EditableText
                  settingKey="badge_premium_text"
                  defaultValue="Atendimento premium"
                  as="span"
                />
              </div>

              {/* Selo 2: Embaixo à direita flutuando (floaty 6.5s) */}
              <div
                className="absolute bottom-1 sm:bottom-6 -right-1 sm:-right-6 md:-right-8 bg-white/95 backdrop-blur-sm text-[#3a2e2b] shadow-[0_8px_24px_rgba(0,0,0,0.08)] border border-[#efe8df] rounded-full px-2.5 py-1 sm:px-4 sm:py-2 flex items-center gap-1.5 text-[11px] sm:text-xs md:text-sm font-medium tracking-tight whitespace-nowrap z-20 select-none animate-floaty will-change-transform"
                style={{ fontFamily: "'Jost', sans-serif" }}
              >
                <span className="text-xs sm:text-sm">💅</span>
                <EditableText
                  settingKey="badge_quality_text"
                  defaultValue="Produtos de alta qualidade"
                  as="span"
                />
              </div>
            </div>
          </div>
          <EditableText
            settingKey="gallery_label"
            defaultValue="Portfólio"
            as="span"
            className="text-sm uppercase tracking-[0.2em] text-primary font-body font-medium"
          />
          <EditableText
            settingKey="gallery_title"
            defaultValue="Galeria de Trabalhos"
            as="h2"
            className="text-4xl md:text-5xl font-display font-semibold text-foreground mt-2"
          />
          <EditableText
            settingKey="gallery_description"
            defaultValue="Confira alguns dos meus trabalhos e inspire-se para sua próxima unha"
            as="p"
            className="text-muted-foreground font-body mt-4 max-w-md mx-auto"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {[...Array(4)].map((_, index) => (
              <Skeleton key={index} className="aspect-square rounded-2xl" />
            ))}
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-body">Nenhuma imagem na galeria ainda</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {images.map((image, index) => (
              <div
                key={image.id}
                className="relative aspect-square rounded-2xl overflow-hidden cursor-pointer shadow-soft hover:shadow-card transition-all duration-300 hover:scale-105 animate-in fade-in zoom-in-95 duration-400 group"
                style={{ animationDelay: `${index * 100}ms` }}
                onClick={() => !isEditing && setSelectedImage(image.src)}
              >
                {!loadedImages.has(index) && (
                  <Skeleton className="w-full h-full absolute inset-0" />
                )}
                <img
                  src={image.src}
                  alt={image.alt}
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    loadedImages.has(index) ? "opacity-100" : "opacity-0"
                  }`}
                  loading="lazy"
                  decoding="async"
                  onLoad={() => handleImageLoad(index)}
                />

                {/* Admin edit overlay */}
                {isEditing && (
                  <>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-10">
                      {uploadingIndex === index ? (
                        <Loader2 className="h-8 w-8 animate-spin text-white" />
                      ) : (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              fileInputRefs.current[image.id]?.click();
                            }}
                            className="p-2.5 rounded-full bg-primary/80 text-white backdrop-blur-sm hover:bg-primary transition-colors cursor-pointer"
                            title="Trocar imagem"
                          >
                            <Camera className="h-5 w-5" />
                          </button>
                          {hasDbImages && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteImage(image.id);
                              }}
                              disabled={deletingId === image.id}
                              className="p-2.5 rounded-full bg-destructive/80 text-white backdrop-blur-sm hover:bg-destructive transition-colors cursor-pointer"
                              title="Remover imagem"
                            >
                              {deletingId === image.id ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                              ) : (
                                <Trash2 className="h-5 w-5" />
                              )}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    <input
                      ref={(el) => { fileInputRefs.current[image.id] = el; }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (hasDbImages) {
                            handleReplaceImage(file, image.id);
                          } else {
                            handleAddImage(file);
                          }
                        }
                        e.target.value = "";
                      }}
                    />
                  </>
                )}
              </div>
            ))}

            {/* Add new image card (admin only) */}
            {isEditing && (
              <div
                className="aspect-square rounded-2xl border-2 border-dashed border-primary/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all"
                onClick={() => addFileInputRef.current?.click()}
              >
                {isAddingImage ? (
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                ) : (
                  <>
                    <Plus className="h-8 w-8 text-primary/50 mb-2" />
                    <span className="text-xs text-muted-foreground font-body">Adicionar</span>
                  </>
                )}
                <input
                  ref={addFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAddImage(file);
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-transparent border-none">
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 z-50 p-2 bg-background/80 rounded-full hover:bg-background transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Imagem ampliada"
              className="w-full h-auto rounded-2xl"
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
});

Gallery.displayName = "Gallery";

export default Gallery;
