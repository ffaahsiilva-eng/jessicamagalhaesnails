import { useState, useEffect, useRef, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format, addDays, isSunday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, Check, MessageCircle, X, Loader2, AlertCircle, Sparkles, CalendarOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { notifyWhatsAppBooking } from "@/lib/whatsapp";
import { calculateServicesTotal, parsePrice } from "@/lib/price";
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

const generateUUID = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const formatPhoneInput = (value: string) => {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

const BookingCalendar = ({ isOpen, onClose, whatsappNumber }: BookingCalendarProps) => {
  const sessionId = useRef(generateUUID());
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
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

  const [isLoadingBooked, setIsLoadingBooked] = useState(false);

  // Fetch available time slots from database
  const { data: allTimeSlots = [], isLoading: isLoadingSlots } = useQuery({
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
    queryKey: ["services-booking-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("name, price, duration, is_popular")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as { name: string; price: string; duration?: string; is_popular?: boolean }[];
    },
    enabled: isOpen,
  });

  // Calculate pricing summary for multiple selected services
  const pricingSummary = useMemo(() => {
    return calculateServicesTotal(selectedServices, services);
  }, [selectedServices, services]);

  const toggleService = (serviceName: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceName)
        ? prev.filter((s) => s !== serviceName)
        : [...prev, serviceName]
    );
  };

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

  const normalizeDateStr = (raw: any): string => {
    if (!raw) return "";
    if (typeof raw === "string") return raw.split("T")[0].split(" ")[0].trim();
    if (raw instanceof Date) return format(raw, "yyyy-MM-dd");
    return String(raw).slice(0, 10).trim();
  };

  const normalizeTimeStr = (raw: any): string => {
    if (!raw) return "";
    return String(raw).trim().slice(0, 5);
  };

  useEffect(() => {
    if (isOpen) {
      fetchBookedSlots();
      fetchBlockedSlots();
    }
  }, [isOpen, selectedDate, step]);

  // Realtime + Polling a cada 5s enquanto o modal estiver aberto para sincronia perfeita
  useEffect(() => {
    if (!isOpen) return;

    const intervalId = setInterval(() => {
      fetchBookedSlots();
      fetchBlockedSlots();
    }, 5000);

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
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [isOpen]);

  const fetchBookedSlots = async () => {
    setIsLoadingBooked(true);
    try {
      // Busca desde hoje para trás 1 dia garantindo que não perca fusos horários
      const fromDate = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase.rpc("get_booked_slots", {
        _from_date: fromDate,
      });

      const slots: Appointment[] = [];
      if (!error && Array.isArray(data)) {
        slots.push(
          ...data.map((d: { appointment_date: string; appointment_time: string }) => ({
            appointment_date: normalizeDateStr(d.appointment_date),
            appointment_time: normalizeTimeStr(d.appointment_time),
          }))
        );
      } else if (error) {
        console.warn("Erro ao buscar horários ocupados via RPC:", error);
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
              appointment_date: normalizeDateStr(h.slot_date),
              appointment_time: normalizeTimeStr(h.slot_time),
            }))
          );
        }
      } catch {
        // Tabela opcional
      }

      setBookedSlots(slots);
    } finally {
      setIsLoadingBooked(false);
    }
  };

  const fetchBlockedSlots = async () => {
    const { data, error } = await supabase.rpc("get_blocked_slots", {
      _from_date: format(new Date(), "yyyy-MM-dd"),
    });

    if (!error && Array.isArray(data)) {
      setBlockedSlots(
        data.map((d: { blocked_date: string; blocked_time: string }) => ({
          blocked_date: normalizeDateStr(d.blocked_date),
          blocked_time: normalizeTimeStr(d.blocked_time),
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
      .filter((slot) => normalizeDateStr(slot.appointment_date) === dateStr)
      .map((slot) => normalizeTimeStr(slot.appointment_time));
    
    const blockedTimes = blockedSlots
      .filter((slot) => normalizeDateStr(slot.blocked_date) === dateStr)
      .map((slot) => normalizeTimeStr(slot.blocked_time));

    const unavailableTimes = new Set([...bookedTimes, ...blockedTimes]);
    
    // Same-day bookings require at least 4 hours of lead time
    const minBookingTime = isToday ? new Date(Date.now() + 4 * 60 * 60 * 1000) : null;
    
    return timeSlots.filter((time) => {
      const normTime = normalizeTimeStr(time);
      if (unavailableTimes.has(normTime)) return false;
      if (minBookingTime) {
        const [h, m] = normTime.split(":").map(Number);
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
    if (!selectedDate || !selectedTime || selectedServices.length === 0) {
      toast({
        title: "Preencha todos os campos",
        description: "Por favor, selecione data, horário e pelo menos um serviço.",
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

      const combinedServiceType = selectedServices.join(" + ");
      const totalPrice = pricingSummary.totalFormatted;

      // Anotação com valor preservado
      const internalNotes = notes.trim()
        ? `${notes.trim()}${totalPrice ? ` [Valor: ${totalPrice}]` : ""}`
        : (totalPrice ? `[Valor: ${totalPrice}]` : null);

      const appointmentId = generateUUID();

      const appointmentPayload = {
        id: appointmentId,
        user_id: user?.id || null,
        client_name: name.trim(),
        client_email: email.trim() || null,
        client_phone: cleanPhone,
        service_type: combinedServiceType,
        appointment_date: format(selectedDate, "yyyy-MM-dd"),
        appointment_time: selectedTime,
        notes: internalNotes,
        status: "pending",
      };

      const { error } = await supabase
        .from("appointments")
        .insert(appointmentPayload);

      if (error) throw error;

      // Imediatamente bloqueia esse horário no estado local para nunca mais aparecer disponível
      setBookedSlots((prev) => [
        ...prev,
        {
          appointment_date: format(selectedDate, "yyyy-MM-dd"),
          appointment_time: selectedTime,
        },
      ]);
      fetchBookedSlots();

      // Notify admin via WhatsApp API (with total price and confirm link)
      try {
        await notifyWhatsAppBooking({
          ...appointmentPayload,
          appointment_id: appointmentId,
          service_price: totalPrice,
          site_url: window.location.origin,
          action: "new",
        });
      } catch (err) {
        console.warn("notifyWhatsAppBooking failed:", err);
      }

      const formattedDate = format(selectedDate, "dd/MM/yyyy", { locale: ptBR });
      const isMulti = selectedServices.length > 1;
      const serviceLabel = isMulti ? "*Serviços:*" : "*Serviço:*";
      const priceLabel = isMulti ? "*Valor Total:*" : "*Valor:*";

      const servicesBreakdown = pricingSummary.breakdown
        .map((b) => `  • ${b.name}${b.price ? ` (${b.price})` : ""}`)
        .join("\n");

      const message = encodeURIComponent(
        `Olá! Gostaria de agendar um horário:\n\n` +
        `*Nome:* ${name.trim()}\n` +
        `*Telefone:* ${phone}\n` +
        (email.trim() ? `*Email:* ${email.trim()}\n` : "") +
        `${serviceLabel}\n${servicesBreakdown}\n` +
        (totalPrice ? `${priceLabel} ${totalPrice}\n` : "") +
        `*Data:* ${formattedDate}\n` +
        `*Horário:* ${selectedTime}\n` +
        (notes.trim() ? `*Observações:* ${notes.trim()}\n` : "") +
        `\nVocê pode confirmar meu agendamento?\n\n` +
        `⏰ *Tolerância de 15 minutos para chegada.*\n\n` +
        `📸 *Instagram:* https://www.instagram.com/jessica_magalhaes_nail\n\n` +
        `📋 Painel de agendamentos:\nhttps://jessicamagalhaesnail.vercel.app/admin`
      );

      const rawAdmin = (whatsappNumber || "559191837179").replace(/\D/g, "");
      const cleanAdminNumber = rawAdmin.startsWith("55") ? rawAdmin : `55${rawAdmin}`;
      const url = `https://wa.me/${cleanAdminNumber}?text=${message}`;
      setWhatsappUrl(url);
      await releaseCurrentHold();
      setStep(4);

      toast({
        title: "Agendamento solicitado!",
        description: "Enviado para confirmação no painel da Jéssica.",
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
    setSelectedServices([]);
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
              {/* Escolha do horário */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-foreground">
                  <Clock className="h-5 w-5 text-primary" />
                  <span className="font-body font-medium">
                    Escolha o horário - {selectedDate && format(selectedDate, "dd/MM", { locale: ptBR })}
                  </span>
                </div>
                
                {isLoadingSlots ? (
                  <div className="flex flex-col items-center justify-center py-6 gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground font-body">Carregando horários...</span>
                  </div>
                ) : timeSlots.length === 0 ? (
                  <div className="text-center py-6 px-4 space-y-2.5 bg-rose-500/5 rounded-2xl border border-rose-500/20">
                    <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
                      <CalendarOff className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-foreground font-display font-semibold text-sm">
                        Não há horários disponíveis para esta data
                      </p>
                      <p className="text-xs text-muted-foreground font-body mt-1 max-w-xs mx-auto">
                        A profissional não disponibilizou horários de atendimento para este dia. Por favor, selecione outra data no calendário.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setStep(1)}
                      className="text-xs font-body h-8 rounded-lg mt-1 border-primary/30 text-primary hover:bg-primary/10"
                    >
                      Escolher outra data
                    </Button>
                  </div>
                ) : availableTimes.length === 0 ? (
                  <div className="text-center py-6 px-4 space-y-2.5 bg-secondary/30 rounded-2xl border border-border">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-foreground font-display font-semibold text-sm">
                        Todos os horários desta data já foram preenchidos
                      </p>
                      <p className="text-xs text-muted-foreground font-body mt-1 max-w-xs mx-auto">
                        Os horários cadastrados para este dia já estão reservados ou pendentes de confirmação.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setStep(1)}
                      className="text-xs font-body h-8 rounded-lg mt-1 border-primary/30 text-primary hover:bg-primary/10"
                    >
                      Escolher outra data
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto pr-1">
                    {availableTimes.map((time) => (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={`
                          py-2.5 px-2 rounded-xl font-body text-sm transition-all
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
              </div>

              {/* Escolha dos Serviços (Multi-seleção) */}
              <div className="space-y-2.5 pt-2 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <Label className="font-body text-foreground font-semibold flex items-center gap-1.5">
                    <span>💅</span>
                    <span>Escolha o(s) serviço(s)</span>
                  </Label>
                  <span className="text-[11px] font-medium text-primary px-2 py-0.5 rounded-full bg-primary/10">
                    Pode marcar 2 ou mais
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Toque nos serviços desejados para combiná-los neste mesmo horário:
                </p>

                {services.length === 0 ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 select-none">
                    {services.map((service) => {
                      const isSelected = selectedServices.includes(service.name);
                      return (
                        <button
                          key={service.name}
                          type="button"
                          onClick={() => toggleService(service.name)}
                          className={`
                            w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all active:scale-[0.99]
                            ${
                              isSelected
                                ? "bg-primary/10 border-primary text-foreground shadow-sm ring-1 ring-primary/40"
                                : "bg-secondary/40 border-border/70 hover:border-primary/40 hover:bg-secondary/70 text-foreground"
                            }
                          `}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div
                              className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                                isSelected
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-muted-foreground/40 bg-background"
                              }`}
                            >
                              {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-body font-medium text-sm truncate">
                                  {service.name}
                                </span>
                                {service.is_popular && (
                                  <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 rounded">
                                    ★ Popular
                                  </span>
                                )}
                              </div>
                              {service.duration && (
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Clock className="h-3 w-3" />
                                  {service.duration}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 text-right pl-3">
                            <span className={`font-semibold text-sm ${isSelected ? "text-primary" : "text-foreground"}`}>
                              {service.price}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Resumo em tempo real dos serviços selecionados */}
                {selectedServices.length > 0 && (
                  <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-center justify-between animate-in fade-in duration-200">
                    <div className="space-y-0.5 min-w-0 flex-1 pr-2">
                      <p className="text-xs font-semibold text-primary flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5" />
                        {selectedServices.length} {selectedServices.length === 1 ? "serviço selecionado" : "serviços selecionados"}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {selectedServices.join(", ")}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[11px] text-muted-foreground block">Total estimado</span>
                      <span className="font-bold text-base text-primary">
                        {pricingSummary.totalFormatted}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
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
                  disabled={!selectedTime || selectedServices.length === 0}
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

              {/* Summary detalhado com valores */}
              <div className="bg-secondary/50 rounded-xl p-4 space-y-2.5 border border-border/50">
                <div className="flex items-center justify-between">
                  <h4 className="font-body font-semibold text-foreground">Resumo do Agendamento</h4>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
                    {selectedServices.length} {selectedServices.length === 1 ? "serviço" : "serviços"}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground space-y-1.5">
                  <p className="flex items-center gap-2">
                    <span>📅</span>
                    <span>{selectedDate && format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span>🕐</span>
                    <span className="font-medium text-foreground">{selectedTime}</span>
                  </p>
                  <div className="pt-2 border-t border-border/40">
                    <p className="text-xs font-semibold text-foreground mb-1.5">💅 Serviços selecionados:</p>
                    <div className="space-y-1 pl-1">
                      {pricingSummary.breakdown.map((svc) => (
                        <div key={svc.name} className="flex items-center justify-between text-xs">
                          <span className="text-foreground">• {svc.name}</span>
                          <span className="text-primary font-medium">{svc.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {pricingSummary.totalFormatted && (
                    <div className="pt-2 border-t border-border/40 flex items-center justify-between font-semibold text-foreground">
                      <span>💰 {selectedServices.length > 1 ? "Valor Total:" : "Valor do Serviço:"}</span>
                      <span className="text-base text-primary font-bold">{pricingSummary.totalFormatted}</span>
                    </div>
                  )}
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
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto text-primary">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-display text-2xl font-semibold text-foreground">
                Agendamento Solicitado! 🎉
              </h3>
              <p className="text-muted-foreground font-body text-sm max-w-sm mx-auto leading-relaxed">
                Sua solicitação foi enviada para o nosso painel. Assim que a Jéssica confirmar o seu horário, você receberá uma notificação diretamente no seu WhatsApp.
              </p>
              <div className="pt-2 space-y-3">
                <Button
                  onClick={resetAndClose}
                  className="w-full h-12 font-body text-base font-medium rounded-xl shadow-button active:scale-[0.98] transition-all bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Concluir
                </Button>
                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
                  >
                    <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" />
                    Prefere falar direto? Abrir conversa no WhatsApp
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingCalendar;
