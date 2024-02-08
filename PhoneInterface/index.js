const APIUrl = `https://api.ecowitt.net/api/v3/device/real_time?application_key=38E4E6CBDE53C4D5AB510E4AD693A522&api_key=547d3f02-e7c4-46d1-bef9-072d402873d8&mac=60:01:94:23:9D:CB&call_back=all&temp_unitid=1&pressure_uni tid=3&wind_speed_unitid=6&rainfall_unitid=12`;
const container = document.querySelector('.container');
const search = document.querySelector('.search-box button');
const weatherBox = document.querySelector('.weather-box');
const weatherDetails = document.querySelector('.weather-details');
const error404 = document.querySelector('.not-found');

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

                        case data.solar_and_uvi.solar.value > 100:
                    image.src = 'images/clear.png';
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
            wind.innerHTML = `${(data.wind.wind_speed.value * 3.6).toFixed(1)} km/h`;

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
