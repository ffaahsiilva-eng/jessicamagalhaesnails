import { memo, useCallback } from "react";
import { Sparkles, Clock, Star, Send } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import EditableText from "@/components/admin/EditableText";
import { useAdminEdit } from "@/contexts/AdminEditContext";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const PriceTable = memo(() => {
  const { isAdmin } = useAdminEdit();
  const { getSetting } = useSiteSettings();
  const whatsappNumber = getSetting("whatsapp_number", "559191837179");
  const { data: services, isLoading } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
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

  return (
    <section id="precos" className="py-20 bg-secondary/30">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <EditableText
            settingKey="prices_label"
            defaultValue="Serviços"
            as="span"
            className="text-sm uppercase tracking-[0.2em] text-primary font-body font-medium"
          />
          <EditableText
            settingKey="prices_title"
            defaultValue="Tabela de Preços"
            as="h2"
            className="text-4xl md:text-5xl font-display font-semibold text-foreground mt-2"
          />
          <EditableText
            settingKey="prices_description"
            defaultValue="Serviços de qualidade com produtos premium para suas unhas"
            as="p"
            className="text-muted-foreground font-body mt-4 max-w-md mx-auto"
          />
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              className="mt-4 border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950 font-body group"
              onClick={() => {
                if (!services?.length) return;
                const lines = services.map((s) =>
                  `${s.is_popular ? "⭐ " : ""}*${s.name}* - ${s.price}\n⏱ ${s.duration}${s.description ? `\n${s.description}` : ""}`
                );
                const msg = `✨ *Tabela de Preços* ✨\n\n${lines.join("\n\n")}\n\n📋 _Valores sujeitos a alteração._`;
                const whatsappUrl = new URL("https://api.whatsapp.com/send/");
                const cleanedPhone = whatsappNumber.replace(/\D/g, "");
                if (cleanedPhone) whatsappUrl.searchParams.set("phone", cleanedPhone);
                whatsappUrl.searchParams.set("text", msg);
                window.open(whatsappUrl.toString(), "_blank", "noopener,noreferrer");
              }}
            >
              <Send className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform" />
              Enviar Tabela via WhatsApp
            </Button>
          )}
        </div>
        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {[...Array(4)].map((_, index) => (
              <div
                key={index}
                className="relative p-6 rounded-2xl bg-card border border-border animate-pulse"
              >
                <div className="flex gap-4">
                  <Skeleton className="w-16 h-16 rounded-xl flex-shrink-0" />
                  <div className="flex-1 flex justify-between items-start gap-4">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-20 mt-2" />
                    </div>
                    <Skeleton className="h-8 w-16" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {services?.map((service, index) => (
              <div
                key={service.id}
                style={{ animationDelay: `${index * 50}ms` }}
                className={`
                  relative p-6 rounded-2xl bg-card border transition-all duration-300
                  hover:shadow-card hover:-translate-y-1
                  animate-in fade-in slide-in-from-bottom-2 fill-mode-both
                  ${service.is_popular ? "border-primary shadow-soft" : "border-border"}
                `}
              >
                {service.is_popular && (
                  <div className="absolute -top-3 right-4 bg-primary text-primary-foreground text-xs font-body font-medium px-3 py-1 rounded-full flex items-center gap-1">
                    <Star className="h-3 w-3 fill-current" />
                    Popular
                  </div>
                )}

                <div className="flex gap-4">
                  {service.image_url && (
                    <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
                      <img 
                        src={service.image_url} 
                        alt={service.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="flex-1 flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h3 className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
                        {!service.image_url && <Sparkles className="h-4 w-4 text-accent" />}
                        {service.name}
                      </h3>
                      <p className="text-muted-foreground font-body text-sm mt-1">
                        {service.description}
                      </p>
                      <div className="flex items-center gap-1 mt-2 text-muted-foreground text-xs font-body">
                        <Clock className="h-3 w-3" />
                        {service.duration}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-display font-bold text-primary">
                        {service.price}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-muted-foreground text-sm font-body mt-8 animate-in fade-in duration-500 delay-300">
          * Valores sujeitos a alteração. Consulte disponibilidade.
        </p>
      </div>
    </section>
  );
});

PriceTable.displayName = "PriceTable";

export default PriceTable;
