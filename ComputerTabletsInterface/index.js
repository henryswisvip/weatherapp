const API_URL = "https://api.ecowitt.net/api/v3/device/real_time?application_key=38E4E6CBDE53C4D5AB510E4AD693A522&api_key=547d3f02-e7c4-46d1-bef9-072d402873d8&mac=60:01:94:23:9D:CB&call_back=all&temp_unitid=1&pressure_unitid=3&wind_speed_unitid=6&rainfall_unitid=12";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast?latitude=22.50&longitude=113.93&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Asia%2FShanghai&forecast_days=7";
const ECOWITT_HISTORY_BASE_URL = "https://api.ecowitt.net/api/v3/device/history";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "groq/compound";
const GROQ_API_KEY = "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";

const isChinese = window.location.pathname.includes("index_cn");
const units = {
    feelsLike: isChinese ? "体感温度：" : "Feels like: ",
    updated: isChinese ? "更新时间：" : "Last updated: ",
    rainy: isChinese ? "降雨中" : "Rain right now",
    sunny: isChinese ? "晴朗温暖" : "Sunny and warm",
    cool: isChinese ? "天气偏凉" : "Cool weather",
    stable: isChinese ? "天气平稳" : "Stable conditions",
    unavailable: isChinese ? "暂不可用" : "Unavailable",
    chartTitleForecast: isChinese ? "未来 7 天预报" : "7-Day Forecast",
    chartTitleHistory: isChinese ? "过去 7 天历史" : "Last 7 Days History",
    chartToggleToHistory: isChinese ? "查看过去 7 天" : "Show Last 7 Days",
    chartToggleToForecast: isChinese ? "查看未来 7 天" : "Show 7-Day Forecast",
    insightRangeForecast: isChinese ? "今日预报温差" : "Today's Forecast Range",
    insightRangeHistory: isChinese ? "最近一天温差" : "Latest Day Range",
    insightRainForecast: isChinese ? "未来7天总降雨" : "Next 7-Day Rain",
    insightRainHistory: isChinese ? "过去7天总降雨" : "Last 7-Day Rain",
    insightTrendLabel: isChinese ? "趋势信号" : "Trend Signal",
    highLabel: isChinese ? "最高温度" : "High Temperatures",
    lowLabel: isChinese ? "最低温度" : "Low Temperatures",
    precipLabel: isChinese ? "总降雨量" : "Total Precipitation",
    adviceTitle: isChinese ? "今日 AI 建议" : "Today's AI Advice",
    adviceLoading: isChinese ? "正在生成建议..." : "Generating advice...",
    adviceFallbackDry: isChinese ? "今天天气总体平稳，适合外出活动，记得补水并注意防晒。" : "Weather is fairly calm today, so it is a good day to go out; stay hydrated and wear sun protection.",
    adviceFallbackRain: isChinese ? "今天有降雨信号，建议带伞并优先安排室内活动。" : "Rain is likely today, so bring an umbrella and prioritize indoor plans.",
    adviceFallbackHeat: isChinese ? "今天偏热，建议穿轻薄衣物并减少正午户外停留时间。" : "It looks hot today, so wear light clothing and reduce midday outdoor exposure.",
    adviceRefreshButton: isChinese ? "换一句建议" : "Refresh advice",
    adviceError: isChinese ? "无法获取新建议，请稍后再试。" : "Couldn't load new advice. Try again later.",
    historyUnavailable: isChinese ? "历史数据暂不可用" : "History data currently unavailable",
    forecastUnavailable: isChinese ? "预报数据暂不可用" : "Forecast data currently unavailable"
};

let trendChart = null;
let hasLoadedOnce = false;
let chartMode = "history";
const chartDataCache = {
    forecast: null,
    history: null
};
let latestCurrentSnapshot = null;
let latestChartSnapshot = null;
let lastAdviceSignature = "";
let lastAdviceAtMs = 0;

function revealDashboardOnce() {
    if (hasLoadedOnce) return;
    document.body.classList.remove("is-loading");
    document.body.classList.add("is-revealing");
    hasLoadedOnce = true;

    setTimeout(() => {
        document.body.classList.remove("is-revealing");
        document.body.classList.add("is-ready");
    }, 900);
}

