const API_URL = "https://api.ecowitt.net/api/v3/device/real_time?application_key=38E4E6CBDE53C4D5AB510E4AD693A522&api_key=547d3f02-e7c4-46d1-bef9-072d402873d8&mac=60:01:94:23:9D:CB&call_back=all&temp_unitid=1&pressure_unitid=3&wind_speed_unitid=6&rainfall_unitid=12";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast?latitude=22.50&longitude=113.93&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Asia%2FShanghai&forecast_days=7";
const ECOWITT_HISTORY_BASE_URL = "https://api.ecowitt.net/api/v3/device/history";

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

            applyAtmosphereTheme({ rainRate, solar, temp });
            toggleMetricAlert("uvValue", uv >= 7);
            toggleMetricAlert("windSpeedValue", windSpeed * 3.6 >= 25);
            toggleMetricAlert("windGustValue", windGust * 3.6 >= 35);
            toggleMetricAlert("rainRateValue", rainRate >= 8);

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
    renderHistoryChart(modeData.labels, modeData.highs, modeData.lows, modeData.precipTotals);
    updateChartInsights(modeData.highs, modeData.lows, modeData.precipTotals);
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

updateChartMetaText();
setupChartModeToggle();
updateCurrentWeather();
loadChartModeData();
setInterval(updateCurrentWeather, 10000);
setInterval(refreshCurrentChartModeData, 6 * 60 * 60 * 1000);
