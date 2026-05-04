const ECOWITT_APPLICATION_KEY = "38E4E6CBDE53C4D5AB510E4AD693A522";
const ECOWITT_API_KEY = "547d3f02-e7c4-46d1-bef9-072d402873d8";
const ECOWITT_MAC = "60:01:94:23:9D:CB";

const ECOWITT_REALTIME_BASE_URL = "https://api.ecowitt.net/api/v3/device/real_time";
const ECOWITT_HISTORY_BASE_URL = "https://api.ecowitt.net/api/v3/device/history";

const API_URL = `${ECOWITT_REALTIME_BASE_URL}?${new URLSearchParams({
    application_key: ECOWITT_APPLICATION_KEY,
    api_key: ECOWITT_API_KEY,
    mac: ECOWITT_MAC,
    call_back: "all",
    temp_unitid: "1",
    pressure_unitid: "3",
    wind_speed_unitid: "6",
    rainfall_unitid: "12"
}).toString()}`;

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast?latitude=22.50&longitude=113.93&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Asia%2FShanghai&forecast_days=7";

const isChinese = window.location.pathname.includes("index_cn");

const units = {
    feelsLike: isChinese ? "体感温度：" : "Feels like: ",
    updated: isChinese ? "更新时间：" : "Last updated: ",
    rainy: isChinese ? "降雨中" : "Rain right now",
    sunny: isChinese ? "晴朗温暖" : "Sunny and warm",
    cool: isChinese ? "天气偏凉" : "Cool weather",
    stable: isChinese ? "天气平稳" : "Stable conditions",
    unavailable: isChinese ? "暂不可用" : "Unavailable",
    liveUnavailable: isChinese ? "实时数据暂不可用" : "Live data unavailable",
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
    adviceTitle: isChinese ? "今日建议" : "Today's Advice",
    adviceLoading: isChinese ? "正在生成建议..." : "Generating advice...",
    adviceFallbackDry: isChinese ? "今天天气总体平稳，适合外出活动，记得补水并注意防晒。" : "Weather is fairly calm today, so it is a good day to go out; stay hydrated and wear sun protection.",
    adviceFallbackRain: isChinese ? "今天有降雨信号，建议带伞并优先安排室内活动。" : "Rain is likely today, so bring an umbrella and prioritize indoor plans.",
    adviceFallbackHeat: isChinese ? "今天偏热，建议穿轻薄衣物并减少正午户外停留时间。" : "It looks hot today, so wear light clothing and reduce midday outdoor exposure.",
    adviceRefreshButton: isChinese ? "换一句建议" : "Refresh advice",
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
    if (node && typeof node === "object" && typeof node.value !== "undefined") {
        return node.value;
    }

    if (typeof node !== "undefined" && node !== null) {
        return node;
    }

    return fallback;
}

function getByPath(obj, path) {
    return path.split(".").reduce((current, key) => {
        if (current === null || typeof current === "undefined") return undefined;
        return current[key];
    }, obj);
}

function deepFindByKey(obj, keys) {
    if (!obj || typeof obj !== "object") return undefined;

    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            return obj[key];
        }
    }

    for (const value of Object.values(obj)) {
        if (value && typeof value === "object") {
            const found = deepFindByKey(value, keys);

            if (typeof found !== "undefined") {
                return found;
            }
        }
    }

    return undefined;
}

function getFirstValue(data, paths, fallback = "--", deepKeys = []) {
    for (const path of paths) {
        const raw = getByPath(data, path);
        const value = getValue(raw, undefined);

        if (typeof value !== "undefined" && value !== null && value !== "--" && value !== "") {
            return value;
        }
    }

    if (deepKeys.length > 0) {
        const deepRaw = deepFindByKey(data, deepKeys);
        const deepValue = getValue(deepRaw, undefined);

        if (typeof deepValue !== "undefined" && deepValue !== null && deepValue !== "--" && deepValue !== "") {
            return deepValue;
        }
    }

    return fallback;
}

function getNumber(data, paths, fallback = NaN, deepKeys = []) {
    const value = getFirstValue(data, paths, fallback, deepKeys);
    const number = Number(value);

    return Number.isFinite(number) ? number : fallback;
}

