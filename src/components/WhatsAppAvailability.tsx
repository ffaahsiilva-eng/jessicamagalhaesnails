import { memo } from "react";
import { MessageCircle, Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/hooks/useSiteSettings";

interface WhatsAppAvailabilityProps {
  whatsappNumber: string;
}

const WhatsAppAvailability = memo(({ whatsappNumber }: WhatsAppAvailabilityProps) => {
  const { getSetting } = useSiteSettings();
  const siteName = getSetting("site_name", "Jéssica Magalhães");

  const { data: timeSlots, isLoading } = useQuery({
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

  const formatTime = (t: string) => t.slice(0, 5);

  const buildMessage = () => {
    const weekdaySlots = timeSlots
      ?.filter((t) => t.day_type === "weekday")
      .map((t) => formatTime(t.time_slot)) || [];
    const weekendSlots = timeSlots
      ?.filter((t) => t.day_type === "weekend")
      .map((t) => formatTime(t.time_slot)) || [];

    let msg = `*${siteName} - Horários Disponíveis*\n\n`;

    if (weekdaySlots.length > 0) {
      msg += `*Segunda a Sexta:*\n${weekdaySlots.join(" | ")}\n\n`;
    }

    if (weekendSlots.length > 0) {
      msg += `*Sábado e Domingo:*\n${weekendSlots.join(" | ")}\n\n`;
    }

    if (weekdaySlots.length === 0 && weekendSlots.length === 0) {
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
