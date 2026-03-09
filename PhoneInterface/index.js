const API_URL = "https://api.ecowitt.net/api/v3/device/real_time?application_key=38E4E6CBDE53C4D5AB510E4AD693A522&api_key=547d3f02-e7c4-46d1-bef9-072d402873d8&mac=60:01:94:23:9D:CB&call_back=all&temp_unitid=1&pressure_unitid=3&wind_speed_unitid=6&rainfall_unitid=12";

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
