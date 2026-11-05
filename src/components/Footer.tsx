import { memo } from "react";
import { Heart, MapPin, Clock, Phone, Download } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useAdminEdit } from "@/contexts/AdminEditContext";
import EditableText from "@/components/admin/EditableText";
import { Link } from "react-router-dom";

interface FooterProps {
  whatsappNumber: string;
}

const Footer = memo(({ whatsappNumber }: FooterProps) => {
  const { getSetting } = useSiteSettings();
  const { getDraftSetting } = useAdminEdit();
  
  const businessHours = getSetting("business_hours_weekday", "Seg-Sáb: 9h às 19h");
  const businessNote = getSetting("business_hours_note", "Atendimento com hora marcada");
  const siteName = getSetting("site_name", "Jéssica Magalhães");
  const footerBg = getDraftSetting("footer_bg_color") || getSetting("footer_bg_color", "#1a0f0a");

  const formatPhone = (phone: string) => {
    return phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  };

  return (
    <footer
      className="text-background py-12 pb-28 md:pb-12 safe-area-bottom transition-colors duration-300"
      style={{ backgroundColor: footerBg }}
    >
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="font-display text-2xl font-semibold mb-4 text-white flex items-center gap-1.5">
              <EditableText
                settingKey="footer_brand_first"
                defaultValue={siteName.split(" ")[0] || "Jéssica"}
                as="span"
                className="text-white"
              />
              <EditableText
                settingKey="footer_brand_second"
                defaultValue={siteName.split(" ").slice(1).join(" ") || "Magalhães"}
                as="span"
                className="text-[#c69a5d] font-semibold"
              />
            </h3>
            <EditableText
              settingKey="footer_description"
              defaultValue="Cuidando das suas unhas com carinho e profissionalismo."
              as="p"
              className="text-background/80 font-body text-sm"
            />
          </div>

          {/* Info */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
            <EditableText
              settingKey="footer_info_title"
              defaultValue="Informações"
              as="h4"
              className="font-body font-semibold mb-4 text-white"
            />
            <ul className="space-y-3 text-background/80 font-body text-sm">
              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#c69a5d]" />
                <EditableText
                  settingKey="business_hours_weekday"
                  defaultValue={businessHours}
                  as="span"
                />
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#c69a5d]" />
                <EditableText
                  settingKey="business_hours_note"
                  defaultValue={businessNote}
                  as="span"
                />
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-[#c69a5d]" />
                <span>{formatPhone(whatsappNumber)}</span>
              </li>
            </ul>
          </div>

          {/* Links */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
            <h4 className="font-body font-semibold mb-4 text-white">Links Rápidos</h4>
            <ul className="space-y-2 text-background/80 font-body text-sm">
              <li>
                <a href="#precos" className="hover:text-[#c69a5d] transition-colors">
                  Tabela de Preços
                </a>
              </li>
              <li>
                <a href="#galeria" className="hover:text-[#c69a5d] transition-colors">
                  Galeria
                </a>
              </li>
              <li>
                <Link to="/install" className="hover:text-[#c69a5d] transition-colors flex items-center gap-2">
                  <Download className="h-3 w-3" />
                  Instalar App
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-background/20 pt-6 text-center">
          <p className="text-background/60 font-body text-sm flex items-center justify-center gap-1">
            Feito com <Heart className="h-4 w-4 text-[#c69a5d] fill-[#c69a5d]" /> por{" "}
            <EditableText
              settingKey="footer_signature"
              defaultValue={siteName}
              as="span"
              className="font-medium text-white"
            />
          </p>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";

export default Footer;
