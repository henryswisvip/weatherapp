const APIKey = '367af7dad35a4d88baf7dad35a8d88dc';
const APIUrl = `https://api.weather.com/v2/pws/observations/current?stationId=ISHENZ61&format=json&units=m&apiKey=${APIKey}`;
const container = document.querySelector('.container');
const search = document.querySelector('.search-box button');
const weatherBox = document.querySelector('.weather-box');
const weatherDetails = document.querySelector('.weather-details');
const error404 = document.querySelector('.not-found');
const radiation = document.querySelector('.radiation');
const windd = document.querySelector('.windd');

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

                case data.solarRadiation < 50 && data.metric.precipRate < 20 && data.metric.precipRate > 0:
                    image.src = 'images/drizzle.png';

                case data.solarRadiation < 50 AND data.metric.precipRate > 50 AND data.metric.precipRate < 100:
                    image.src = 'images/heavy rain .png';
                    break;
                    
                case data.solarRadiation < 50 && data.metric.precipRate > 20 && data.metric.precipRate < 50:
                    image.src = 'images/rain.png';
                    break;
                case data.solarRadiation < 50 && data.metric.precipRate < 10 && data.metric.precipRate > 0:
                    image.src = 'images/drizzle.png';
                    break;
                case data.solarRadiation < 50:
                    image.src = 'images/cloudy.png';
                    break;
                case data.solarRadiation > 50 && data.solarRadiation < 100:
                    image.src = 'images/partly cloudy.png';
                    break;
                case data.solarRadiation > 100:
                    image.src = 'images/clear.png';
                    break;
                case data.metric.temp <= 5:
                    image.src = 'images/snow.png';
                    break;
                case data.metric.temp > 5 && data.metric.temp <= 15:
                    image.src = 'images/cloud.png';
                    break;
                case data.metric.temp > 15 && data.metric.temp <= 25:
                    image.src = 'images/clear.png';
                    break;
                case data.metric.temp > 25:
                    image.src = 'images/hot.png';
                    break;
                case data.solarRadiation == 0:
                    image.src = 'images/moon.png';
                    break;

                default:
                    image.src = 'images/mist.png';
                    break;
            }

        
            
            temperature.innerHTML = `${data.metric.temp}<span>°C</span>`;
            description.innerHTML = `Weather: ${data.metric.temp}`;
            humidity.innerHTML = `${data.humidity}%`;
            wind.innerHTML = `${data.metric.windSpeed} km/h`;
            solarRadiation.innerHTML = `${data.solarRadiation} kWh`;
            UV.innerHTML = `${data.uv} mW`;
            winddir.innerHTML = `${data.winddir}<span>°</span>`;
             windChill.innerHTML = `${data.metric.windChill} Twc`;

            
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
    fetch('https://api.weather.com/v2/pws/dailysummary/7day?stationId=ISHENZ61&format=json&units=m&apiKey=367af7dad35a4d88baf7dad35a8d88dc')
        .then(response => response.json())
        .then(data => {
            const highs = data.summaries.map(summary => summary.metric.tempHigh);
            const lows = data.summaries.map(summary => summary.metric.tempLow);

            const ctx = document.getElementById('myChart').getContext('2d');
            const chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['7 days ago', '6 days ago', '5 days ago', '4 days ago', '3 days ago', '2 days ago', 'Yesterday'],
                    datasets: [
                        {
                            label: 'High Temperatures',
                            data:highs,
                            borderColor: 'rgba(255, 99, 132, 1)',
                            fill: false
                        },
                        {
                            label: 'Low Temperatures',
                            data:lows,
                            borderColor: 'rgba(54, 162, 235, 1)',
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
setInterval(fetchHistoricalWeatherData, 40000);
