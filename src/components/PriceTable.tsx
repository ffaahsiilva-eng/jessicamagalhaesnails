import { motion } from "framer-motion";
import { Sparkles, Clock, Star } from "lucide-react";

const services = [
  {
    name: "Manicure Simples",
    description: "Esmaltação tradicional com cutilagem",
    price: "R$ 35",
    duration: "45 min",
    popular: false,
  },
  {
    name: "Manicure com Francesinha",
    description: "Clássica francesinha com acabamento perfeito",
    price: "R$ 45",
    duration: "1h",
    popular: false,
  },
  {
    name: "Alongamento em Gel",
    description: "Unhas alongadas com gel moldado",
    price: "R$ 120",
    duration: "2h",
    popular: true,
  },
  {
    name: "Esmaltação em Gel",
    description: "Durabilidade de até 3 semanas",
    price: "R$ 80",
    duration: "1h30",
    popular: true,
  },
  {
    name: "Nail Art Simples",
    description: "Decoração artística por unha",
    price: "R$ 5",
    duration: "+10 min",
    popular: false,
  },
  {
    name: "Nail Art Elaborada",
    description: "Design exclusivo e detalhado",
    price: "R$ 15",
    duration: "+20 min",
    popular: false,
  },
  {
    name: "Banho de Gel",
    description: "Fortalecimento e brilho intenso",
    price: "R$ 60",
    duration: "1h",
    popular: false,
  },
  {
    name: "Pedicure Completa",
    description: "Cutilagem, esfoliação e esmaltação",
    price: "R$ 50",
    duration: "1h",
    popular: false,
  },
];

const PriceTable = () => {
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

        <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {services.map((service, index) => (
            <motion.div
              key={service.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className={`
                relative p-6 rounded-2xl bg-card border transition-all duration-300
                hover:shadow-card hover:-translate-y-1
                ${service.popular ? "border-primary shadow-soft" : "border-border"}
              `}
            >
              {service.popular && (
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
