import { Client } from "pg";

const CONNECTION_STRING =
  process.env.DATABASE_URL ||
  "postgresql://postgres.nhsbtfilpxsvylqsrbsa:@Filhodorei123@aws-0-us-east-1.pooler.supabase.com:6543/postgres";

async function sendWhatsAppMessage(instanceId, token, phone, message) {
  if (!instanceId || !token || !phone || !message) return;
  const cleanPhone = String(phone).replace(/\D/g, "");
  const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
  const endpoint = `https://api.w-api.app/v1/message/send-text?instanceId=${encodeURIComponent(instanceId.trim())}`;

  try {
    await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.trim()}`,
      },
      body: JSON.stringify({
        phone: formattedPhone,
        number: formattedPhone,
        message,
        text: message,
      }),
    });
  } catch (err) {
    console.error("Erro ao enviar mensagem WhatsApp:", err);
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    console.log("Recebido Webhook InfinitePay:", JSON.stringify(body));

    // A InfinitePay envia eventos como 'paid', 'created', etc.
    const event = body.event || body.type || body.status;
    const orderNsu =
      body.order_nsu ||
      body.data?.order_nsu ||
      body.payload?.order_nsu ||
      body.orderId ||
      body.id;

    if (!orderNsu) {
      console.warn("Webhook InfinitePay recebido sem order_nsu:", body);
      return res.status(200).json({ received: true, ignored: true, reason: "No order_nsu" });
    }

    // Se o evento for de pagamento aprovado ('paid' ou 'settled')
    if (event === "paid" || event === "settled" || body.paid === true) {
      const client = new Client({
        connectionString: CONNECTION_STRING,
        ssl: { rejectUnauthorized: false },
      });
      await client.connect();

      // 1. Buscar o agendamento
      const aptRes = await client.query(
        "SELECT id, client_name, client_phone, service_type, appointment_date, appointment_time, notes, status FROM appointments WHERE id = $1 LIMIT 1",
        [orderNsu]
      );

      if (aptRes.rows.length === 0) {
        await client.end();
        console.warn(`Agendamento ${orderNsu} não encontrado para confirmação.`);
        return res.status(200).json({ received: true, not_found: true });
      }

      const apt = aptRes.rows[0];

      // 2. Atualizar status para confirmed e registrar sinal
      const updatedNotes = apt.notes && apt.notes.includes("[Sinal Pago")
        ? apt.notes
        : `${apt.notes ? apt.notes + " " : ""}[Sinal 50% Pago via InfinitePay]`;

      await client.query(
        "UPDATE appointments SET status = 'confirmed', notes = $1, updated_at = now() WHERE id = $2",
        [updatedNotes, apt.id]
      );

      // 3. Buscar configurações de WhatsApp para disparar a notificação
      const cfgRes = await client.query(
        "SELECT instance_id, instance_token, admin_number, enabled FROM whatsapp_config LIMIT 1"
      );

      let wConfig = cfgRes.rows[0];
      if (!wConfig || !wConfig.enabled) {
        const setRes = await client.query(
          "SELECT key, value FROM site_settings WHERE key IN ('wapi_instance_id', 'wapi_instance_token', 'wapi_admin_number', 'wapi_enabled')"
        );
        const map = {};
        setRes.rows.forEach((r) => { map[r.key] = r.value; });
        if (map.wapi_instance_id && map.wapi_instance_token && map.wapi_enabled !== "false") {
          wConfig = {
            instance_id: map.wapi_instance_id,
            instance_token: map.wapi_instance_token,
            admin_number: map.wapi_admin_number || "559191837179",
            enabled: true,
          };
        }
      }

      await client.end();

      // 4. Enviar mensagem de confirmação para a cliente e para a administradora
      if (wConfig && wConfig.enabled && wConfig.instance_id && wConfig.instance_token) {
        const [year, month, day] = String(apt.appointment_date).split("T")[0].split("-");
        const formattedDate = `${day}/${month}/${year}`;
        const formattedTime = String(apt.appointment_time).slice(0, 5);

        // Mensagem para a Cliente
        const clientMsg =
          `✨ Olá, *${apt.client_name}*! ✨\n\n` +
          `✅ O pagamento do seu sinal foi *APROVADO* via InfinitePay!\n` +
          `🎉 Seu agendamento está oficialmente *CONFIRMADO*! 💕\n\n` +
          `💅 *Serviço:* ${apt.service_type}\n` +
          `📅 *Data:* ${formattedDate}\n` +
          `🕐 *Horário:* ${formattedTime}\n` +
          `💰 *Sinal:* 50% pago online (restante de 50% a acertar no dia do atendimento)\n\n` +
          `⏰ *Tolerância de 15 minutos para chegada.*\n\n` +
          `📸 *Instagram:* https://www.instagram.com/jessica_magalhaes_nail\n\n` +
          `🙏 Te esperamos com muito carinho! 💕`;

        await sendWhatsAppMessage(
          wConfig.instance_id,
          wConfig.instance_token,
          apt.client_phone,
          clientMsg
        );

        // Mensagem para a Administradora (Jéssica)
        const adminMsg =
          `💰 *NOVO SINAL CONFIRMADO (InfinitePay)* 💰\n\n` +
          `Uma cliente efetuou o pagamento do sinal de 50% e o horário foi confirmado automaticamente!\n\n` +
          `👤 *Cliente:* ${apt.client_name}\n` +
          `📱 *WhatsApp:* ${apt.client_phone}\n` +
          `💅 *Serviço:* ${apt.service_type}\n` +
          `📅 *Data:* ${formattedDate} às ${formattedTime}\n` +
          `💳 *Status:* Confirmado automaticamente via InfinitePay\n\n` +
          `📋 Painel:\nhttps://jessicamagalhaesnail.vercel.app/admin`;

        await sendWhatsAppMessage(
          wConfig.instance_id,
          wConfig.instance_token,
          wConfig.admin_number,
          adminMsg
        );
      }

      return res.status(200).json({ success: true, message: "Agendamento confirmado com sucesso." });
    }

    return res.status(200).json({ received: true, event });
  } catch (error) {
    console.error("Erro no processamento do webhook InfinitePay:", error);
    return res.status(500).json({ error: error.message || String(error) });
  }
}
