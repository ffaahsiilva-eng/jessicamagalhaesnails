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
    const { instance_id, instance_token, phone, number, message, text } = body;
    const targetPhone = phone || number;
    const targetMessage = message || text;

    if (!instance_id || !instance_token || !targetPhone || !targetMessage) {
      return res.status(400).json({
        error: "Campos obrigatórios ausentes: instance_id, instance_token, phone/number, message/text",
      });
    }

    const cleanPhone = String(targetPhone).replace(/\D/g, "");
    const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    const endpoint = `https://api.w-api.app/v1/message/send-text?instanceId=${encodeURIComponent(String(instance_id).trim())}`;

    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${String(instance_token).trim()}`,
      },
      body: JSON.stringify({
        phone: formattedPhone,
        number: formattedPhone,
        message: targetMessage,
        text: targetMessage,
      }),
    });

    const resText = await upstream.text();
    let resJson;
    try {
      resJson = JSON.parse(resText);
    } catch {
      resJson = { raw: resText };
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json(resJson);
    }

    return res.status(200).json({ success: true, data: resJson });
  } catch (error) {
    return res.status(500).json({
      error: error && error.message ? error.message : String(error),
    });
  }
}

