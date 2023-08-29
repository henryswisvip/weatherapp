const APIUrl = `https://api.ecowitt.net/api/v3/device/real_time?application_key=38E4E6CBDE53C4D5AB510E4AD693A522&api_key=547d3f02-e7c4-46d1-bef9-072d402873d8&mac=60:01:94:23:9D:CB&call_back=all&temp_unitid=1&pressure_uni tid=3&wind_speed_unitid=6&rainfall_unitid=12`;
const container = document.querySelector('.container');
const search = document.querySelector('.search-box button');
const weatherBox = document.querySelector('.weather-box');
const weatherDetails = document.querySelector('.weather-details');
const error404 = document.querySelector('.not-found');
const radiation = document.querySelector('.radiation');
const windd = document.querySelector('.windd');


function degreesToCompass(degrees) {
    const directionsEnglish = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const directionsChinese = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];

    // Check if the URL contains "/index_cn", and select the appropriate direction array
    const directions = window.location.pathname.includes("/index_cn") ? directionsChinese : directionsEnglish;

    const index = Math.round(((degrees % 360) / 45));
    const direction = directions[index] || directions[0];

    // If Chinese, return the character; otherwise, expand single directions or return the combined one
    if (window.location.pathname.includes("/index_cn")) return direction;

    switch (direction) {
        case "N": return "North";
        case "E": return "East";
        case "S": return "South";
        case "W": return "West";
        default: return direction;
    }
}

// Determine the language:
const language = document.documentElement.lang;

function fetchCurrentWeatherData() {
    fetch(APIUrl)
        .then(response => response.json())
        .then(json => {
            const data = json.data;
            console.log(data);
            const image = document.querySelector('.weather-box img');
            const temperature = document.querySelector('.weather-box .temperature');
            const description = document.querySelector('.weather-box .description');
            const humidity = document.querySelector('.weather-details .humidity span');
            const wind = document.querySelector('.weather-details .wind span');
            const solarRadiation = document.querySelector('.radiation .SolarRadiation span');
            const UV = document.querySelector('.radiation .UV span');
            const winddir = document.querySelector('.windd .winddir span');
            const windChill = document.querySelector('.windd .windChill span');
            switch (true) {

                case data.rainfall.rain_rate.value > 50:
                    image.src = 'images/heavy rain .png';
                    break;
                case data.solar_and_uvi.solar.value > 50 && data.rainfall.rain_rate.value > 10 && data.rainfall.rain_rate.value < 50:
                    image.src = 'images/small rain.png';
                    break;
                case data.rainfall.rain_rate.value > 10 && data.rainfall.rain_rate.value < 50:
                    image.src = 'images/rain.png';
                    break;

                case data.rainfall.rain_rate.value < 10 && data.rainfall.rain_rate.value > 0:
                    image.src = 'images/drizzle.png';
                    break;
                case data.solar_and_uvi.solar.value < 50 && data.rainfall.rain_rate.value == 0 && data.solar_and_uvi.solar.value != 0 && data.outdoor.temperature.value < 34 :
                    image.src = 'images/cloudy.png';
                    break;
                case data.solar_and_uvi.solar.value > 50 && data.solar_and_uvi.solar.value < 100 && data.rainfall.rain_rate.value == 0:
                    image.src = 'images/partly cloudy.png';
                    break;
                case data.outdoor.temperature.value > 5 && data.outdoor.temperature.value <= 15:
                    image.src = 'images/cloud.png';
                    break;
                case data.outdoor.temperature.value > 34 && data.solar_and_uvi.solar.value > 10:
                    image.src = 'images/hot.png';
                    break;
                case data.solar_and_uvi.solar.value == 0:
                        image.src = 'images/moon.png';
                        break;
                case data.solar_and_uvi.solar.value > 100:
                    image.src = 'images/clear.png';
                    break;



                case data.outdoor.temperature.value < 11:
                    image.src = 'images/snow.png';
                    break;

                case data.outdoor.temperature.value > 15 && data.outdoor.temperature.value <= 25:
                    image.src = 'images/clear.png';
                    break;


                default:
                    image.src = 'images/mist.png';
                    break;
            }

        
            
            temperature.innerHTML = `${data.outdoor.temperature.value}<span>°C</span>`;
            
            
            
            if (window.location.pathname.includes("/index_cn")) {
            description.innerHTML = `体感温度: ${data.outdoor.feels_like.value}<span>℃</span>`;
            } else {
            description.innerHTML = `Feels Like: ${data.outdoor.feels_like.value}<span>°C</span>`;
            }

            humidity.innerHTML = `${data.outdoor.humidity.value}%`;
            wind.innerHTML = `${(data.wind.wind_speed.value * 3.6).toFixed(1)} km/h`; // Converting m/s to km/h
            solarRadiation.innerHTML = `${data.solar_and_uvi.solar.value} W/m²`;
            UV.innerHTML = `${data.solar_and_uvi.uvi.value}`;
            winddir.innerHTML = `${degreesToCompass(data.wind.wind_direction.value)}`;
            const rainRateValue = parseFloat(data.rainfall.rain_rate.value);
            windChill.innerHTML = `${rainRateValue.toFixed(1)} mm/hr`;
        

            
            // Show weather data
            weatherBox.style.display = '';
            weatherDetails.style.display = '';
            weatherBox.classList.add('fadeIn');
            weatherDetails.classList.add('fadeIn');
            container.style.height = '590px';
        })
        .catch(error => {
            console.log(error);
        });
}

fetchCurrentWeatherData();
setInterval(fetchCurrentWeatherData, 10000);

function fetchHistoricalWeatherData() {
    fetch('https://api.weather.com/v2/pws/dailysummary/7day?stationId=ISHENZ61&format=json&units=m&apiKey=2fc44795e5144333844795e514d3338f')
        .then(response => response.json())
        .then(data => {
            const highs = data.summaries.map(summary => summary.metric.tempHigh);
            const lows = data.summaries.map(summary => summary.metric.tempLow);
            const precipTotals = data.summaries.map(summary => summary.metric.precipTotal); // Added this line

            // Determine the language based on the URL path
            const isChinese = window.location.pathname.includes("/index_cn");

            // Labels for English or Chinese versions
            const labels = isChinese ? ['7天前', '6天前', '5天前', '4天前', '3天前', '2天前', '昨天/今天'] : ['7 days ago', '6 days ago', '5 days ago', '4 days ago', '3 days ago', '2 days ago', 'Yesterday'];
            const highLabel = isChinese ? '最高温度' : 'High Temperatures';
            const lowLabel = isChinese ? '最低温度' : 'Low Temperatures';
            const precipLabel = isChinese ? '总降水量' : 'Total Precipitation';

            const ctx = document.getElementById('myChart').getContext('2d');
            const chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels, // Using dynamic labels
                    datasets: [
                        {
                            label: highLabel, // Using dynamic label
                            data: highs,
                            borderColor: 'rgba(255, 99, 132, 1)',
                            fill: false
                        },
                        {
                            label: lowLabel, // Using dynamic label
                            data: lows,
                            borderColor: 'rgba(54, 162, 235, 1)',
                            fill: false
                        },
                        {
                            label: precipLabel, // Using dynamic label
                            data: precipTotals,
                            borderColor: 'rgba(75, 192, 192, 1)',
                            fill: false
                        }
                    ]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        });
}


fetchHistoricalWeatherData();
setInterval(fetchHistoricalWeatherData, 12 * 60 * 60 * 1000);

languageButton.addEventListener('click', () => {
    // Code to change the language of the page goes here
});
