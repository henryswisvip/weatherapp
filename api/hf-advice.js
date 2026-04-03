const HUGGING_FACE_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";
const HUGGING_FACE_MODELS = [
    "meta-llama/Llama-3.1-8B-Instruct",
    "Qwen/Qwen2.5-7B-Instruct",
    "katanemo/Arch-Router-1.5B"
];

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Method not allowed" });
    }

    const apiKey = process.env.HF_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "HF_API_KEY not configured" });
    }

    const { prompt, systemContent, temperature = 0.5, max_tokens = 70 } = req.body || {};
    if (!prompt || !systemContent) {
        return res.status(400).json({ error: "Missing prompt or systemContent" });
    }

    for (let i = 0; i < HUGGING_FACE_MODELS.length; i++) {
        const model = HUGGING_FACE_MODELS[i];
        try {
            const response = await fetch(HUGGING_FACE_CHAT_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model,
                    temperature: Math.min(1, Math.max(0, Number(temperature) || 0.5)),
                    max_tokens: Number(max_tokens) || 70,
                    messages: [
                        { role: "system", content: systemContent },
                        { role: "user", content: prompt }
                    ]
                })
            });

            const data = await response.json();
            if (!response.ok) {
                if (i < HUGGING_FACE_MODELS.length - 1) continue;
                return res.status(response.status).json({ error: data?.error?.message || "HuggingFace API error" });
            }

            const content = data?.choices?.[0]?.message?.content ?? "";
            if (!content.trim() && i < HUGGING_FACE_MODELS.length - 1) continue;

            return res.status(200).json({ text: content, model });
        } catch (err) {
            if (i < HUGGING_FACE_MODELS.length - 1) continue;
            console.error("hf-advice error:", err);
            return res.status(500).json({ error: err.message || "Proxy error" });
        }
    }
}