function getValue(node, fallback = "--") {
    return typeof node?.value !== "undefined" ? node.value : fallback;
}

function formatNumber(value, digits = 1) {
    return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "--";
}

function degreesToCompass(degrees) {
    const englishDirections = ["North", "NE", "East", "SE", "South", "SW", "West", "NW"];
    const chineseDirections = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
    const directions = isChinese ? chineseDirections : englishDirections;
    const normalized = Number(degrees);

    if (!Number.isFinite(normalized)) {
        return units.unavailable;
    }

    const index = Math.round((normalized % 360) / 45) % 8;
    return directions[index];
}

function selectWeatherIcon(data) {
    const temperature = Number(getValue(data.outdoor?.temperature));
    const solar = Number(getValue(data.solar_and_uvi?.solar));
    const rainRate = Number(getValue(data.rainfall?.rain_rate));

    if (rainRate > 50) return "images/heavy rain .png";
    if (rainRate > 10 && solar > 50) return "images/small rain.png";
    if (rainRate > 10) return "images/rain.png";
    if (rainRate > 0) return "images/drizzle.png";
    if (solar === 0) return "images/moon.png";
    if (temperature < 11) return "images/snow.png";
    if (temperature > 34 && solar > 10) return "images/hot.png";
    if (solar > 100) return "images/clear.png";
    if (solar > 50) return "images/partly cloudy.png";
    if (temperature <= 15) return "images/cloud.png";
    if (solar > 0) return "images/cloudy.png";
    return "images/mist.png";
}

function computeStatus(rainRate, uv, temp) {
    if (rainRate > 0) return units.rainy;
    if (uv >= 6 && temp >= 26) return units.sunny;
    if (temp <= 16) return units.cool;
    return units.stable;
}

function updateText(id, text) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = text;
    }
}

