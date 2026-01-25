import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Calendar, Phone } from "lucide-react";
import heroImage from "@/assets/hero-nails.jpg";
interface HeroProps {
  onBookClick: () => void;
  whatsappNumber: string;
}
const Hero = ({
  onBookClick,
  whatsappNumber
}: HeroProps) => {
  const handleWhatsAppClick = () => {
    const message = encodeURIComponent("Olá! Gostaria de agendar um horário.");
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank");
  };
  return <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img src={heroImage} alt="Manicure profissional" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 text-center">
        <motion.div initial={{
        opacity: 0,
        y: 30
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        duration: 0.8
      }} className="max-w-2xl mx-auto">
          <motion.span initial={{
          opacity: 0,
          scale: 0.9
        }} animate={{
          opacity: 1,
          scale: 1
        }} transition={{
          delay: 0.2,
          duration: 0.5
        }} className="inline-block uppercase tracking-[0.3em] text-primary font-body font-medium mb-4 text-xs text-center">
            Nail Designer
          </motion.span>

          <motion.h1 initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 0.4,
          duration: 0.6
        }} className="md:text-7xl font-display font-semibold text-foreground mb-6 leading-tight text-4xl">Jessica Magalhães 
          </motion.h1>

          <motion.p initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} transition={{
          delay: 0.6,
          duration: 0.6
        }} className="text-lg text-muted-foreground font-body mb-10 max-w-md mx-auto">
            Unhas perfeitas com carinho e profissionalismo. 
            Agende seu horário e sinta-se ainda mais linda!
          </motion.p>

          <motion.div initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 0.8,
          duration: 0.5
        }} className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={onBookClick} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-button font-body group">
              <Calendar className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
              Agendar Horário
            </Button>

            <Button size="lg" variant="outline" onClick={handleWhatsAppClick} className="border-primary text-primary hover:bg-primary/10 font-body group">
              <Phone className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
              WhatsApp
            </Button>
          </motion.div>
        </motion.div>
      </div>

      {/* Decorative Elements */}
      <motion.div animate={{
      y: [0, -10, 0]
    }} transition={{
      duration: 6,
      repeat: Infinity,
      ease: "easeInOut"
    }} className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10">
        <div className="w-6 h-10 border-2 border-primary/50 rounded-full flex justify-center pt-2">
          <motion.div animate={{
          y: [0, 12, 0]
        }} transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut"
        }} className="w-1.5 h-3 bg-primary rounded-full" />
        </div>
      </motion.div>
    </section>;
};
export default Hero;