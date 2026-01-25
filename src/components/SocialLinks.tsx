import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { Instagram, Facebook, Phone } from "lucide-react";

interface SocialLinksProps {
  instagram?: string;
  facebook?: string;
  whatsappNumber: string;
}

const SocialLinks = memo(({ instagram, facebook, whatsappNumber }: SocialLinksProps) => {
  const socials = useMemo(() => [
    {
      name: "Instagram",
      icon: Instagram,
      href: instagram || "https://instagram.com",
      color: "hover:text-pink-500",
    },
    {
      name: "Facebook",
      icon: Facebook,
      href: facebook || "https://facebook.com",
      color: "hover:text-blue-600",
    },
    {
      name: "WhatsApp",
      icon: Phone,
      href: `https://wa.me/${whatsappNumber}`,
      color: "hover:text-green-500",
    },
  ], [instagram, facebook, whatsappNumber]);

  return (
    <section id="contato" className="py-20 bg-secondary/30">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="text-sm uppercase tracking-[0.2em] text-primary font-body font-medium">
            Conecte-se
          </span>
          <h2 className="text-4xl md:text-5xl font-display font-semibold text-foreground mt-2">
            Redes Sociais
          </h2>
          <p className="text-muted-foreground font-body mt-4 max-w-md mx-auto">
            Siga-me para ver novos trabalhos, promoções e novidades!
          </p>
        </motion.div>

        <div className="flex justify-center gap-6">
          {socials.map((social, index) => (
            <motion.a
              key={social.name}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              whileHover={{ scale: 1.1, y: -5 }}
              className={`
                w-16 h-16 bg-card rounded-2xl shadow-soft flex items-center justify-center
                text-muted-foreground transition-colors ${social.color}
                hover:shadow-card
              `}
            >
              <social.icon className="h-7 w-7" />
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
});

SocialLinks.displayName = "SocialLinks";

export default SocialLinks;