function sanitizeAdviceText(rawText) {
    const cleaned = String(rawText || "")
        .replace(/\s+/g, " ")
        .replace(/[*_`#>-]/g, "")
        .trim();
    if (!cleaned) return "";
    if (isChinese) {
        const firstSentence = cleaned.split(/[。！？]/)[0]?.trim();
        return firstSentence ? `${firstSentence}。` : cleaned.slice(0, 60);
    }
    const firstSentence = cleaned.split(/[.!?]/)[0]?.trim();
    return firstSentence ? `${firstSentence}.` : cleaned.slice(0, 140);
}

function fallbackAdvice() {
    if (!latestCurrentSnapshot) return units.adviceLoading;
    if (latestCurrentSnapshot.rainRate >= 0.1 || latestCurrentSnapshot.todayRain >= 2) return units.adviceFallbackRain;
    if (latestCurrentSnapshot.temp >= 30 || latestCurrentSnapshot.uv >= 6) return units.adviceFallbackHeat;
    return units.adviceFallbackDry;
}

function getTodayPointIndex(modeData) {
    if (!modeData) return -1;
    const todayLabel = isChinese ? "今天" : "Today";
    const index = modeData.labels.indexOf(todayLabel);
    if (index >= 0) return index;
    return chartMode === "forecast" ? 0 : modeData.labels.length - 1;
}

function runAiAdviceFetch(askForDifferent) {
    updateText("aiAdviceTitle", units.adviceTitle);
    if (!latestCurrentSnapshot || !latestChartSnapshot) {
        updateText("aiAdviceText", fallbackAdvice());
        return;
    }
    updateText("aiAdviceText", units.adviceLoading);

    const trendDelta = Number(latestChartSnapshot.highs.at(-1)) - Number(latestChartSnapshot.highs[0]);
    let prompt = isChinese
        ? `地点深圳。当前${formatNumber(latestCurrentSnapshot.temp)}度，紫外线${formatNumber(latestCurrentSnapshot.uv)}，降雨${formatNumber(latestCurrentSnapshot.rainRate)}毫米/时。今日最高${formatNumber(latestCurrentSnapshot.todayHigh)}度、最低${formatNumber(latestCurrentSnapshot.todayLow)}度，降雨${formatNumber(latestCurrentSnapshot.todayRain)}毫米，温度趋势${formatNumber(trendDelta)}度。请根据这些数据给一句温暖、有情绪、让人开心的建议，可以带一点小表情。`
        : `Location Shenzhen. Current ${formatNumber(latestCurrentSnapshot.temp)}°C, UV ${formatNumber(latestCurrentSnapshot.uv)}, rain ${formatNumber(latestCurrentSnapshot.rainRate)} mm/h. Today's high ${formatNumber(latestCurrentSnapshot.todayHigh)}°C, low ${formatNumber(latestCurrentSnapshot.todayLow)}°C, rain ${formatNumber(latestCurrentSnapshot.todayRain)} mm, trend ${formatNumber(trendDelta)}°C. Give one warm, emotional, delightful piece of advice—you may use a few emojis.`;

    let systemContent = isChinese
        ? "你是贴心又活泼的天气小助手。用一句简短、有温度、带点情绪的话给出建议，让人看了心情好。可以用 1～2 个合适的小表情（emoji）。不要列点，只要一句。"
        : "You are a warm, cheerful weather buddy. Reply with one short, delightful sentence that feels emotional and uplifting. You may use 1–2 emojis if they fit. No bullet points—just one friendly line.";

    if (askForDifferent) {
        const nonce = Math.random().toString(36).slice(2, 8);
        prompt += " [ref:" + nonce + "]";
        const varyEn = [
            "This time focus your vibe on what to wear or layers.",
            "This time focus on the best time to go out or cozy up.",
            "This time focus on staying hydrated or sun-safe.",
            "This time focus on indoor vs outdoor plans.",
            "This time focus on staying comfy (cool or warm)."
        ];
        const varyZh = [
            "这次从穿什么、穿几件来给建议。",
            "这次从出门时段或宅家来给建议。",
            "这次从补水或防晒来给建议。",
            "这次从室内外安排来给建议。",
            "这次从体感凉热、舒适度来给建议。"
        ];
        const vary = isChinese ? varyZh[Math.floor(Math.random() * varyZh.length)] : varyEn[Math.floor(Math.random() * varyEn.length)];
        systemContent = (isChinese ? "你是贴心又活泼的天气小助手。用一句简短、有温度的话给建议，可带 1～2 个小表情。" : "You are a warm, cheerful weather buddy. One short, delightful sentence; 1–2 emojis okay.") + " " + vary;
    }

    const refreshBtn = document.getElementById("aiAdviceRefresh");
    if (refreshBtn) {
        refreshBtn.disabled = true;
    }

    const temperature = askForDifferent ? 1.0 : 0.5;

    const doRequest = fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
            model: GROQ_MODEL,
            temperature,
            max_tokens: isChinese ? 80 : 70,
            messages: [
                { role: "system", content: systemContent },
                { role: "user", content: prompt }
            ]
        }),
        cache: "no-store"
    }).then((response) => {
        if (!response.ok) {
            return response.text().then((t) => {
                throw new Error(response.status + " " + (t || response.statusText));
            });
        }
        return response.json();
    }).then((json) => {
        const textResponse = json?.choices?.[0]?.message?.content || "";
        return { text: textResponse };
    });

    doRequest
        .then(({ text }) => {
            const advice = sanitizeAdviceText(text);
            updateText("aiAdviceText", advice || fallbackAdvice());
        })
        .catch((err) => {
            console.error("AI advice request failed:", err);
            updateText("aiAdviceText", units.adviceError);
            setTimeout(() => {
                updateText("aiAdviceText", fallbackAdvice());
            }, 4000);
        })
        .finally(() => {
            if (refreshBtn) {
                refreshBtn.disabled = false;
            }
        });
}

function maybeGenerateAiAdvice() {
    updateText("aiAdviceTitle", units.adviceTitle);
    if (!latestCurrentSnapshot || !latestChartSnapshot) return;

    const nowMs = Date.now();
    const minRefreshMs = 20 * 60 * 1000;
    const adviceSignature = [
        chartMode,
        Math.round(latestCurrentSnapshot.temp),
        Math.round(latestCurrentSnapshot.uv),
        Math.round(latestCurrentSnapshot.rainRate * 10) / 10,
        Math.round(latestCurrentSnapshot.todayHigh),
        Math.round(latestCurrentSnapshot.todayLow),
        Math.round(latestCurrentSnapshot.todayRain * 10) / 10
    ].join("|");

    if (adviceSignature === lastAdviceSignature && nowMs - lastAdviceAtMs < minRefreshMs) {
        return;
    }

    lastAdviceSignature = adviceSignature;
    lastAdviceAtMs = nowMs;
    runAiAdviceFetch();
}

