const API_URL = "https://api.ecowitt.net/api/v3/device/real_time?application_key=38E4E6CBDE53C4D5AB510E4AD693A522&api_key=547d3f02-e7c4-46d1-bef9-072d402873d8&mac=60:01:94:23:9D:CB&call_back=all&temp_unitid=1&pressure_unitid=3&wind_speed_unitid=6&rainfall_unitid=12";
const API_INFO_URL = API_URL.replace("/real_time?", "/info?");

const isChinese = window.location.pathname.includes("index_cn");
const text = {
    feelsLike: isChinese ? "体感温度：" : "Feels like: ",
    updated: isChinese ? "更新时间：" : "Last updated: ",
    rainy: isChinese ? "降雨中" : "Rain right now",
    sunny: isChinese ? "晴朗温暖" : "Sunny and warm",
    cool: isChinese ? "天气偏凉" : "Cool weather",
    stable: isChinese ? "天气平稳" : "Stable conditions",
    loadingError: isChinese ? "实时数据加载失败" : "Could not load live data"
};
let hasLoadedOnce = false;

function getValue(node, fallback = "--") {
    if (node === null || typeof node === "undefined") {
        return fallback;
    }
    if (typeof node === "object") {
        if (typeof node.value !== "undefined") return node.value;
        if (typeof node.val !== "undefined") return node.val;
    }
    return node;
}

function getPathValue(source, path) {
    return path.split(".").reduce((acc, key) => acc?.[key], source);
}

function readByAliases(source, aliases, fallback = "--") {
    for (const alias of aliases) {
        const candidate = getValue(getPathValue(source, alias), undefined);
        if (candidate !== undefined && candidate !== null && candidate !== "") {
            return candidate;
        }
    }
    return fallback;
}

function normalizeWeatherShape(rawData = {}) {
    return {
        outdoor: {
            temperature: readByAliases(rawData, ["outdoor.temperature", "outdoor.temp", "metric.temp"]),
            feels_like: readByAliases(rawData, ["outdoor.feels_like", "outdoor.feelsLike", "metric.heatIndex", "metric.windChill"]),
            humidity: readByAliases(rawData, ["outdoor.humidity", "humidity", "metric.humidity"])
        },
        wind: {
            wind_speed: readByAliases(rawData, ["wind.wind_speed", "wind.windSpeed", "metric.windSpeed"]),
            wind_gust: readByAliases(rawData, ["wind.wind_gust", "wind.windGust", "metric.windGust"]),
            wind_direction: readByAliases(rawData, ["wind.wind_direction", "wind.windDirection", "winddir", "windDir"])
        },
        solar_and_uvi: {
            solar: readByAliases(rawData, ["solar_and_uvi.solar", "solarAndUvi.solar", "solarRadiation"]),
            uvi: readByAliases(rawData, ["solar_and_uvi.uvi", "solarAndUvi.uvi", "solar_and_uvi.uv", "uv"])
        },
        rainfall: {
            rain_rate: readByAliases(rawData, ["rainfall.rain_rate", "rainfall.rainRate", "metric.precipRate", "rainRate"])
        }
    };
}

function extractWeatherData(json) {
    const payload = json?.data;
    if (payload && typeof payload === "object" && !Array.isArray(payload) && payload.last_update) {
        return normalizeWeatherShape(payload.last_update);
    }
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        return normalizeWeatherShape(payload);
    }
    if (Array.isArray(payload) && payload.length > 0) {
        const first = payload[0];
        return normalizeWeatherShape(first?.last_update || first);
    }
    if (json?.observations?.[0]) {
        return normalizeWeatherShape(json.observations[0]);
    }
    return null;
}

function fetchCurrentWeatherData() {
    return fetch(API_URL)
        .then((response) => response.json())
        .then((json) => extractWeatherData(json))
        .then((data) => {
            if (data) return data;
            return fetch(API_INFO_URL)
                .then((response) => response.json())
                .then((json) => {
                    const fallbackData = extractWeatherData(json);
                    if (fallbackData) return fallbackData;
                    throw new Error("No weather data available");
                });
        });
}

