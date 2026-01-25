import { memo, useCallback } from "react";
import { motion } from "framer-motion";
import { Heart, MapPin, Clock, Phone } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
interface FooterProps {
  whatsappNumber: string;
}
const Footer = memo(({
  whatsappNumber
}: FooterProps) => {
  const {
    getSetting
  } = useSiteSettings();
  const businessHours = getSetting("business_hours_weekday", "Seg-Sáb: 9h às 19h");
  const businessNote = getSetting("business_hours_note", "Atendimento com hora marcada");
  const siteName = getSetting("site_name", "Jéssica Magalhães");
  const formatPhone = (phone: string) => {
    return phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  };
  return <footer className="bg-foreground text-background py-12">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <motion.div initial={{
          opacity: 0,
          y: 20
        }} whileInView={{
          opacity: 1,
          y: 0
        }} viewport={{
          once: true
        }}>
            <h3 className="font-display text-2xl font-semibold mb-4">
              {siteName.split(" ")[0]}
              <span className="text-primary">Magalhães</span>
            </h3>
            <p className="text-background/70 font-body text-sm">
              Cuidando das suas unhas com carinho e profissionalismo desde 2020.
            </p>
          </motion.div>

          {/* Info */}
          <motion.div initial={{
          opacity: 0,
          y: 20
        }} whileInView={{
          opacity: 1,
          y: 0
        }} viewport={{
          once: true
        }} transition={{
          delay: 0.1
        }}>
            <h4 className="font-body font-semibold mb-4">Informações</h4>
            <ul className="space-y-3 text-background/70 font-body text-sm">
              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                {businessHours}
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                {businessNote}
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                {formatPhone(whatsappNumber)}
              </li>
            </ul>
          </motion.div>

          {/* Links */}
          <motion.div initial={{
          opacity: 0,
          y: 20
        }} whileInView={{
          opacity: 1,
          y: 0
        }} viewport={{
          once: true
        }} transition={{
          delay: 0.2
        }}>
            <h4 className="font-body font-semibold mb-4">Links Rápidos</h4>
            <ul className="space-y-2 text-background/70 font-body text-sm">
              <li>
                <a href="#precos" className="hover:text-primary transition-colors">
                  Tabela de Preços
                </a>
              </li>
              <li>
                <a href="#galeria" className="hover:text-primary transition-colors">
                  Galeria
                </a>
              </li>
              <li>
                <a href="#contato" className="hover:text-primary transition-colors">
                  Contato
                </a>
              </li>
            </ul>
          </motion.div>
        </div>

        {/* Bottom */}
        <div className="border-t border-background/20 pt-6 text-center">
          <p className="text-background/50 font-body text-sm flex items-center justify-center gap-1">
            Feito com <Heart className="h-4 w-4 text-primary fill-primary" /> por {siteName.split(" ")[0]}
          </p>
        </div>
      </div>
    </footer>;
});
Footer.displayName = "Footer";
export default Footer;