function updateChartMetaText() {
    updateText("chartTitle", chartMode === "forecast" ? units.chartTitleForecast : units.chartTitleHistory);
    updateText("insightRangeLabel", chartMode === "forecast" ? units.insightRangeForecast : units.insightRangeHistory);
    updateText("insightRainLabel", chartMode === "forecast" ? units.insightRainForecast : units.insightRainHistory);
    updateText("insightTrendLabel", units.insightTrendLabel);

    const toggle = document.getElementById("chartModeToggle");
    if (toggle) {
        toggle.textContent = chartMode === "forecast" ? units.chartToggleToHistory : units.chartToggleToForecast;
    }
}

function updateChartInsights(highs, lows, precipTotals) {
    const validHighs = highs.filter((v) => Number.isFinite(v));
    const validLows = lows.filter((v) => Number.isFinite(v));
    const validRain = precipTotals.filter((v) => Number.isFinite(v));

    const lastHigh = validHighs.at(-1);
    const lastLow = validLows.at(-1);
    const dayRange = Number.isFinite(lastHigh) && Number.isFinite(lastLow)
        ? Math.max(0, lastHigh - lastLow)
        : null;

    const rainTotal = validRain.reduce((sum, value) => sum + value, 0);
    const firstHigh = validHighs[0];
    const trendDelta = Number.isFinite(lastHigh) && Number.isFinite(firstHigh)
        ? lastHigh - firstHigh
        : null;

    const trendText = !Number.isFinite(trendDelta)
        ? "--"
        : trendDelta > 1
            ? (isChinese ? "升温中" : "Warming")
            : trendDelta < -1
                ? (isChinese ? "降温中" : "Cooling")
                : (isChinese ? "较稳定" : "Stable");

    updateText("insightRangeValue", dayRange === null ? "--" : `${formatNumber(dayRange)}°C`);
    updateText("insightRainValue", `${formatNumber(rainTotal)} mm`);
    updateText("insightTrendValue", trendText);
}

function formatDateForApi(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getTodayInShanghai() {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());

    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    return `${year}-${month}-${day}`;
}

function addDaysToIso(isoDate, dayOffset) {
    const [year, month, day] = isoDate.split("-").map(Number);
    const utcDate = new Date(Date.UTC(year, month - 1, day));
    utcDate.setUTCDate(utcDate.getUTCDate() + dayOffset);
    return formatDateForApi(utcDate);
}

function getEcowittHistoryUrl(startDate, endDate) {
    const params = new URLSearchParams({
        application_key: "38E4E6CBDE53C4D5AB510E4AD693A522",
        api_key: "547d3f02-e7c4-46d1-bef9-072d402873d8",
        mac: "60:01:94:23:9D:CB",
        call_back: "outdoor.temperature,rainfall.daily",
        cycle_type: "5min",
        start_date: `${startDate} 00:00:00`,
        end_date: `${endDate} 23:59:59`,
        temp_unitid: "1",
        rainfall_unitid: "12"
    });
    return `${ECOWITT_HISTORY_BASE_URL}?${params.toString()}`;
}

function toShanghaiIsoDateFromTimestamp(timestampSeconds) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date(Number(timestampSeconds) * 1000));

    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    return `${year}-${month}-${day}`;
}

function buildLastSevenDatesEndingToday() {
    const today = getTodayInShanghai();
    return Array.from({ length: 7 }, (_, index) => addDaysToIso(today, index - 6));
}