function normalizeCurrentData(json) {
    console.log("LIVE WEATHER RESPONSE:", json);

    if (typeof json?.code !== "undefined" && Number(json.code) !== 0) {
        throw new Error(json?.msg || "Live weather API failed");
    }

    if (Array.isArray(json?.summaries) && json.summaries.length > 0) {
        return json.summaries[json.summaries.length - 1];
    }

    if (json?.data && typeof json.data === "object" && !Array.isArray(json.data)) {
        return json.data;
    }

    if (json && typeof json === "object" && !Array.isArray(json)) {
        return json;
    }

    throw new Error("No usable live weather data");
}

function getRainRate(data) {
    return getNumber(data, [
        "metric.precipRate",
        "precipRate",
        "rainfall.rain_rate",
        "rainfall.rainrate",
        "rainfall.rate",
        "rain.rate",
        "rain.rain_rate"
    ], 0, ["precipRate", "rain_rate", "rainrate"]);
}

function getRainTotal(data) {
    return getNumber(data, [
        "metric.precipTotal",
        "precipTotal",
        "rainfall.daily",
        "rainfall.event",
        "rainfall.total",
        "rain.total"
    ], 0, ["precipTotal", "daily", "rain_total"]);
}

function getTemperature(data) {
    return getNumber(data, [
        "outdoor.temperature",
        "outdoor.temp",
        "metric.tempAvg",
        "metric.tempHigh",
        "temperature",
        "temp",
        "tempAvg"
    ], NaN, ["temperature", "tempAvg", "temp"]);
}

function getFeelsLike(data) {
    return getNumber(data, [
        "outdoor.feels_like",
        "outdoor.feelsLike",
        "outdoor.app_temp",
        "outdoor.appTemp",
        "metric.heatindexAvg",
        "metric.windchillAvg",
        "feels_like",
        "feelsLike",
        "app_temp"
    ], NaN, ["feels_like", "feelsLike", "heatindexAvg", "windchillAvg"]);
}

function getHumidity(data) {
    return getNumber(data, [
        "outdoor.humidity",
        "humidity",
        "humidityAvg"
    ], NaN, ["humidity", "humidityAvg"]);
}

function getWindSpeed(data) {
    return getNumber(data, [
        "wind.wind_speed",
        "wind.windspeed",
        "wind.speed",
        "metric.windspeedAvg",
        "wind_speed",
        "windspeed",
        "windspeedAvg"
    ], 0, ["wind_speed", "windspeed", "windspeedAvg"]);
}

function getWindGust(data) {
    return getNumber(data, [
        "wind.wind_gust",
        "wind.windgust",
        "wind.gust",
        "metric.windgustAvg",
        "metric.windgustHigh",
        "wind_gust",
        "windgust",
        "windgustAvg"
    ], 0, ["wind_gust", "windgust", "windgustAvg"]);
}

function getWindDirection(data) {
    return getNumber(data, [
        "wind.wind_direction",
        "wind.winddir",
        "wind.direction",
        "winddirAvg",
        "wind_direction",
        "winddir"
    ], NaN, ["wind_direction", "winddir", "winddirAvg"]);
}

function getSolar(data) {
    return getNumber(data, [
        "solar_and_uvi.solar",
        "solar_and_uvi.solarRadiation",
        "solar.solar",
        "solarRadiationHigh",
        "solarRadiation",
        "solar"
    ], 0, ["solar", "solarRadiationHigh", "solarRadiation"]);
}

function getUv(data) {
    return getNumber(data, [
        "solar_and_uvi.uvi",
        "solar_and_uvi.uv",
        "uvHigh",
        "uv",
        "uvi"
    ], 0, ["uvi", "uv", "uvHigh"]);
}

