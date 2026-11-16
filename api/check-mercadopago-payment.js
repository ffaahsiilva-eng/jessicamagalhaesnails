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
  let accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || "";

  try {
    const client = new Client({
      connectionString: CONNECTION_STRING,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    const res = await client.query(
      "SELECT key, value FROM site_settings WHERE key = 'mercadopago_access_token'"
    );
    await client.end();

    if (res.rows.length > 0 && res.rows[0].value) {
      accessToken = res.rows[0].value.trim();
    }
  } catch (err) {
    console.warn("Aviso ao buscar token do Mercado Pago:", err.message);
  }

  return { accessToken };
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
    const payment_id = req.query?.payment_id || req.body?.payment_id || req.query?.collection_id || req.body?.collection_id;
    const preference_id = req.query?.preference_id || req.body?.preference_id;
    const incomingStatus = req.query?.status || req.query?.collection_status || req.body?.status;

    if (!order_nsu && !payment_id && !preference_id) {
      return res.status(400).json({ error: "order_nsu, payment_id ou preference_id é obrigatório." });
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
    if ((!pendingRes || pendingRes.rows.length === 0) && preference_id) {
      pendingRes = await client.query(
        "SELECT * FROM pending_checkouts WHERE payment_url LIKE $1 LIMIT 1",
        [`%${preference_id}%`]
      );
    }

    const pendingRow = pendingRes && pendingRes.rows.length > 0 ? pendingRes.rows[0] : null;

    if (pendingRow && pendingRow.status === "paid") {
      const notesWithDeposit = pendingRow.notes && pendingRow.notes.includes("[Sinal")
        ? (pendingRow.notes.includes("Pago") ? pendingRow.notes : `${pendingRow.notes} [Sinal Pago via Mercado Pago]`)
        : `${pendingRow.notes ? pendingRow.notes + " " : ""}[Sinal 50% Pago via Mercado Pago]`;

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

    // 3. Consultar Mercado Pago API
    const config = await getPaymentConfig();
    let isPaid = false;
    let paymentData = null;

    if (config.accessToken) {
      if (payment_id && payment_id !== "null") {
        try {
          const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
            headers: { Authorization: `Bearer ${config.accessToken}` },
          });
          if (mpRes.ok) {
            paymentData = await mpRes.json();
            if (paymentData.status === "approved") {
              isPaid = true;
            }
          }
        } catch (err) {
          console.warn("Erro ao consultar pagamento por ID no Mercado Pago:", err.message);
        }
      }

      // Se ainda não confirmou, buscar pelo external_reference
      const refToSearch = order_nsu || pendingRow?.id;
      if (!isPaid && refToSearch) {
        try {
          const searchRes = await fetch(
            `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(refToSearch)}&sort=date_created&criteria=desc`,
            {
              headers: { Authorization: `Bearer ${config.accessToken}` },
            }
          );
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            const results = searchData.results || [];
            const approved = results.find((p) => p.status === "approved");
            if (approved) {
              isPaid = true;
              paymentData = approved;
            }
          }
        } catch (err) {
          console.warn("Erro ao buscar pagamento por external_reference no Mercado Pago:", err.message);
        }
      }
    }

    // Fallback: se o retorno da URL redirecionada do Mercado Pago veio com status=approved e temos payment_id
    if (!isPaid && incomingStatus === "approved" && (payment_id || order_nsu)) {
      isPaid = true;
    }

    const orderNsuToUse = order_nsu || pendingRow?.id;

    if (isPaid && (pendingRow || orderNsuToUse)) {
      let appointmentData = null;

      if (pendingRow) {
        const notesWithDeposit = pendingRow.notes && pendingRow.notes.includes("[Sinal")
          ? (pendingRow.notes.includes("Pago") ? pendingRow.notes : `${pendingRow.notes} [Sinal Pago via Mercado Pago]`)
          : `${pendingRow.notes ? pendingRow.notes + " " : ""}[Sinal 50% Pago via Mercado Pago]`;

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
                 ELSE CONCAT(COALESCE(notes, ''), ' [Sinal Pago via Mercado Pago]')
               END,
               updated_at = now()
           WHERE id = $1
           RETURNING *`,
          [orderNsuToUse]
        );
        appointmentData = aptRes.rows[0];
      }

      // Notificações WhatsApp
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
              `✅ O seu pagamento de sinal foi *APROVADO* via Mercado Pago!\n` +
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
              `💰 *NOVO AGENDAMENTO CONFIRMADO (Mercado Pago)* 💰\n\n` +
              `O pagamento do sinal de 50% foi aprovado e o horário foi marcado com sucesso!\n\n` +
              `👤 *Cliente:* ${appointmentData.client_name}\n` +
              `📱 *WhatsApp:* ${appointmentData.client_phone}\n` +
              `💅 *Serviço:* ${appointmentData.service_type}\n` +
              `📅 *Data:* ${formattedDate} às ${formattedTime}\n` +
              `💳 *Status:* Confirmado automaticamente via Mercado Pago\n\n` +
              `📋 Painel:\nhttps://jessicamagalhaesnail.vercel.app/admin`;

            await sendWhatsAppMessage(
              wConfig.instance_id,
              wConfig.instance_token,
              wConfig.admin_number,
              adminMsg
            );
          }
        } catch (wErr) {
          console.error("Erro ao enviar WhatsApp pós check payment Mercado Pago:", wErr.message);
        }
      }

      await client.end();
      return res.status(200).json({
        paid: true,
        data: paymentData,
        appointment: appointmentData,
      });
    }

    await client.end();
    return res.status(200).json({
      paid: false,
      data: paymentData,
    });
  } catch (error) {
    console.error("Erro em check-mercadopago-payment:", error);
    return res.status(500).json({
      error: error && error.message ? error.message : String(error),
    });
  }
}
