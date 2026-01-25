import { motion } from "framer-motion";
import { Sparkles, Clock, Star, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PriceTable = () => {
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
  });

  return (
    <section id="precos" className="py-20 bg-secondary/30">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-sm uppercase tracking-[0.2em] text-primary font-body font-medium">
            Serviços
          </span>
          <h2 className="text-4xl md:text-5xl font-display font-semibold text-foreground mt-2">
            Tabela de Preços
          </h2>
          <p className="text-muted-foreground font-body mt-4 max-w-md mx-auto">
            Serviços de qualidade com produtos premium para suas unhas
          </p>
        </motion.div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {services?.map((service, index) => (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className={`
                  relative p-6 rounded-2xl bg-card border transition-all duration-300
                  hover:shadow-card hover:-translate-y-1
                  ${service.is_popular ? "border-primary shadow-soft" : "border-border"}
                `}
              >
                {service.is_popular && (
                  <div className="absolute -top-3 right-4 bg-primary text-primary-foreground text-xs font-body font-medium px-3 py-1 rounded-full flex items-center gap-1">
                    <Star className="h-3 w-3 fill-current" />
                    Popular
                  </div>
                )}

                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h3 className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-accent" />
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
              </motion.div>
            ))}
          </div>
        )}

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-center text-muted-foreground text-sm font-body mt-8"
        >
          * Valores sujeitos a alteração. Consulte disponibilidade.
        </motion.p>
      </div>
    </section>
  );
};

export default PriceTable;