function hasUsableLiveData(snapshot) {
    return Number.isFinite(snapshot.temp) ||
        Number.isFinite(snapshot.humidity) ||
        Number.isFinite(snapshot.feelsLike);
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
    const temperature = getTemperature(data);
    const solar = getSolar(data);
    const rainRate = getRainRate(data);

    if (rainRate > 50) return "images/heavy rain.png";
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
    if (!Number.isFinite(temp)) return units.liveUnavailable;
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

function createLocalAdvice(askForDifferent = false) {
    if (!latestCurrentSnapshot) return units.adviceLoading;

    const temp = latestCurrentSnapshot.temp;
    const uv = latestCurrentSnapshot.uv;
    const rainRate = latestCurrentSnapshot.rainRate;
    const todayRain = latestCurrentSnapshot.todayRain;

    const rainAdvice = isChinese
        ? [
            "今天有明显降雨信号，出门带伞，鞋子尽量选防滑一点的。",
            "雨势可能影响出行，建议把户外安排压缩一下，优先选择室内活动。",
            "今天比较适合慢一点出门，带伞、避开积水路段会舒服很多。"
        ]
        : [
            "Rain is showing up today, so bring an umbrella and wear shoes that can handle wet ground.",
            "Rain may interrupt outdoor plans, so it is smarter to keep flexible indoor options ready.",
            "Take it slower outside today; an umbrella and water-friendly shoes will make the day easier."
        ];

    const heatAdvice = isChinese
        ? [
            "今天偏热，建议穿轻薄衣物，尽量避开正午长时间暴晒。",
            "紫外线和体感温度都要注意，出门记得补水和防晒。",
            "今天适合轻装出门，水和防晒比什么都重要。"
        ]
        : [
            "It looks hot today, so wear light clothing, drink water, and avoid staying outside too long at noon.",
            "The UV and heat are worth taking seriously today, so use sun protection and stay hydrated.",
            "Go light today: breathable clothes, water, and sunscreen will matter more than anything."
        ];

    const coolAdvice = isChinese
        ? [
            "今天体感偏凉，出门可以多带一件薄外套。",
            "天气不算热，轻薄外套会让你更舒服。",
            "今天适合舒服地出门，早晚注意别着凉。"
        ]
        : [
            "It feels cooler today, so a light layer is probably a good idea.",
            "The weather is on the cooler side, so bring a thin jacket if you will be out for a while.",
            "It is a comfortable day, but mornings and evenings may feel cooler."
        ];

    const normalAdvice = isChinese
        ? [
            "今天天气整体平稳，适合外出活动，记得补水就好。",
            "今天没有太强的天气压力，适合正常安排出门。",
            "天气还算舒服，可以放心安排户外活动。"
        ]
        : [
            "Weather looks fairly calm today, so it is a good day to go out and stay hydrated.",
            "Conditions look stable, so normal outdoor plans should be fine.",
            "It looks like a comfortable day overall, so you can plan your day pretty normally."
        ];

    let pool = normalAdvice;

    if (rainRate >= 0.1 || todayRain >= 2) {
        pool = rainAdvice;
    } else if (temp >= 30 || uv >= 6) {
        pool = heatAdvice;
    } else if (temp <= 16) {
        pool = coolAdvice;
    }

    if (askForDifferent) {
        return pool[Math.floor(Math.random() * pool.length)];
    }

    return pool[0];
}

function fallbackAdvice() {
    return createLocalAdvice(false);
}

function getTodayPointIndex(modeData) {
    if (!modeData) return -1;

    const todayLabel = isChinese ? "今天" : "Today";
    const index = modeData.labels.indexOf(todayLabel);

    if (index >= 0) return index;

    return chartMode === "forecast" ? 0 : modeData.labels.length - 1;
}

function runAiAdviceFetch(askForDifferent = false) {
    updateText("aiAdviceTitle", units.adviceTitle);
    updateText("aiAdviceText", createLocalAdvice(askForDifferent));
}

function maybeGenerateAiAdvice() {
    updateText("aiAdviceTitle", units.adviceTitle);

    if (!latestCurrentSnapshot || !latestChartSnapshot || !Number.isFinite(latestCurrentSnapshot.temp)) {
        updateText("aiAdviceText", fallbackAdvice());
        return;
    }

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
    runAiAdviceFetch(false);
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
    const validHighs = highs.map(Number).filter(Number.isFinite);
    const validLows = lows.map(Number).filter(Number.isFinite);
    const validRain = precipTotals.map(Number).filter(Number.isFinite);

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
        application_key: ECOWITT_APPLICATION_KEY,
        api_key: ECOWITT_API_KEY,
        mac: ECOWITT_MAC,
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

function parseSummaryHistory(json) {
    const summaries = Array.isArray(json?.summaries) ? json.summaries : [];

    const cleaned = summaries
        .filter((item) => item?.obsTimeLocal && item?.metric)
        .slice(-7);

    const dates = cleaned.map((item) => item.obsTimeLocal.slice(0, 10));

    return {
        dates,
        labels: buildHistoryLabels(dates),
        highs: cleaned.map((item) => Number(item.metric?.tempHigh)),
        lows: cleaned.map((item) => Number(item.metric?.tempLow)),
        precipTotals: cleaned.map((item) => Number(item.metric?.precipTotal ?? 0))
    };
}

function parseEcowittHistory(json, dates) {
    const tempList = json?.data?.outdoor?.temperature?.list || {};
    const rainList = json?.data?.rainfall?.daily?.list || {};
    const byDate = new Map(dates.map((date) => [
        date,
        {
            high: null,
            low: null,
            rain: 0
        }
    ]));

    Object.entries(tempList).forEach(([ts, value]) => {
        const date = toShanghaiIsoDateFromTimestamp(ts);
        const day = byDate.get(date);
        const numeric = Number(getValue(value));

        if (!day || !Number.isFinite(numeric)) return;

        day.high = day.high === null ? numeric : Math.max(day.high, numeric);
        day.low = day.low === null ? numeric : Math.min(day.low, numeric);
    });

    Object.entries(rainList).forEach(([ts, value]) => {
        const date = toShanghaiIsoDateFromTimestamp(ts);
        const day = byDate.get(date);
        const numeric = Number(getValue(value));

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
}

function fetchEcowittHistorySeries() {
    const dates = buildLastSevenDatesEndingToday();
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    const url = getEcowittHistoryUrl(startDate, endDate);

    return fetch(url)
        .then((response) => response.json())
        .then((json) => {
            console.log("HISTORY RESPONSE:", json);

            if (Array.isArray(json?.summaries)) {
                return parseSummaryHistory(json);
            }

            if (json?.code !== 0) {
                throw new Error(json?.msg || "history_failed");
            }

            return parseEcowittHistory(json, dates);
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

function showLiveUnavailable() {
    const icon = document.querySelector(".weather-icon");
    const temperatureNode = document.querySelector(".temperature");
    const descriptionNode = document.querySelector(".description");

    if (icon) {
        icon.src = "images/mist.png";
    }

    if (temperatureNode) {
        temperatureNode.innerHTML = `--<span>°C</span>`;
    }

    if (descriptionNode) {
        descriptionNode.textContent = `${units.feelsLike}--°C`;
    }

    updateText("humidityValue", "--%");
    updateText("windSpeedValue", "-- km/h");
    updateText("windGustValue", "-- km/h");
    updateText("solarValue", "-- W/m²");
    updateText("uvValue", "--");
    updateText("windDirectionValue", units.unavailable);
    updateText("rainRateValue", "-- mm/h");
    updateText("feelsLikeValue", "--°C");
    updateText("weatherStatus", units.liveUnavailable);
    updateText("lastUpdated", `${units.updated}${new Date().toLocaleTimeString(isChinese ? "zh-CN" : "en-US")}`);

    document.body.dataset.weather = "cloudy";
}

function updateCurrentWeather() {
    fetch(API_URL)
        .then((response) => response.json())
        .then((json) => {
            const data = normalizeCurrentData(json);

            const snapshot = {
                temp: getTemperature(data),
                feelsLike: getFeelsLike(data),
                humidity: getHumidity(data),
                windSpeed: getWindSpeed(data),
                windGust: getWindGust(data),
                windDirection: getWindDirection(data),
                solar: getSolar(data),
                uv: getUv(data),
                rainRate: getRainRate(data),
                rainTotal: getRainTotal(data)
            };

            console.log("PARSED LIVE WEATHER:", snapshot);

            if (!hasUsableLiveData(snapshot)) {
                throw new Error("Live response loaded, but expected weather fields were not found");
            }

            const icon = document.querySelector(".weather-icon");
            const temperatureNode = document.querySelector(".temperature");
            const descriptionNode = document.querySelector(".description");

            if (icon) {
                icon.src = selectWeatherIcon(data);
            }

            if (temperatureNode) {
                temperatureNode.innerHTML = `${formatNumber(snapshot.temp, 1)}<span>°C</span>`;
            }

            if (descriptionNode) {
                descriptionNode.textContent = `${units.feelsLike}${formatNumber(snapshot.feelsLike, 1)}°C`;
            }

            updateText("humidityValue", `${formatNumber(snapshot.humidity, 0)}%`);
            updateText("windSpeedValue", `${formatNumber(snapshot.windSpeed)} km/h`);
            updateText("windGustValue", `${formatNumber(snapshot.windGust)} km/h`);
            updateText("solarValue", `${formatNumber(snapshot.solar, 0)} W/m²`);
            updateText("uvValue", formatNumber(snapshot.uv, 1));
            updateText("windDirectionValue", degreesToCompass(snapshot.windDirection));
            updateText("rainRateValue", `${formatNumber(snapshot.rainRate)} mm/h`);
            updateText("feelsLikeValue", `${formatNumber(snapshot.feelsLike)}°C`);
            updateText("weatherStatus", computeStatus(snapshot.rainRate, snapshot.uv, snapshot.temp));
            updateText("lastUpdated", `${units.updated}${new Date().toLocaleTimeString(isChinese ? "zh-CN" : "en-US")}`);

            if (!latestCurrentSnapshot) {
                latestCurrentSnapshot = {};
            }

            latestCurrentSnapshot.temp = snapshot.temp;
            latestCurrentSnapshot.uv = snapshot.uv;
            latestCurrentSnapshot.rainRate = snapshot.rainRate;

            if (Number.isFinite(snapshot.rainTotal)) {
                latestCurrentSnapshot.todayRain = snapshot.rainTotal;
            }

            applyAtmosphereTheme({
                rainRate: snapshot.rainRate,
                solar: snapshot.solar,
                temp: snapshot.temp
            });

            toggleMetricAlert("uvValue", snapshot.uv >= 7);
            toggleMetricAlert("windSpeedValue", snapshot.windSpeed >= 25);
            toggleMetricAlert("windGustValue", snapshot.windGust >= 35);
            toggleMetricAlert("rainRateValue", snapshot.rainRate >= 8);

            maybeGenerateAiAdvice();
            revealDashboardOnce();
        })
        .catch((err) => {
            console.error("Current weather request failed:", err);
            showLiveUnavailable();
            revealDashboardOnce();
        });
}

function renderHistoryChart(labels, highs, lows, precipTotals) {
    const chartElement = document.getElementById("myChart");

    if (!chartElement) return;

    if (typeof Chart === "undefined") {
        console.error("Chart.js is not loaded.");
        return;
    }

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
                        grid: {
                            color: "rgba(15, 76, 117, 0.08)"
                        },
                        ticks: {
                            color: "#627786",
                            maxRotation: 0
                        }
                    },
                    yTemp: {
                        beginAtZero: false,
                        position: "left",
                        grid: {
                            color: "rgba(15, 76, 117, 0.08)"
                        },
                        ticks: {
                            color: "#627786"
                        }
                    },
                    yRain: {
                        beginAtZero: true,
                        max: rainAxisMax,
                        position: "right",
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            color: "#627786"
                        }
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

        const dateObj = new Date(`${dateStr}T00:00:00+08:00`);

        return dateObj.toLocaleDateString(isChinese ? "zh-CN" : "en-US", {
            weekday: "short",
            timeZone: "Asia/Shanghai"
        });
    });
}

function buildHistoryLabels(dates) {
    const todayStr = getTodayInShanghai();

    return dates.map((dateStr) => {
        if (dateStr === todayStr) {
            return isChinese ? "今天" : "Today";
        }

        const dateObj = new Date(`${dateStr}T00:00:00+08:00`);

        return dateObj.toLocaleDateString(isChinese ? "zh-CN" : "en-US", {
            weekday: "short",
            timeZone: "Asia/Shanghai"
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
        .catch((err) => {
            console.error("Chart data request failed:", err);

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

setInterval(updateCurrentWeather, 30000);
setInterval(refreshCurrentChartModeData, 6 * 60 * 60 * 1000);
