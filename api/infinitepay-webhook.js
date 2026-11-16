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
    const res = await fetch(endpoint, {
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
    console.log(`WhatsApp enviado para ${formattedPhone}: status ${res.status}`);
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

    const event = String(body.event || body.type || body.status || "").toLowerCase();
    const orderNsu =
      body.order_nsu ||
      body.data?.order_nsu ||
      body.payload?.order_nsu ||
      body.orderId ||
      body.id;
    const slug =
      body.invoice_slug ||
      body.slug ||
      body.data?.slug ||
      body.data?.invoice_slug;
    const paidAmount = Number(body.paid_amount ?? body.data?.paid_amount ?? body.amount ?? 0);
    const transactionNsu = body.transaction_nsu || body.data?.transaction_nsu;

    if (!orderNsu && !slug) {
      console.warn("Webhook InfinitePay recebido sem order_nsu e sem slug:", body);
      return res.status(200).json({ received: true, ignored: true, reason: "No identifier" });
    }

    const isPaid =
      event === "paid" ||
      event === "settled" ||
      event.includes("paid") ||
      event.includes("settled") ||
      body.paid === true ||
      body.status === "paid" ||
      body.status === "approved" ||
      body.status === "settled" ||
      paidAmount > 0 ||
      Boolean(transactionNsu && (!event || event === "paid" || event === "charge.paid"));

    if (!isPaid) {
      console.log(`Webhook InfinitePay ignorado (não é evento de pagamento): event=${event}`);
      return res.status(200).json({ received: true, ignored: true, event });
    }

    const client = new Client({
      connectionString: CONNECTION_STRING,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();

    // 1. Procurar na tabela pending_checkouts
    let pendingRes = null;
    if (orderNsu) {
      pendingRes = await client.query(
        "SELECT * FROM pending_checkouts WHERE id = $1 LIMIT 1",
        [orderNsu]
      );
    }
    if ((!pendingRes || pendingRes.rows.length === 0) && slug) {
      pendingRes = await client.query(
        "SELECT * FROM pending_checkouts WHERE payment_url LIKE $1 LIMIT 1",
        [`%${slug}%`]
      );
    }

    let appointmentData = null;
    let shouldSendNotification = true;

    if (pendingRes && pendingRes.rows.length > 0) {
      const p = pendingRes.rows[0];

      // Verificar se já existe e já estava confirmado para não duplicar notificação
      const existingApt = await client.query(
        "SELECT id, status FROM appointments WHERE id = $1 LIMIT 1",
        [p.id]
      );
      if (existingApt.rows.length > 0 && existingApt.rows[0].status === "confirmed") {
        shouldSendNotification = false;
      }

      const notesWithDeposit = p.notes && p.notes.includes("[Sinal")
        ? (p.notes.includes("Pago") ? p.notes : `${p.notes} [Sinal Pago via InfinitePay]`)
        : `${p.notes ? p.notes + " " : ""}[Sinal 50% Pago via InfinitePay]`;

      const insertRes = await client.query(
        `INSERT INTO appointments (
          id, user_id, client_name, client_phone, client_email, service_type,
          appointment_date, appointment_time, notes, status, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, 'confirmed', now(), now()
        ) ON CONFLICT (id) DO UPDATE SET
          status = 'confirmed',
          notes = EXCLUDED.notes,
          updated_at = now()
        RETURNING *`,
        [
          p.id,
          p.user_id || null,
          p.client_name,
          p.client_phone,
          p.client_email,
          p.service_type,
          p.appointment_date,
          p.appointment_time,
          notesWithDeposit,
        ]
      );

      await client.query(
        "UPDATE pending_checkouts SET status = 'paid', updated_at = now() WHERE id = $1",
        [p.id]
      );

      await client.query("DELETE FROM slot_holds WHERE session_id = $1", [p.id]).catch(() => {});

      appointmentData = insertRes.rows[0] || p;
    } else {
      // Fallback: se já estava na tabela appointments
      const searchId = orderNsu;
      if (searchId) {
        const aptRes = await client.query(
          "SELECT id, client_name, client_phone, service_type, appointment_date, appointment_time, notes, status FROM appointments WHERE id = $1 LIMIT 1",
          [searchId]
        );

        if (aptRes.rows.length > 0) {
          const apt = aptRes.rows[0];
          if (apt.status === "confirmed") {
            shouldSendNotification = false;
          }

          const updatedNotes = apt.notes && apt.notes.includes("[Sinal")
            ? (apt.notes.includes("Pago") ? apt.notes : `${apt.notes} [Sinal Pago via InfinitePay]`)
            : `${apt.notes ? apt.notes + " " : ""}[Sinal 50% Pago via InfinitePay]`;

          await client.query(
            "UPDATE appointments SET status = 'confirmed', notes = $1, updated_at = now() WHERE id = $2",
            [updatedNotes, apt.id]
          );
          appointmentData = apt;
        }
      }
    }

    if (!appointmentData) {
      await client.end();
      console.warn(`Registro ${orderNsu || slug} não encontrado para criação de agendamento.`);
      return res.status(200).json({ received: true, not_found: true });
    }

    // 2. Buscar configurações de WhatsApp para disparar a notificação oficial
    if (shouldSendNotification) {
      try {
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

        if (wConfig && wConfig.enabled && wConfig.instance_id && wConfig.instance_token) {
          const rawDate = appointmentData.appointment_date;
          let formattedDate = "";
          if (rawDate instanceof Date) {
            formattedDate = rawDate.toLocaleDateString("pt-BR");
          } else {
            const [y, m, d] = String(rawDate).split("T")[0].split("-");
            formattedDate = `${d}/${m}/${y}`;
          }
          const formattedTime = String(appointmentData.appointment_time).slice(0, 5);

          // Mensagem para a Cliente
          const clientMsg =
            `✨ Olá, *${appointmentData.client_name}*! ✨\n\n` +
            `✅ O seu pagamento de sinal foi *APROVADO* via InfinitePay!\n` +
            `🎉 Seu agendamento está oficialmente *MARCADO E CONFIRMADO*! 💕\n\n` +
            `💅 *Serviço:* ${appointmentData.service_type}\n` +
            `📅 *Data:* ${formattedDate}\n` +
            `🕐 *Horário:* ${formattedTime}\n` +
            `💰 *Sinal:* 50% pago online (restante de 50% a acertar no atendimento)\n\n` +
            `⏰ *Tolerância de 15 minutos para chegada.*\n\n` +
            `📸 *Instagram:* https://www.instagram.com/jessica_magalhaes_nail\n\n` +
            `🙏 Te esperamos com muito carinho! 💕`;

          await sendWhatsAppMessage(
            wConfig.instance_id,
            wConfig.instance_token,
            appointmentData.client_phone,
            clientMsg
          );

          // Mensagem para a Administradora (Jéssica)
          const adminMsg =
            `💰 *NOVO AGENDAMENTO CONFIRMADO (InfinitePay)* 💰\n\n` +
            `O pagamento do sinal de 50% foi aprovado e o horário foi marcado com sucesso!\n\n` +
            `👤 *Cliente:* ${appointmentData.client_name}\n` +
            `📱 *WhatsApp:* ${appointmentData.client_phone}\n` +
            `💅 *Serviço:* ${appointmentData.service_type}\n` +
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
      } catch (wErr) {
        console.error("Erro ao enviar WhatsApp pós-webhook:", wErr.message);
      }
    }

    await client.end();
    return res.status(200).json({ success: true, message: "Agendamento criado e confirmado com sucesso." });
  } catch (error) {
    console.error("Erro no processamento do webhook InfinitePay:", error);
    return res.status(500).json({ error: error.message || String(error) });
  }
}
