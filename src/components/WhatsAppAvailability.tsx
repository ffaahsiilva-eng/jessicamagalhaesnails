import { memo, useMemo } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { format, addDays, startOfDay, isSaturday, isSunday } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WhatsAppAvailabilityProps {
  whatsappNumber: string;
}

const WhatsAppAvailability = memo(({ whatsappNumber }: WhatsAppAvailabilityProps) => {
  const { getSetting } = useSiteSettings();
  const siteName = getSetting("site_name", "Jéssica Magalhães");

  // Próximos 7 dias
  const dateRange = useMemo(() => {
    const today = startOfDay(new Date());
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, i);
      // Exclui domingo
      if (!isSunday(d)) dates.push(d);
    }
    return dates;
  }, []);

  const startDate = format(dateRange[0], "yyyy-MM-dd");
  const endDate = format(dateRange[dateRange.length - 1], "yyyy-MM-dd");

  const { data: timeSlots, isLoading: loadingSlots } = useQuery({
    queryKey: ["available-times-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("available_times")
        .select("time_slot, day_type")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as { time_slot: string; day_type: string }[];
    },
  });

  const { data: appointments, isLoading: loadingAppts } = useQuery({
    queryKey: ["appointments-week", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("appointment_date, appointment_time, status")
        .gte("appointment_date", startDate)
        .lte("appointment_date", endDate)
        .in("status", ["pending", "confirmed"]);

      if (error) throw error;
      return data as { appointment_date: string; appointment_time: string; status: string }[];
    },
  });

  const { data: blockedSlots, isLoading: loadingBlocked } = useQuery({
    queryKey: ["blocked-slots-week", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocked_slots")
        .select("blocked_date, blocked_time")
        .gte("blocked_date", startDate)
        .lte("blocked_date", endDate);

      if (error) throw error;
      return data as { blocked_date: string; blocked_time: string }[];
    },
  });

  const isLoading = loadingSlots || loadingAppts || loadingBlocked;

  const formatTime = (t: string) => t.slice(0, 5);

  const buildMessage = () => {
    let msg = `*${siteName} - Horários Disponíveis*\n\n`;

    const bookedSet = new Set(
      (appointments || []).map((a) => `${a.appointment_date}_${a.appointment_time.slice(0, 5)}`)
    );
    const blockedSet = new Set(
      (blockedSlots || []).map((b) => `${b.blocked_date}_${b.blocked_time.slice(0, 5)}`)
    );

    let hasAny = false;

    for (const date of dateRange) {
      const dateStr = format(date, "yyyy-MM-dd");
      const dayType = isSaturday(date) ? "weekend" : "weekday";
      const daySlots = timeSlots?.filter((t) => t.day_type === dayType) || [];

      const available = daySlots
        .map((s) => formatTime(s.time_slot))
        .filter((time) => {
          const key = `${dateStr}_${time}`;
          return !bookedSet.has(key) && !blockedSet.has(key);
        });

      if (available.length > 0) {
        hasAny = true;
        const dayLabel = format(date, "EEEE, dd/MM", { locale: ptBR });
        const capitalizedDay = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);
        msg += `*${capitalizedDay}:*\n${available.join(" | ")}\n\n`;
      }
    }

    if (!hasAny) {
      msg += "Sem horários disponíveis no momento.\n\n";
    }

    msg += "Gostaria de agendar um horário?";

    return encodeURIComponent(msg);
  };

  const handleClick = () => {
    const message = buildMessage();
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  return (
    <div className="flex justify-center mt-6 animate-in fade-in duration-500 delay-500">
      <Button
        size="lg"
        onClick={handleClick}
        disabled={isLoading}
        className="bg-[hsl(142,70%,40%)] hover:bg-[hsl(142,70%,35%)] text-white font-body gap-2 shadow-lg hover:shadow-xl transition-all hover:scale-105"
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <MessageCircle className="h-5 w-5" />
        )}
        Enviar horários disponíveis para cliente
      </Button>
    </div>
  );
});

WhatsAppAvailability.displayName = "WhatsAppAvailability";

export default WhatsAppAvailability;
