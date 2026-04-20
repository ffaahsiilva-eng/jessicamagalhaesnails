import { useState, useEffect } from "react";
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
import { format, addDays, isSaturday, isSunday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, Check, MessageCircle, X, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

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

// Validation schema
const bookingSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo"),
  email: z.string().trim().email("Email inválido").max(255, "Email muito longo").or(z.literal("")),
  phone: z.string().trim().regex(/^\(\d{2}\)\s?\d{4,5}-?\d{4}$|^\d{10,11}$/, "Telefone inválido (ex: (91) 91234-5678)"),
});

const formatPhoneInput = (value: string) => {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [whatsappUrl, setWhatsappUrl] = useState<string>("");
  const { toast } = useToast();

  // Fetch available time slots from database
  const { data: allTimeSlots = [] } = useQuery({
    queryKey: ["available-times"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("available_times")
        .select("time_slot, day_type")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as { time_slot: string; day_type: string }[];
    },
    enabled: isOpen,
  });

  const getDayType = (date: Date): string => {
    const dayMap = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    return dayMap[date.getDay()];
  };

  // Filter time slots based on selected date's day type
  const timeSlots = selectedDate
    ? allTimeSlots
        .filter((t) => t.day_type === getDayType(selectedDate))
        .map((t) => t.time_slot.slice(0, 5))
    : allTimeSlots.filter((t) => t.day_type === "monday").map((t) => t.time_slot.slice(0, 5));

  // Fetch services from database
  const { data: services = [] } = useQuery({
    queryKey: ["services-names"],
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
    const { data, error } = await supabase.rpc("get_booked_slots", {
      _from_date: format(new Date(), "yyyy-MM-dd"),
    });

    if (!error && data) {
      setBookedSlots(
        data.map((d: { appointment_date: string; appointment_time: string }) => ({
          appointment_date: d.appointment_date,
          appointment_time: d.appointment_time,
        }))
      );
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

  const validateForm = () => {
    try {
      bookingSchema.parse({ name, email, phone });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneInput(e.target.value);
    setPhone(formatted);
    if (errors.phone) {
      setErrors((prev) => ({ ...prev, phone: "" }));
    }
  };

  const handleSendWhatsApp = async () => {
    if (!selectedDate || !selectedTime || !selectedService) {
      toast({
        title: "Preencha todos os campos",
        description: "Por favor, preencha todas as informações para agendar.",
        variant: "destructive",
      });
      return;
    }

    if (!validateForm()) {
      toast({
        title: "Verifique os dados",
        description: "Por favor, corrija os erros antes de continuar.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const cleanPhone = phone.replace(/\D/g, "");

      const { error } = await supabase.from("appointments").insert({
        user_id: user?.id || null,
        client_name: name.trim(),
        client_email: email.trim() || null,
        client_phone: cleanPhone,
        service_type: selectedService,
        appointment_date: format(selectedDate, "yyyy-MM-dd"),
        appointment_time: selectedTime,
        notes: notes.trim() || null,
        status: "pending",
      });

      if (error) throw error;

      const formattedDate = format(selectedDate, "dd/MM/yyyy", { locale: ptBR });
      const message = encodeURIComponent(
        `Olá! Gostaria de agendar um horário:\n\n` +
        `*Nome:* ${name.trim()}\n` +
        `*Telefone:* ${phone}\n` +
        `*Email:* ${email.trim()}\n` +
        `*Serviço:* ${selectedService}\n` +
        `*Data:* ${formattedDate}\n` +
        `*Horário:* ${selectedTime}\n` +
        `${notes.trim() ? `*Observações:* ${notes.trim()}\n` : ""}\n` +
        `Você pode confirmar meu agendamento?\n\n` +
        `📋 Painel de agendamentos:\nhttps://jessicamagalhaes.lovable.app/admin`
      );

      const url = `https://wa.me/${whatsappNumber}?text=${message}`;
      setWhatsappUrl(url);
      setStep(4);

      toast({
        title: "Agendamento salvo!",
        description: "Clique no botão para enviar pelo WhatsApp.",
      });
    } catch (error: unknown) {
      console.error("Erro ao criar agendamento:", error);
      const errorMessage =
        typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: string }).message)
          : "Tente novamente mais tarde.";

      toast({
        title: "Erro ao agendar",
        description: errorMessage,
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
    setErrors({});
    onClose();
  };

  const availableTimes = getAvailableTimes(selectedDate);
  const isStep3Valid = name.trim().length >= 2 && phone.trim().length >= 10;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div
        className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-card overflow-hidden max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300"
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
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="flex items-center gap-2 text-foreground mb-4">
                <CalendarIcon className="h-5 w-5 text-primary" />
                <span className="font-body font-medium">Escolha a data</span>
              </div>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return date < today || date > addDays(new Date(), 30) || isSunday(date);
                }}
                locale={ptBR}
                className="rounded-xl border border-border mx-auto"
              />
              <Button
                onClick={() => setStep(2)}
                disabled={!selectedDate}
              >
                Continuar
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
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
                  <SelectContent className="z-[80]">
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
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="space-y-2">
                <Label htmlFor="name" className="font-body text-foreground">
                  Seu nome *
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
                  }}
                  placeholder="Como posso te chamar?"
                  className={`bg-secondary/50 ${errors.name ? "border-destructive" : ""}`}
                  maxLength={100}
                />
                {errors.name && (
                  <p className="text-destructive text-xs flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="font-body text-foreground">
                  Email (opcional)
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
                  }}
                  placeholder="seu@email.com"
                  className={`bg-secondary/50 ${errors.email ? "border-destructive" : ""}`}
                  maxLength={255}
                />
                {errors.email && (
                  <p className="text-destructive text-xs flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="font-body text-foreground">
                  WhatsApp *
                </Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="(91) 91234-5678"
                  className={`bg-secondary/50 ${errors.phone ? "border-destructive" : ""}`}
                  maxLength={16}
                />
                {errors.phone && (
                  <p className="text-destructive text-xs flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.phone}
                  </p>
                )}
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
                  maxLength={500}
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
                  disabled={isLoading || !isStep3Valid}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Enviar via WhatsApp
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="text-center py-8 space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold text-foreground">
                Agendamento Salvo!
              </h3>
              <p className="text-muted-foreground font-body text-sm">
                Agora envie a mensagem pelo WhatsApp para confirmar seu horário.
              </p>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#25D366] hover:bg-[#1da851] text-white font-medium px-6 py-3 transition-colors"
              >
                <MessageCircle className="h-5 w-5" />
                Enviar pelo WhatsApp
              </a>
              <div>
                <Button
                  variant="outline"
                  onClick={resetAndClose}
                  size="sm"
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingCalendar;
