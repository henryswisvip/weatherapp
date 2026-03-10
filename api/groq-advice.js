const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "groq/compound";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Method not allowed" });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "GROQ_API_KEY not configured" });
    }

    const { prompt, systemContent, temperature = 0.5 } = req.body || {};
    if (!prompt || !systemContent) {
        return res.status(400).json({ error: "Missing prompt or systemContent" });
    }

    try {
        const response = await fetch(GROQ_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                temperature: Math.min(1, Math.max(0, Number(temperature) || 0.5)),
                max_tokens: 80,
                messages: [
                    { role: "system", content: systemContent },
                    { role: "user", content: prompt }
                ]
            })
        });

        const data = await response.json();
        if (!response.ok) {
            return res.status(response.status).json({ error: data?.error?.message || "Groq API error" });
        }

        const content = data?.choices?.[0]?.message?.content ?? "";
        return res.status(200).json({ content, text: content });
    } catch (err) {
        console.error("groq-advice error:", err);
        return res.status(500).json({ error: err.message || "Proxy error" });
    }
}