function formatNumber(value, digits = 1) {
    return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "--";
}

function degreesToCompass(degrees) {
    const englishDirections = ["North", "NE", "East", "SE", "South", "SW", "West", "NW"];
    const chineseDirections = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
    const directions = isChinese ? chineseDirections : englishDirections;
    const normalized = Number(degrees);
    if (!Number.isFinite(normalized)) return "--";
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
    if (rainRate > 0) return text.rainy;
    if (uv >= 6 && temp >= 26) return text.sunny;
    if (temp <= 16) return text.cool;
    return text.stable;
}

function updateText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function revealDashboardOnce() {
    if (hasLoadedOnce) return;
    document.body.classList.remove("is-loading");
    document.body.classList.add("is-revealing");
    hasLoadedOnce = true;

    setTimeout(() => {
        document.body.classList.remove("is-revealing");
        document.body.classList.add("is-ready");
    }, 850);
}

function applyAtmosphereTheme({ rainRate, solar, temp }) {
    const nowHour = new Date().getHours();
    const isNight = solar <= 0 || nowHour >= 19 || nowHour <= 6;
    let weatherType = "cloudy";

    if (rainRate > 0.1) weatherType = "rain";
    else if (temp >= 33) weatherType = "hot";
    else if (solar > 120) weatherType = "clear";

    document.body.dataset.period = isNight ? "night" : "day";
    document.body.dataset.weather = weatherType;
}

function updateCurrentWeather() {
    fetchCurrentWeatherData()
        .then((data) => {
            const temp = Number(getValue(data.outdoor?.temperature));
            const feelsLike = Number(getValue(data.outdoor?.feels_like));
            const humidity = Number(getValue(data.outdoor?.humidity));
            const windSpeed = Number(getValue(data.wind?.wind_speed));
            const windGust = Number(getValue(data.wind?.wind_gust));
            const windDirection = Number(getValue(data.wind?.wind_direction));
            const uv = Number(getValue(data.solar_and_uvi?.uvi));
            const solar = Number(getValue(data.solar_and_uvi?.solar));
            const rainRate = Number(getValue(data.rainfall?.rain_rate));

            const icon = document.querySelector(".weather-icon");
            if (icon) {
                icon.src = selectWeatherIcon(data);
            }

            const temperatureNode = document.querySelector(".temperature");
            if (temperatureNode) {
                temperatureNode.innerHTML = `${formatNumber(temp)}<span>°C</span>`;
            }

            const descriptionNode = document.querySelector(".description");
            if (descriptionNode) {
                descriptionNode.textContent = `${text.feelsLike}${formatNumber(feelsLike)}°C`;
            }

            updateText("humidityValue", `${formatNumber(humidity, 0)}%`);
            updateText("windSpeedValue", `${formatNumber(windSpeed * 3.6)} km/h`);
            updateText("windGustValue", `${formatNumber(windGust * 3.6)} km/h`);
            updateText("uvValue", formatNumber(uv, 1));
            updateText("windDirectionValue", degreesToCompass(windDirection));
            updateText("rainRateValue", `${formatNumber(rainRate)} mm/h`);
            updateText("feelsLikeValue", `${formatNumber(feelsLike)}°C`);
            updateText("weatherStatus", computeStatus(rainRate, uv, temp));
            updateText("lastUpdated", `${text.updated}${new Date().toLocaleTimeString(isChinese ? "zh-CN" : "en-US")}`);
            applyAtmosphereTheme({ rainRate, solar, temp });
            revealDashboardOnce();
        })
        .catch(() => {
            updateText("weatherStatus", text.loadingError);
            document.body.dataset.weather = "cloudy";
            revealDashboardOnce();
        });
}

updateCurrentWeather();
setInterval(updateCurrentWeather, 10000);
