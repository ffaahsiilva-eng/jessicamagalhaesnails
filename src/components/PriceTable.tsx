import { memo } from "react";
import { Sparkles, Clock, Star, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PriceTable = memo(() => {
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
          <span className="text-sm uppercase tracking-[0.2em] text-primary font-body font-medium">
            Serviços
          </span>
          <h2 className="text-4xl md:text-5xl font-display font-semibold text-foreground mt-2">
            Tabela de Preços
          </h2>
          <p className="text-muted-foreground font-body mt-4 max-w-md mx-auto">
            Serviços de qualidade com produtos premium para suas unhas
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
