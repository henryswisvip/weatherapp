const APIKey = '2fc44795e5144333844795e514d3338f';
const APIUrl = `https://api.weather.com/v2/pws/observations/current?stationId=ISHENZ61&format=json&units=m&apiKey=${APIKey}`;
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
            const data = json.observations[0];
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

                case data.metric.precipRate > 50:
                    image.src = 'images/heavy rain .png';
                    break;
                case data.solarRadiation > 50 && data.metric.precipRate > 10 && data.metric.precipRate < 50:
                    image.src = 'images/small rain.png';
                    break;
                case data.metric.precipRate > 10 && data.metric.precipRate < 50:
                    image.src = 'images/rain.png';
                    break;

                case data.metric.precipRate < 10 && data.metric.precipRate > 0:
                    image.src = 'images/drizzle.png';
                    break;
                case data.solarRadiation < 50 && data.metric.precipRate == 0 && data.solarRadiation != 0 && data.metric.temp < 34 :
                    image.src = 'images/cloudy.png';
                    break;
                case data.solarRadiation > 50 && data.solarRadiation < 100 && data.metric.precipRate == 0:
                    image.src = 'images/partly cloudy.png';
                    break;
                case data.metric.temp > 5 && data.metric.temp <= 15:
                    image.src = 'images/cloud.png';
                    break;
                case data.metric.temp > 34 && data.solarRadiation > 10:
                    image.src = 'images/hot.png';
                    break;
                case data.solarRadiation == 0:
                        image.src = 'images/moon.png';
                        break;
                case data.solarRadiation > 100:
                    image.src = 'images/clear.png';
                    break;



                case data.metric.temp < 11:
                    image.src = 'images/snow.png';
                    break;

                case data.metric.temp > 15 && data.metric.temp <= 25:
                    image.src = 'images/clear.png';
                    break;


                default:
                    image.src = 'images/mist.png';
                    break;
            }

        
            
            temperature.innerHTML = `${data.metric.temp}<span>°C</span>`;
            description.innerHTML = `Feels Like: ${data.metric.heatIndex}<span>°C</span>`;
            humidity.innerHTML = `${data.humidity}%`;
            wind.innerHTML = `${data.metric.windSpeed} km/h`;
            solarRadiation.innerHTML = `${data.solarRadiation} kWh`;
            UV.innerHTML = `${data.uv} mW`;
           winddir.innerHTML = `${degreesToCompass(data.winddir)}`;
            windChill.innerHTML = `${data.metric.precipRate.toFixed(1)} mm/hr`;

            
            // Show weather data
            weatherBox.style.display = '';
            weatherDetails.style.display = '';
            weatherBox.classList.add('fadeIn');
            weatherDetails.classList.add('fadeIn');
            container.style.height = '590px';


fetchCurrentWeatherData();
setInterval(fetchCurrentWeatherData, 25000);

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
