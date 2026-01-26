import { memo, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Calendar, Phone } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useAdminEdit } from "@/contexts/AdminEditContext";
import EditableText from "@/components/admin/EditableText";
import heroImageDefault from "@/assets/hero-nails.jpg";

interface HeroProps {
  onBookClick: () => void;
  whatsappNumber: string;
}

const Hero = memo(({ onBookClick, whatsappNumber }: HeroProps) => {
  const { getSetting } = useSiteSettings();
  const { isEditMode, isAdmin } = useAdminEdit();
  
  const heroImageUrl = getSetting("hero_image_url", "");
  const heroImage = heroImageUrl || heroImageDefault;

  const handleWhatsAppClick = useCallback(() => {
    const message = encodeURIComponent("Olá! Gostaria de agendar um horário.");
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank");
  }, [whatsappNumber]);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src={heroImage}
          alt="Manicure profissional"
          className="w-full h-full object-cover"
          loading="eager"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-2xl mx-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-4"
          >
            {isAdmin && isEditMode ? (
              <EditableText
                settingKey="hero_subtitle"
                defaultValue="Nail Designer"
                className="inline-block uppercase tracking-[0.3em] text-primary font-body font-medium text-xs text-center"
              />
            ) : (
              <span className="inline-block uppercase tracking-[0.3em] text-primary font-body font-medium text-xs text-center">
                {getSetting("hero_subtitle", "Nail Designer")}
              </span>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mb-6"
          >
            {isAdmin && isEditMode ? (
              <EditableText
                settingKey="hero_title"
                defaultValue="Jéssica Magalhães"
                as="h1"
                className="md:text-7xl font-display font-semibold text-foreground leading-tight text-4xl"
              />
            ) : (
              <h1 className="md:text-7xl font-display font-semibold text-foreground mb-6 leading-tight text-4xl">
                {getSetting("hero_title", "Jéssica Magalhães")}
              </h1>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="mb-10 max-w-md mx-auto"
          >
            {isAdmin && isEditMode ? (
              <EditableText
                settingKey="hero_description"
                defaultValue="Unhas perfeitas com carinho e profissionalismo. Agende seu horário e sinta-se ainda mais linda!"
                as="p"
                multiline
                className="text-lg text-muted-foreground font-body"
              />
            ) : (
              <p className="text-lg text-muted-foreground font-body">
                {getSetting("hero_description", "Unhas perfeitas com carinho e profissionalismo. Agende seu horário e sinta-se ainda mais linda!")}
              </p>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button
              size="lg"
              onClick={onBookClick}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-button font-body group"
            >
              <Calendar className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
              Agendar Horário
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={handleWhatsAppClick}
              className="border-primary text-primary hover:bg-primary/10 font-body group"
            >
              <Phone className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
              WhatsApp
            </Button>
          </motion.div>
        </motion.div>
      </div>

      {/* Decorative Elements */}
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10"
      >
        <div className="w-6 h-10 border-2 border-primary/50 rounded-full flex justify-center pt-2">
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="w-1.5 h-3 bg-primary rounded-full"
          />
        </div>
      </motion.div>
    </section>
  );
});

Hero.displayName = "Hero";

export default Hero;