function fetchEcowittHistorySeries() {
    const dates = buildLastSevenDatesEndingToday();
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    const url = getEcowittHistoryUrl(startDate, endDate);

    return fetch(url)
        .then((response) => response.json())
        .then((json) => {
            if (json?.code !== 0) {
                throw new Error(json?.msg || "history_failed");
            }

            const tempList = json?.data?.outdoor?.temperature?.list || {};
            const rainList = json?.data?.rainfall?.daily?.list || {};
            const byDate = new Map(dates.map((date) => [
                date,
                { high: null, low: null, rain: 0 }
            ]));

            Object.entries(tempList).forEach(([ts, value]) => {
                const date = toShanghaiIsoDateFromTimestamp(ts);
                const day = byDate.get(date);
                const numeric = Number(value);
                if (!day || !Number.isFinite(numeric)) return;

                day.high = day.high === null ? numeric : Math.max(day.high, numeric);
                day.low = day.low === null ? numeric : Math.min(day.low, numeric);
            });

            Object.entries(rainList).forEach(([ts, value]) => {
                const date = toShanghaiIsoDateFromTimestamp(ts);
                const day = byDate.get(date);
                const numeric = Number(value);
                if (!day || !Number.isFinite(numeric)) return;
                day.rain = Math.max(day.rain, numeric);
            });

            return {
                dates,
                labels: buildHistoryLabels(dates),
                highs: dates.map((date) => byDate.get(date)?.high),
                lows: dates.map((date) => byDate.get(date)?.low),
                precipTotals: dates.map((date) => byDate.get(date)?.rain ?? 0)
            };
        });
}

function toggleMetricAlert(valueId, isAlert) {
    const valueNode = document.getElementById(valueId);
    const card = valueNode?.closest(".metric-card");
    if (!card) return;
    card.classList.toggle("is-alert", Boolean(isAlert));
}

function applyAtmosphereTheme({ rainRate, solar, temp }) {
    const nowHour = new Date().getHours();
    const isNight = solar <= 0 || nowHour >= 19 || nowHour <= 6;
    let weatherType = "cloudy";

    if (rainRate > 0.1) {
        weatherType = "rain";
    } else if (temp >= 33) {
        weatherType = "hot";
    } else if (solar > 120) {
        weatherType = "clear";
    }

    document.body.dataset.period = isNight ? "night" : "day";
    document.body.dataset.weather = weatherType;
}

function updateCurrentWeather() {
    fetch(API_URL)
        .then((response) => response.json())
        .then((json) => {
            const data = json?.data || {};

            const temp = Number(getValue(data.outdoor?.temperature));
            const feelsLike = Number(getValue(data.outdoor?.feels_like));
            const humidity = Number(getValue(data.outdoor?.humidity));
            const windSpeed = Number(getValue(data.wind?.wind_speed));
            const windGust = Number(getValue(data.wind?.wind_gust));
            const windDirection = Number(getValue(data.wind?.wind_direction));
            const solar = Number(getValue(data.solar_and_uvi?.solar));
            const uv = Number(getValue(data.solar_and_uvi?.uvi));
            const rainRate = Number(getValue(data.rainfall?.rain_rate));

            const icon = document.querySelector(".weather-icon");
            const temperatureNode = document.querySelector(".temperature");
            const descriptionNode = document.querySelector(".description");

            if (icon) {
                icon.src = selectWeatherIcon(data);
            }

            if (temperatureNode) {
                temperatureNode.innerHTML = `${formatNumber(temp, 1)}<span>°C</span>`;
            }

            if (descriptionNode) {
                descriptionNode.textContent = `${units.feelsLike}${formatNumber(feelsLike, 1)}°C`;
            }

            updateText("humidityValue", `${formatNumber(humidity, 0)}%`);
            updateText("windSpeedValue", `${formatNumber(windSpeed * 3.6)} km/h`);
            updateText("windGustValue", `${formatNumber(windGust * 3.6)} km/h`);
            updateText("solarValue", `${formatNumber(solar, 0)} W/m²`);
            updateText("uvValue", formatNumber(uv, 1));
            updateText("windDirectionValue", degreesToCompass(windDirection));
            updateText("rainRateValue", `${formatNumber(rainRate)} mm/h`);
            updateText("feelsLikeValue", `${formatNumber(feelsLike)}°C`);
            updateText("weatherStatus", computeStatus(rainRate, uv, temp));
            updateText("lastUpdated", `${units.updated}${new Date().toLocaleTimeString(isChinese ? "zh-CN" : "en-US")}`);

            if (!latestCurrentSnapshot) {
                latestCurrentSnapshot = {};
            }
            latestCurrentSnapshot.temp = temp;
            latestCurrentSnapshot.uv = uv;
            latestCurrentSnapshot.rainRate = rainRate;

            applyAtmosphereTheme({ rainRate, solar, temp });
            toggleMetricAlert("uvValue", uv >= 7);
            toggleMetricAlert("windSpeedValue", windSpeed * 3.6 >= 25);
            toggleMetricAlert("windGustValue", windGust * 3.6 >= 35);
            toggleMetricAlert("rainRateValue", rainRate >= 8);

            maybeGenerateAiAdvice();
            revealDashboardOnce();
        })
        .catch(() => {
            updateText("weatherStatus", isChinese ? "实时数据加载失败" : "Could not load live data");
            document.body.dataset.weather = "cloudy";
            revealDashboardOnce();
        });
}

