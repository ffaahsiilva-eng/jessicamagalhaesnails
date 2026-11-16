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

async function getPaymentConfig() {
  let handle = process.env.INFINITEPAY_HANDLE || "paifilhoespirito";
  let apiKey = process.env.INFINITEPAY_API_KEY || "inchk_cIQ0seCo6bb6xA4y5_MasUTjWuT9T_5Mmqmhb5cVSSA";

  try {
    const client = new Client({
      connectionString: CONNECTION_STRING,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    const res = await client.query(
      "SELECT key, value FROM site_settings WHERE key IN ('infinitepay_handle', 'infinitepay_api_key')"
    );
    await client.end();

    res.rows.forEach((r) => {
      if (r.key === "infinitepay_handle" && r.value) handle = r.value.trim();
      if (r.key === "infinitepay_api_key" && r.value) apiKey = r.value.trim();
    });
  } catch (err) {
    console.warn("Aviso ao buscar configurações de pagamento do banco:", err.message);
  }

  return { handle, apiKey };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const order_nsu = req.query?.order_nsu || req.body?.order_nsu || req.body?.appointment_id;
    const slug = req.query?.slug || req.body?.slug;
    const transaction_nsu = req.query?.transaction_nsu || req.body?.transaction_nsu;
    const receipt_url = req.query?.receipt_url || req.body?.receipt_url;

    if (!order_nsu && !slug && !transaction_nsu) {
      return res.status(400).json({ error: "order_nsu, slug ou transaction_nsu é obrigatório." });
    }

    const client = new Client({
      connectionString: CONNECTION_STRING,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();

    // 1. Verificar se já existe agendamento confirmado no banco
    if (order_nsu) {
      const confirmedAptRes = await client.query(
        "SELECT * FROM appointments WHERE id = $1 AND status = 'confirmed' LIMIT 1",
        [order_nsu]
      );
      if (confirmedAptRes.rows.length > 0) {
        await client.end();
        return res.status(200).json({
          paid: true,
          already_confirmed: true,
          appointment: confirmedAptRes.rows[0],
        });
      }
    }

    // 2. Buscar o registro em pending_checkouts
    let pendingRes = null;
    if (order_nsu) {
      pendingRes = await client.query(
        "SELECT * FROM pending_checkouts WHERE id = $1 LIMIT 1",
        [order_nsu]
      );
    }
    if ((!pendingRes || pendingRes.rows.length === 0) && slug) {
      pendingRes = await client.query(
        "SELECT * FROM pending_checkouts WHERE payment_url LIKE $1 LIMIT 1",
        [`%${slug}%`]
      );
    }

    const pendingRow = pendingRes && pendingRes.rows.length > 0 ? pendingRes.rows[0] : null;

    // Se já está marcado como pago no pending_checkouts (por exemplo, pelo webhook simultâneo)
    if (pendingRow && pendingRow.status === "paid") {
      // Garantir que existe o agendamento em appointments
      const notesWithDeposit = pendingRow.notes && pendingRow.notes.includes("[Sinal")
        ? (pendingRow.notes.includes("Pago") ? pendingRow.notes : `${pendingRow.notes} [Sinal Pago via InfinitePay]`)
        : `${pendingRow.notes ? pendingRow.notes + " " : ""}[Sinal 50% Pago via InfinitePay]`;

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
          pendingRow.id,
          pendingRow.user_id || null,
          pendingRow.client_name,
          pendingRow.client_phone,
          pendingRow.client_email,
          pendingRow.service_type,
          pendingRow.appointment_date,
          pendingRow.appointment_time,
          notesWithDeposit,
        ]
      );
      await client.end();
      return res.status(200).json({
        paid: true,
        appointment: insertRes.rows[0] || pendingRow,
      });
    }

    // 3. Consultar a API da InfinitePay
    const config = await getPaymentConfig();
    const slugToUse = slug || (pendingRow?.payment_url ? pendingRow.payment_url.split("/").pop() : null);
    const orderNsuToUse = order_nsu || pendingRow?.id;

    const bodyPayload = {
      handle: config.handle,
    };
    if (orderNsuToUse) bodyPayload.order_nsu = String(orderNsuToUse);
    if (slugToUse) bodyPayload.slug = String(slugToUse);
    if (transaction_nsu) bodyPayload.transaction_nsu = String(transaction_nsu);

    let checkData = null;
    try {
      const infiniteRes = await fetch("https://api.checkout.infinitepay.io/payment_check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": config.apiKey,
        },
        body: JSON.stringify(bodyPayload),
      });
      checkData = await infiniteRes.json();
    } catch (err) {
      console.warn("Erro ao chamar payment_check na InfinitePay:", err.message);
    }

    // O pagamento é considerado concluído se a InfinitePay confirmar OU se o cliente retornou do redirect com transaction_nsu e receipt_url
    const isPaid =
      checkData?.success === true ||
      checkData?.paid === true ||
      (Boolean(transaction_nsu) && Boolean(receipt_url)) ||
      (Boolean(transaction_nsu) && String(transaction_nsu).length > 8);

    if (isPaid && (pendingRow || orderNsuToUse)) {
      let appointmentData = null;

      if (pendingRow) {
        const notesWithDeposit = pendingRow.notes && pendingRow.notes.includes("[Sinal")
          ? (pendingRow.notes.includes("Pago") ? pendingRow.notes : `${pendingRow.notes} [Sinal Pago via InfinitePay]`)
          : `${pendingRow.notes ? pendingRow.notes + " " : ""}[Sinal 50% Pago via InfinitePay]`;

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
            pendingRow.id,
            pendingRow.user_id || null,
            pendingRow.client_name,
            pendingRow.client_phone,
            pendingRow.client_email,
            pendingRow.service_type,
            pendingRow.appointment_date,
            pendingRow.appointment_time,
            notesWithDeposit,
          ]
        );

        await client.query(
          "UPDATE pending_checkouts SET status = 'paid', updated_at = now() WHERE id = $1",
          [pendingRow.id]
        );

        await client.query("DELETE FROM slot_holds WHERE session_id = $1", [pendingRow.id]).catch(() => {});
        appointmentData = insertRes.rows[0] || pendingRow;
      } else {
        const aptRes = await client.query(
          `UPDATE appointments
           SET status = 'confirmed',
               notes = CASE
                 WHEN notes ILIKE '%[Sinal Pago%' THEN notes
                 ELSE CONCAT(COALESCE(notes, ''), ' [Sinal Pago via InfinitePay]')
               END,
               updated_at = now()
           WHERE id = $1
           RETURNING *`,
          [orderNsuToUse]
        );
        appointmentData = aptRes.rows[0];
      }

      // Disparar notificações de WhatsApp
      if (appointmentData) {
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
          console.error("Erro ao enviar WhatsApp pós check payment:", wErr.message);
        }
      }

      await client.end();
      return res.status(200).json({
        paid: true,
        data: checkData,
        appointment: appointmentData,
      });
    }

    await client.end();
    return res.status(200).json({
      paid: false,
      data: checkData,
    });
  } catch (error) {
    console.error("Erro em check-infinitepay-payment:", error);
    return res.status(500).json({
      error: error && error.message ? error.message : String(error),
    });
  }
}
