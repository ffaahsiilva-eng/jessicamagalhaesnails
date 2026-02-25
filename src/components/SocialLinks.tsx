import { memo, useMemo } from "react";
import { Instagram, Phone } from "lucide-react";

interface SocialLinksProps {
  instagram?: string;
  whatsappNumber: string;
}

const SocialLinks = memo(({ instagram, whatsappNumber }: SocialLinksProps) => {
  const socials = useMemo(() => [
    {
      name: "Instagram",
      icon: Instagram,
      href: instagram || "https://instagram.com",
      color: "hover:text-pink-500",
    },
    {
      name: "WhatsApp",
      icon: Phone,
      href: `https://wa.me/${whatsappNumber}`,
      color: "hover:text-green-500",
    },
  ], [instagram, whatsappNumber]);

  return (
    <section id="contato" className="py-20 bg-secondary/30">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <span className="text-sm uppercase tracking-[0.2em] text-primary font-body font-medium">
            Conecte-se
          </span>
          <h2 className="text-4xl md:text-5xl font-display font-semibold text-foreground mt-2">
            Redes Sociais
          </h2>
          <p className="text-muted-foreground font-body mt-4 max-w-md mx-auto">
            Siga-me para ver novos trabalhos, promoções e novidades!
          </p>
        </div>

        <div className="flex justify-center gap-6">
          {socials.map((social, index) => (
            <a
              key={social.name}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`
                w-16 h-16 bg-card rounded-2xl shadow-soft flex items-center justify-center
                text-muted-foreground transition-all duration-300 ${social.color}
                hover:shadow-card hover:scale-110 hover:-translate-y-1
                animate-in fade-in zoom-in-95 duration-400
              `}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <social.icon className="h-7 w-7" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
});

SocialLinks.displayName = "SocialLinks";

export default SocialLinks;