function renderHistoryChart(labels, highs, lows, precipTotals) {
    const chartElement = document.getElementById("myChart");
    if (!chartElement) return;

    const ctx = chartElement.getContext("2d");
    if (!ctx) return;

    const highLabel = units.highLabel;
    const lowLabel = units.lowLabel;
    const precipLabel = units.precipLabel;
    const highGradient = ctx.createLinearGradient(0, 0, 0, 320);
    highGradient.addColorStop(0, "rgba(241, 91, 108, 0.28)");
    highGradient.addColorStop(1, "rgba(241, 91, 108, 0)");
    const lowGradient = ctx.createLinearGradient(0, 0, 0, 320);
    lowGradient.addColorStop(0, "rgba(38, 128, 235, 0.22)");
    lowGradient.addColorStop(1, "rgba(38, 128, 235, 0)");
    const rainGradient = ctx.createLinearGradient(0, 0, 0, 320);
    rainGradient.addColorStop(0, "rgba(0, 163, 138, 0.35)");
    rainGradient.addColorStop(1, "rgba(0, 163, 138, 0.02)");
    const maxRainValue = precipTotals.reduce((max, value) => {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
    }, 0);
    const rainAxisMax = Math.max(10, Math.ceil(maxRainValue + 1));

    if (!trendChart) {
        trendChart = new Chart(ctx, {
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: highLabel,
                        data: highs,
                        borderColor: "#f15b6c",
                        backgroundColor: highGradient,
                        pointBackgroundColor: "#f15b6c",
                        tension: 0.36,
                        pointRadius: 2.5,
                        pointHoverRadius: 4,
                        borderWidth: 2.4,
                        yAxisID: "yTemp",
                        fill: true
                    },
                    {
                        label: lowLabel,
                        data: lows,
                        borderColor: "#2680eb",
                        backgroundColor: lowGradient,
                        pointBackgroundColor: "#2680eb",
                        tension: 0.36,
                        pointRadius: 2.5,
                        pointHoverRadius: 4,
                        borderWidth: 2.4,
                        yAxisID: "yTemp",
                        fill: true
                    },
                    {
                        label: precipLabel,
                        data: precipTotals,
                        borderColor: "#00a38a",
                        backgroundColor: rainGradient,
                        pointBackgroundColor: "#00a38a",
                        tension: 0.36,
                        pointRadius: 2,
                        pointHoverRadius: 3.5,
                        borderWidth: 2.2,
                        yAxisID: "yRain",
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: "index",
                    intersect: false
                },
                animation: {
                    duration: 650,
                    easing: "easeOutQuart"
                },
                plugins: {
                    legend: {
                        position: "top",
                        labels: {
                            boxWidth: 26,
                            boxHeight: 9,
                            usePointStyle: false,
                            color: "#355163"
                        }
                    },
                    tooltip: {
                        backgroundColor: "rgba(8, 33, 50, 0.92)",
                        padding: 10
                    }
                },
                scales: {
                    x: {
                        grid: { color: "rgba(15, 76, 117, 0.08)" },
                        ticks: { color: "#627786", maxRotation: 0 }
                    },
                    yTemp: {
                        beginAtZero: false,
                        position: "left",
                        grid: { color: "rgba(15, 76, 117, 0.08)" },
                        ticks: { color: "#627786" }
                    },
                    yRain: {
                        beginAtZero: true,
                        max: rainAxisMax,
                        position: "right",
                        grid: { drawOnChartArea: false },
                        ticks: { color: "#627786" }
                    }
                }
            }
        });
        return;
    }

    trendChart.data.labels = labels;
    trendChart.data.datasets[0].data = highs;
    trendChart.data.datasets[1].data = lows;
    trendChart.data.datasets[2].data = precipTotals;
    if (trendChart.options?.scales?.yRain) {
        trendChart.options.scales.yRain.max = rainAxisMax;
    }
    trendChart.update("none");
}

