import { useState, useEffect, useRef } from "react";
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
import { notifyWhatsAppBooking } from "@/lib/whatsapp";
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
  const sessionId = useRef(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  );
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
        .select("name, price")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as { name: string; price: string }[];
    },
    enabled: isOpen,
  });


  const holdCurrentSlot = async (timeToHold?: string) => {
    const time = timeToHold || selectedTime;
    if (!selectedDate || !time) return;
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      await supabase.from("slot_holds").delete().eq("session_id", sessionId.current);
      await supabase.from("slot_holds").insert({
        slot_date: dateStr,
        slot_time: time,
        session_id: sessionId.current,
      });
    } catch {
      // Ignora caso a tabela ainda não exista
    }
  };

  const releaseCurrentHold = async () => {
    try {
      await supabase.from("slot_holds").delete().eq("session_id", sessionId.current);
    } catch {
      // Ignora erro
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBookedSlots();
      fetchBlockedSlots();
    }
  }, [isOpen, selectedDate, step]);

  // Realtime: atualiza horários imediatamente se outra cliente marcar ou admin cancelar
  useEffect(() => {
    if (!isOpen) return;

    const channel = supabase
      .channel("booking-slots-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => {
          fetchBookedSlots();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "blocked_slots" },
        () => {
          fetchBlockedSlots();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "slot_holds" },
        () => {
          fetchBookedSlots();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen]);

  const fetchBookedSlots = async () => {
    const fromDate = format(new Date(), "yyyy-MM-dd");
    const { data, error } = await supabase.rpc("get_booked_slots", {
      _from_date: fromDate,
    });

    const slots: Appointment[] = [];
    if (!error && data) {
      slots.push(
        ...data.map((d: { appointment_date: string; appointment_time: string }) => ({
          appointment_date: d.appointment_date,
          appointment_time: d.appointment_time,
        }))
      );
    }

    // Inclui reservas temporárias de outras clientes em andamento (últimos 15 min)
    try {
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: holds } = await supabase
        .from("slot_holds")
        .select("slot_date, slot_time, session_id")
        .gte("created_at", fifteenMinAgo)
        .neq("session_id", sessionId.current);

      if (holds && holds.length > 0) {
        slots.push(
          ...holds.map((h: { slot_date: string; slot_time: string }) => ({
            appointment_date: h.slot_date,
            appointment_time: h.slot_time,
          }))
        );
      }
    } catch {
      // Tabela opcional
    }

    setBookedSlots(slots);
  };

  const fetchBlockedSlots = async () => {
    const { data, error } = await supabase.rpc("get_blocked_slots", {
      _from_date: format(new Date(), "yyyy-MM-dd"),
    });

    if (!error && data) {
      setBlockedSlots(
        data.map((d: { blocked_date: string; blocked_time: string }) => ({
          blocked_date: d.blocked_date,
          blocked_time: d.blocked_time,
        }))
      );
    }
  };

  const getAvailableTimes = (date: Date | undefined) => {
    if (!date) return timeSlots;
    
    const dateStr = format(date, "yyyy-MM-dd");
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const isToday = dateStr === todayStr;
    
    const bookedTimes = bookedSlots
      .filter((slot) => slot.appointment_date === dateStr)
      .map((slot) => slot.appointment_time.slice(0, 5));
    
    const blockedTimes = blockedSlots
      .filter((slot) => slot.blocked_date === dateStr)
      .map((slot) => slot.blocked_time.slice(0, 5));

    const unavailableTimes = [...bookedTimes, ...blockedTimes];
    
    // Same-day bookings require at least 4 hours of lead time
    const minBookingTime = isToday ? new Date(Date.now() + 4 * 60 * 60 * 1000) : null;
    
    return timeSlots.filter((time) => {
      if (unavailableTimes.includes(time)) return false;
      if (minBookingTime) {
        const [h, m] = time.split(":").map(Number);
        const slotDate = new Date();
        slotDate.setHours(h, m, 0, 0);
        if (slotDate < minBookingTime) return false;
      }
      return true;
    });
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

    // Verifica se o horário ainda está disponível antes de gravar
    const availableNow = getAvailableTimes(selectedDate);
    if (!availableNow.includes(selectedTime)) {
      toast({
        title: "Horário indisponível",
        description: "Este horário acabou de ser selecionado por outra cliente. Por favor, escolha outro horário.",
        variant: "destructive",
      });
      setStep(2);
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const cleanPhone = phone.replace(/\D/g, "");

      const appointmentPayload = {
        user_id: user?.id || null,
        client_name: name.trim(),
        client_email: email.trim() || null,
        client_phone: cleanPhone,
        service_type: selectedService,
        appointment_date: format(selectedDate, "yyyy-MM-dd"),
        appointment_time: selectedTime,
        notes: notes.trim() || null,
        status: "pending",
      };

      const { data: insertedAppt, error } = await supabase
        .from("appointments")
        .insert(appointmentPayload)
        .select()
        .single();

      if (error) throw error;

      const selectedServiceData = services.find((s) => s.name === selectedService);
      const servicePrice = selectedServiceData?.price || "";

      // Notify admin via WhatsApp API (with price and confirm link)
      try {
        await notifyWhatsAppBooking({
          ...appointmentPayload,
          appointment_id: insertedAppt?.id || null,
          service_price: servicePrice,
          site_url: window.location.origin,
          action: "new",
        });
      } catch (err) {
        console.warn("notifyWhatsAppBooking failed:", err);
      }


      const formattedDate = format(selectedDate, "dd/MM/yyyy", { locale: ptBR });
      const priceSuffix = servicePrice ? ` — ${servicePrice}` : "";
      const message = encodeURIComponent(
        `Olá! Gostaria de agendar um horário:\n\n` +
        `*Nome:* ${name.trim()}\n` +
        `*Telefone:* ${phone}\n` +
        `*Email:* ${email.trim()}\n` +
        `*Serviço:* ${selectedService}${priceSuffix}\n` +
        `*Data:* ${formattedDate}\n` +
        `*Horário:* ${selectedTime}\n` +
        `${notes.trim() ? `*Observações:* ${notes.trim()}\n` : ""}\n` +
        `Você pode confirmar meu agendamento?\n\n` +
        `⏰ *Tolerância de 15 minutos para chegada.*\n\n` +
        `📸 *Instagram:* https://www.instagram.com/jessica_magalhaes_nail\n\n` +
        `📋 Painel de agendamentos:\nhttps://jessicamagalhaes.lovable.app/admin`
      );

      const url = `https://wa.me/${whatsappNumber}?text=${message}`;
      setWhatsappUrl(url);
      await releaseCurrentHold();
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
    releaseCurrentHold();
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
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
    >
      <div
        className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-card overflow-hidden max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300 safe-area-bottom"
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
                className="rounded-xl border border-border mx-auto max-w-full"
              />
              <Button
                onClick={() => setStep(2)}
                disabled={!selectedDate}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-body text-base active:scale-[0.98] transition-transform shadow-button"
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
                <div className="text-center py-8 space-y-2">
                  <p className="text-muted-foreground font-body">
                    Todos os horários desta data já foram preenchidos.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Por favor, selecione outro dia no calendário.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {availableTimes.map((time) => (
                    <button
                      key={time}
                      onClick={() => setSelectedTime(time)}
                      className={`
                        py-3 px-2 rounded-xl font-body text-sm transition-all
                        ${selectedTime === time
                          ? "bg-primary text-primary-foreground shadow-button scale-105 font-medium"
                          : "bg-secondary text-secondary-foreground hover:bg-primary/20"
                        }
                      `}
                    >
                      {time}
                    </button>
                  ))}
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
                      <SelectItem key={service.name} value={service.name}>
                        <span className="flex items-center justify-between gap-3 w-full">
                          <span>{service.name}</span>
                          <span className="text-primary font-semibold text-sm">{service.price}</span>
                        </span>
                      </SelectItem>
                    ))}

                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1 h-12 font-body active:scale-[0.98] transition-transform"
                >
                  Voltar
                </Button>
                <Button
                  onClick={async () => {
                    await holdCurrentSlot(selectedTime);
                    setStep(3);
                  }}
                  disabled={!selectedTime || !selectedService}
                  className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-body active:scale-[0.98] transition-transform shadow-button"
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
                  onClick={async () => {
                    await releaseCurrentHold();
                    setStep(2);
                  }}
                  className="flex-1 h-12 font-body active:scale-[0.98] transition-transform"
                >
                  Voltar
                </Button>
                <Button
                  onClick={handleSendWhatsApp}
                  disabled={isLoading || !isStep3Valid}
                  className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-body shadow-button active:scale-[0.98] transition-transform text-sm sm:text-base"
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
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#1da851] text-white font-medium px-6 py-3.5 w-full text-base transition-colors shadow-button active:scale-[0.98]"
              >
                <MessageCircle className="h-5 w-5" />
                Enviar pelo WhatsApp
              </a>
              <div>
                <Button
                  variant="outline"
                  onClick={resetAndClose}
                  className="w-full h-11 font-body active:scale-[0.98] transition-transform"
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
