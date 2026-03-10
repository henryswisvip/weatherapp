const AQI_UPSTREAM =
    "https://air-quality.api.open-meteo.com/v1/air-quality?latitude=22.50&longitude=113.93&hourly=us_aqi&forecast_days=1";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).json({ error: "Method not allowed" });
    }
    try {
        const response = await fetch(AQI_UPSTREAM);
        const data = await response.json();
        if (!response.ok) {
            return res.status(response.status).json(data);
        }
        res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=300");
        return res.status(200).json(data);
    } catch (err) {
        console.error("aqi proxy error:", err);
        return res.status(500).json({ error: err.message || "AQI fetch failed" });
    }
}