function buildForecastLabels(dates) {
    const todayStr = getTodayInShanghai();
    const tomorrowStr = addDaysToIso(todayStr, 1);

    return dates.map((dateStr) => {
        if (dateStr === todayStr) {
            return isChinese ? "今天" : "Today";
        }

        if (dateStr === tomorrowStr) {
            return isChinese ? "明天" : "Tomorrow";
        }

        return new Date(dateStr).toLocaleDateString(isChinese ? "zh-CN" : "en-US", {
            weekday: "short"
        });
    });
}

function buildHistoryLabels(dates) {
    const todayStr = getTodayInShanghai();
    return dates.map((dateStr) => {
        if (dateStr === todayStr) {
            return isChinese ? "今天" : "Today";
        }
        const dateObj = new Date(dateStr);
        return dateObj.toLocaleDateString(isChinese ? "zh-CN" : "en-US", {
            weekday: "short"
        });
    });
}

function fetchDailySeries(url, labelBuilder) {
    return fetch(url)
        .then((response) => response.json())
        .then((data) => {
            const daily = data?.daily || {};
            const dates = Array.isArray(daily.time) ? daily.time : [];
            return {
                dates,
                labels: labelBuilder(dates),
                highs: Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max : [],
                lows: Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min : [],
                precipTotals: Array.isArray(daily.precipitation_sum) ? daily.precipitation_sum : []
            };
        });
}

function renderModeData(modeData) {
    latestChartSnapshot = modeData;
    const todayIndex = getTodayPointIndex(modeData);
    if (todayIndex >= 0) {
        if (!latestCurrentSnapshot) latestCurrentSnapshot = {};
        latestCurrentSnapshot.todayHigh = Number(modeData.highs[todayIndex]);
        latestCurrentSnapshot.todayLow = Number(modeData.lows[todayIndex]);
        latestCurrentSnapshot.todayRain = Number(modeData.precipTotals[todayIndex]);
    }
    renderHistoryChart(modeData.labels, modeData.highs, modeData.lows, modeData.precipTotals);
    updateChartInsights(modeData.highs, modeData.lows, modeData.precipTotals);
    maybeGenerateAiAdvice();
}

function loadChartModeData() {
    const activeMode = chartMode;
    const cachedData = chartDataCache[activeMode];
    if (cachedData) {
        renderModeData(cachedData);
        return;
    }

    const request = activeMode === "forecast"
        ? fetchDailySeries(FORECAST_URL, buildForecastLabels)
        : fetchEcowittHistorySeries();

    request
        .then((modeData) => {
            chartDataCache[activeMode] = modeData;
            if (chartMode !== activeMode) return;
            renderModeData(modeData);
        })
        .catch(() => {
            updateText("weatherStatus", activeMode === "forecast" ? units.forecastUnavailable : units.historyUnavailable);
            updateText("insightRangeValue", "--");
            updateText("insightRainValue", "--");
            updateText("insightTrendValue", "--");
        });
}

function setupChartModeToggle() {
    const toggle = document.getElementById("chartModeToggle");
    if (!toggle) return;

    toggle.addEventListener("click", () => {
        chartMode = chartMode === "forecast" ? "history" : "forecast";
        updateChartMetaText();
        loadChartModeData();
    });
}

function refreshCurrentChartModeData() {
    chartDataCache[chartMode] = null;
    loadChartModeData();
}

function setupAdviceRefreshButton() {
    const btn = document.getElementById("aiAdviceRefresh");
    if (!btn) return;
    btn.textContent = units.adviceRefreshButton;
    btn.addEventListener("click", () => {
        lastAdviceSignature = "";
        lastAdviceAtMs = 0;
        runAiAdviceFetch(true);
    });
}

updateChartMetaText();
setupChartModeToggle();
setupAdviceRefreshButton();
updateCurrentWeather();
loadChartModeData();
setInterval(updateCurrentWeather, 10000);
setInterval(refreshCurrentChartModeData, 6 * 60 * 60 * 1000);
