import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, Check, MessageCircle, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface BookingCalendarProps {
  isOpen: boolean;
  onClose: () => void;
  whatsappNumber: string;
}

interface Appointment {
  appointment_date: string;
  appointment_time: string;
}

interface BlockedSlot {
  blocked_date: string;
  blocked_time: string;
}

const BookingCalendar = ({ isOpen, onClose, whatsappNumber }: BookingCalendarProps) => {
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedService, setSelectedService] = useState<string>("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [bookedSlots, setBookedSlots] = useState<Appointment[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Fetch available time slots from database
  const { data: timeSlots = [] } = useQuery({
    queryKey: ["available-times"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("available_times")
        .select("time_slot")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data.map((t) => t.time_slot.slice(0, 5));
    },
    enabled: isOpen,
  });

  // Fetch services from database
  const { data: services = [] } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("name")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data.map((s) => s.name);
    },
    enabled: isOpen,
  });

  useEffect(() => {
    if (isOpen) {
      fetchBookedSlots();
      fetchBlockedSlots();
    }
  }, [isOpen]);

  const fetchBookedSlots = async () => {
    const { data, error } = await supabase
      .from("appointments")
      .select("appointment_date, appointment_time")
      .gte("appointment_date", format(new Date(), "yyyy-MM-dd"))
      .in("status", ["confirmed", "pending"]);

    if (!error && data) {
      setBookedSlots(data);
    }
  };

  const fetchBlockedSlots = async () => {
    const { data, error } = await supabase
      .from("blocked_slots")
      .select("blocked_date, blocked_time")
      .gte("blocked_date", format(new Date(), "yyyy-MM-dd"));

    if (!error && data) {
      setBlockedSlots(data);
    }
  };

  const getAvailableTimes = (date: Date | undefined) => {
    if (!date) return timeSlots;
    
    const dateStr = format(date, "yyyy-MM-dd");
    
    const bookedTimes = bookedSlots
      .filter((slot) => slot.appointment_date === dateStr)
      .map((slot) => slot.appointment_time.slice(0, 5));
    
    const blockedTimes = blockedSlots
      .filter((slot) => slot.blocked_date === dateStr)
      .map((slot) => slot.blocked_time.slice(0, 5));

    const unavailableTimes = [...bookedTimes, ...blockedTimes];
    
    return timeSlots.filter((time) => !unavailableTimes.includes(time));
  };

  const handleSendWhatsApp = async () => {
    if (!selectedDate || !selectedTime || !selectedService || !name || !phone) {
      toast({
        title: "Preencha todos os campos",
        description: "Por favor, preencha todas as informações para agendar.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("appointments").insert({
        user_id: user?.id || null,
        client_name: name,
        client_email: email || null,
        client_phone: phone,
        service_type: selectedService,
        appointment_date: format(selectedDate, "yyyy-MM-dd"),
        appointment_time: selectedTime,
        notes: notes,
        status: "pending",
      });

      if (error) throw error;

      const formattedDate = format(selectedDate, "dd/MM/yyyy", { locale: ptBR });
      const message = encodeURIComponent(
        `Olá! Gostaria de agendar um horário:\n\n` +
        `👤 Nome: ${name}\n` +
        `📱 Telefone: ${phone}\n` +
        `💅 Serviço: ${selectedService}\n` +
        `📅 Data: ${formattedDate}\n` +
        `🕐 Horário: ${selectedTime}\n` +
        `${notes ? `📝 Observações: ${notes}\n` : ""}\n` +
        `Você pode confirmar meu agendamento? 💖`
      );

      window.location.href = `https://wa.me/${whatsappNumber}?text=${message}`;

      toast({
        title: "Agendamento enviado!",
        description: "Aguarde a confirmação pelo WhatsApp.",
      });

      setStep(4);
    } catch (error) {
      toast({
        title: "Erro ao agendar",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetAndClose = () => {
    setStep(1);
    setSelectedDate(undefined);
    setSelectedTime("");
    setSelectedService("");
    setName("");
    setEmail("");
    setPhone("");
    setNotes("");
    onClose();
  };

  const availableTimes = getAvailableTimes(selectedDate);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
          onClick={resetAndClose}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-card overflow-hidden max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="font-display text-2xl font-semibold text-foreground">
                  Agendar Horário
                </h2>
                <p className="text-muted-foreground text-sm font-body">
                  Passo {step} de 4
                </p>
              </div>
              <button
                onClick={resetAndClose}
                className="p-2 hover:bg-secondary rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* Progress */}
            <div className="px-6 pt-4">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((s) => (
                  <div
                    key={s}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      s <= step ? "bg-primary" : "bg-secondary"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2 text-foreground mb-4">
                      <CalendarIcon className="h-5 w-5 text-primary" />
                      <span className="font-body font-medium">Escolha a data</span>
                    </div>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(date) => date < new Date() || date > addDays(new Date(), 30)}
                      locale={ptBR}
                      className="rounded-xl border border-border mx-auto"
                    />
                    <Button
                      onClick={() => setStep(2)}
                      disabled={!selectedDate}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      Continuar
                    </Button>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2 text-foreground mb-4">
                      <Clock className="h-5 w-5 text-primary" />
                      <span className="font-body font-medium">
                        Escolha o horário - {selectedDate && format(selectedDate, "dd/MM", { locale: ptBR })}
                      </span>
                    </div>
                    
                    {timeSlots.length === 0 ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : availableTimes.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        Sem horários disponíveis nesta data
                      </p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {timeSlots.map((time) => {
                          const isAvailable = availableTimes.includes(time);
                          return (
                            <button
                              key={time}
                              onClick={() => isAvailable && setSelectedTime(time)}
                              disabled={!isAvailable}
                              className={`
                                py-3 px-2 rounded-xl font-body text-sm transition-all
                                ${selectedTime === time
                                  ? "bg-primary text-primary-foreground shadow-button"
                                  : isAvailable
                                    ? "bg-secondary text-secondary-foreground hover:bg-primary/20"
                                    : "bg-muted text-muted-foreground line-through opacity-50 cursor-not-allowed"
                                }
                              `}
                            >
                              {time}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="font-body text-foreground">Serviço</Label>
                      <Select value={selectedService} onValueChange={setSelectedService}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione o serviço" />
                        </SelectTrigger>
                        <SelectContent>
                          {services.map((service) => (
                            <SelectItem key={service} value={service}>
                              {service}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setStep(1)}
                        className="flex-1"
                      >
                        Voltar
                      </Button>
                      <Button
                        onClick={() => setStep(3)}
                        disabled={!selectedTime || !selectedService}
                        className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        Continuar
                      </Button>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="name" className="font-body text-foreground">Seu nome</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Como posso te chamar?"
                        className="bg-secondary/50"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="font-body text-foreground">
                        Email (para lembrete)
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seu@email.com (opcional)"
                        className="bg-secondary/50"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone" className="font-body text-foreground">WhatsApp</Label>
                      <Input
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="bg-secondary/50"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes" className="font-body text-foreground">
                        Observações (opcional)
                      </Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Algo que devemos saber?"
                        rows={3}
                        className="bg-secondary/50 resize-none"
                      />
                    </div>

                    {/* Summary */}
                    <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
                      <h4 className="font-body font-medium text-foreground">Resumo</h4>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>📅 {selectedDate && format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}</p>
                        <p>🕐 {selectedTime}</p>
                        <p>💅 {selectedService}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setStep(2)}
                        className="flex-1"
                      >
                        Voltar
                      </Button>
                      <Button
                        onClick={handleSendWhatsApp}
                        disabled={isLoading || !name || !phone}
                        className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Enviar via WhatsApp
                      </Button>
                    </div>
                  </motion.div>
                )}

                {step === 4 && (
                  <motion.div
                    key="step4"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8 space-y-4"
                  >
                    <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                      <Check className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="font-display text-2xl font-semibold text-foreground">
                      Solicitação Enviada!
                    </h3>
                    <p className="text-muted-foreground font-body">
                      Aguarde a confirmação pelo WhatsApp. Você receberá um lembrete antes do horário.
                    </p>
                    <Button
                      onClick={resetAndClose}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      Fechar
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BookingCalendar;
