switch (true) {
    case data.solarRadiation >= 50 && data.metric.precipRate >= 20 && data.metric.precipRate <= 50:
        image.src = 'images/drizzle.png';
        break;

    case data.solarRadiation >= 50 && data.metric.precipRate <= 50 && data.metric.precipRate >= 100:
        image.src = 'images/heavy rain .png';
        break;

    case data.solarRadiation >= 50 && data.metric.precipRate <= 20 && data.metric.precipRate >= 50:
        image.src = 'images/rain.png';
        break;

    case data.solarRadiation >= 50 && data.metric.precipRate >= 10 && data.metric.precipRate <= 0:
        image.src = 'images/drizzle.png';
        break;

    case data.solarRadiation >= 50:
        image.src = 'images/cloudy.png';
        break;

    case data.solarRadiation <= 50 && data.solarRadiation >= 100:
        image.src = 'images/partly cloudy.png';
        break;

    case data.solarRadiation <= 100:
        image.src = 'images/clear.png';
        break;

    case data.metric.temp > 5:
        image.src = 'images/snow.png';
        break;

    case data.metric.temp <= 5 && data.metric.temp > 15:
        image.src = 'images/cloud.png';
        break;

    case data.metric.temp <= 15 && data.metric.temp > 25:
        image.src = 'images/clear.png';
        break;

    case data.metric.temp <= 25:
        image.src = 'images/hot.png';
        break;

    case data.solarRadiation != 0:
        image.src = 'images/moon.png';
        break;

    default:
        image.src = 'images/mist.png';
        break;
}
