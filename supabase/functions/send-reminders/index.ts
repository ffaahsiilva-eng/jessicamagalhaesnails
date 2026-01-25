import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    // Fetch confirmed appointments for tomorrow
    const { data: appointments, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("appointment_date", tomorrowStr)
      .eq("status", "confirmed");

    if (error) {
      throw new Error(`Error fetching appointments: ${error.message}`);
    }

    if (!appointments || appointments.length === 0) {
      console.log("No appointments for tomorrow");
      return new Response(
        JSON.stringify({ message: "No appointments to remind", count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const results = [];
    
    for (const appointment of appointments) {
      // Skip if no email provided
      if (!appointment.client_email) {
        console.log(`Skipping appointment ${appointment.id}: no email`);
        results.push({
          appointment_id: appointment.id,
          client_name: appointment.client_name,
          status: "skipped",
          reason: "no email",
        });
        continue;
      }
      
      const formattedDate = new Date(appointment.appointment_date).toLocaleDateString("pt-BR");
      const formattedTime = appointment.appointment_time.slice(0, 5);

      try {
        const emailResponse = await resend.emails.send({
          from: "Glamour Nails <onboarding@resend.dev>",
          to: [appointment.client_email],
          subject: `💅 Lembrete: Seu agendamento é amanhã!`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #ec4899; text-align: center;">💅 Glamour Nails</h1>
              
              <p>Olá <strong>${appointment.client_name}</strong>!</p>
              
              <p>Este é um lembrete carinhoso do seu agendamento para <strong>amanhã</strong>:</p>
              
              <div style="background: linear-gradient(135deg, #fdf2f8, #fce7f3); padding: 20px; border-radius: 12px; margin: 20px 0;">
                <p style="margin: 8px 0;"><strong>📅 Data:</strong> ${formattedDate}</p>
                <p style="margin: 8px 0;"><strong>🕐 Horário:</strong> ${formattedTime}</p>
                <p style="margin: 8px 0;"><strong>💅 Serviço:</strong> ${appointment.service_type}</p>
              </div>
              
              <p>Estamos ansiosos para te receber! ✨</p>
              
              <p style="color: #6b7280; font-size: 14px;">
                Caso precise remarcar ou cancelar, entre em contato pelo WhatsApp.
              </p>
              
              <p style="text-align: center; margin-top: 30px;">
                <em>Suas unhas merecem esse carinho! 💖</em>
              </p>
            </div>
          `,
        });

        results.push({
          appointment_id: appointment.id,
          client_name: appointment.client_name,
          status: "sent",
          response: emailResponse,
        });

        console.log(`Reminder sent for appointment ${appointment.id}`);
      } catch (emailError: any) {
        results.push({
          appointment_id: appointment.id,
          client_name: appointment.client_name,
          status: "error",
          error: emailError.message,
        });
        console.error(`Failed to send reminder for ${appointment.id}:`, emailError);
      }
    }

    return new Response(
      JSON.stringify({ 
        message: "Reminders processed", 
        count: appointments.length,
        results 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-reminders function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
