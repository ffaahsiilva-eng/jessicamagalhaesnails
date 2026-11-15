import { Client } from "pg";

const CONNECTION_STRING =
  process.env.DATABASE_URL ||
  "postgresql://postgres.nhsbtfilpxsvylqsrbsa:@Filhodorei123@aws-0-us-east-1.pooler.supabase.com:6543/postgres";

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

    if (!order_nsu && !slug) {
      return res.status(400).json({ error: "order_nsu ou slug é obrigatório." });
    }

    const config = await getPaymentConfig();

    const bodyPayload = {
      handle: config.handle,
    };
    if (order_nsu) bodyPayload.order_nsu = String(order_nsu);
    if (slug) bodyPayload.slug = String(slug);

    const infiniteRes = await fetch("https://api.checkout.infinitepay.io/payment_check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": config.apiKey,
      },
      body: JSON.stringify(bodyPayload),
    });

    const checkData = await infiniteRes.json();
    const isPaid = checkData?.success === true || checkData?.paid === true;

    // Se estiver pago, converte o pending_checkouts em agendamento confirmado!
    if (isPaid && order_nsu) {
      try {
        const client = new Client({
          connectionString: CONNECTION_STRING,
          ssl: { rejectUnauthorized: false },
        });
        await client.connect();

        const pendingRes = await client.query(
          "SELECT * FROM pending_checkouts WHERE id = $1 LIMIT 1",
          [order_nsu]
        );

        if (pendingRes.rows.length > 0) {
          const p = pendingRes.rows[0];
          const notesWithDeposit = p.notes && p.notes.includes("[Sinal")
            ? p.notes
            : `${p.notes ? p.notes + " " : ""}[Sinal 50% Pago via InfinitePay]`;

          await client.query(
            `INSERT INTO appointments (
              id, user_id, client_name, client_phone, client_email, service_type,
              appointment_date, appointment_time, notes, status, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, 'confirmed', now(), now()
            ) ON CONFLICT (id) DO UPDATE SET
              status = 'confirmed',
              notes = EXCLUDED.notes,
              updated_at = now()`,
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
        } else {
          // Atualiza se já existia na appointments
          await client.query(
            `UPDATE appointments
             SET status = 'confirmed',
                 notes = CASE
                   WHEN notes ILIKE '%[Sinal Pago%' THEN notes
                   ELSE CONCAT(COALESCE(notes, ''), ' [Sinal Pago via InfinitePay]')
                 END,
                 updated_at = now()
             WHERE id = $1 AND status != 'confirmed'`,
            [order_nsu]
          );
        }

        await client.end();
      } catch (dbErr) {
        console.warn("Aviso ao atualizar agendamento após payment_check:", dbErr.message);
      }
    }

    return res.status(200).json({
      paid: isPaid,
      data: checkData,
    });
  } catch (error) {
    return res.status(500).json({
      error: error && error.message ? error.message : String(error),
    });
  }
}
