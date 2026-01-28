import { memo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Loader2, ImageIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import EditableText from "@/components/admin/EditableText";

// Default images (fallback)
import gallery1 from "@/assets/gallery-1.jpg";
import gallery2 from "@/assets/gallery-2.jpg";
import gallery3 from "@/assets/gallery-3.jpg";
import gallery4 from "@/assets/gallery-4.jpg";

const defaultImages = [
  { src: gallery1, alt: "Nail art floral rosa" },
  { src: gallery2, alt: "Manicure nude com dourado" },
  { src: gallery3, alt: "Unhas glitter rose gold" },
  { src: gallery4, alt: "Francesinha com decoração" },
];

const Gallery = memo(() => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());

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

  // Use database images if available, otherwise use default images
  const images = dbImages && dbImages.length > 0
    ? dbImages.map((img) => ({ src: img.image_url, alt: img.alt_text || "Imagem da galeria" }))
    : defaultImages;

  const handleImageLoad = (index: number) => {
    setLoadedImages((prev) => new Set(prev).add(index));
  };

  return (
    <section id="galeria" className="py-20 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                key={index}
                className="aspect-square rounded-2xl overflow-hidden cursor-pointer shadow-soft hover:shadow-card transition-all duration-300 hover:scale-105 animate-in fade-in zoom-in-95 duration-400"
                style={{ animationDelay: `${index * 100}ms` }}
                onClick={() => setSelectedImage(image.src)}
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
              </div>
            ))}
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
