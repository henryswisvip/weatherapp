import Foundation

public enum WeatherStatus: String, Codable, Sendable {
    case rainNow
    case sunnyAndWarm
    case cool
    case stable

    public var title: String {
        switch self {
        case .rainNow:
            return "Rain right now"
        case .sunnyAndWarm:
            return "Sunny and warm"
        case .cool:
            return "Cool weather"
        case .stable:
            return "Stable conditions"
        }
    }
}

public struct WeatherCurrent: Codable, Sendable {
    public var temperatureC: Double
    public var feelsLikeC: Double
    public var humidityPercent: Double
    public var windSpeedKmh: Double
    public var windGustKmh: Double
    public var windDirectionDegrees: Double
    public var uvIndex: Double
    public var solarWm2: Double
    public var rainRateMmPerHour: Double
    public var status: WeatherStatus
    public var symbolName: String
    public var lastUpdated: Date

    public init(
        temperatureC: Double,
        feelsLikeC: Double,
        humidityPercent: Double,
        windSpeedKmh: Double,
        windGustKmh: Double,
        windDirectionDegrees: Double,
        uvIndex: Double,
        solarWm2: Double,
        rainRateMmPerHour: Double,
        status: WeatherStatus,
        symbolName: String,
        lastUpdated: Date
    ) {
        self.temperatureC = temperatureC
        self.feelsLikeC = feelsLikeC
        self.humidityPercent = humidityPercent
        self.windSpeedKmh = windSpeedKmh
        self.windGustKmh = windGustKmh
        self.windDirectionDegrees = windDirectionDegrees
        self.uvIndex = uvIndex
        self.solarWm2 = solarWm2
        self.rainRateMmPerHour = rainRateMmPerHour
        self.status = status
        self.symbolName = symbolName
        self.lastUpdated = lastUpdated
    }
}

public struct ForecastDay: Codable, Identifiable, Sendable {
    public var id: String { dateISO }
    public var dateISO: String
    public var highC: Double
    public var lowC: Double
    public var precipitationMm: Double

    public init(dateISO: String, highC: Double, lowC: Double, precipitationMm: Double) {
        self.dateISO = dateISO
        self.highC = highC
        self.lowC = lowC
        self.precipitationMm = precipitationMm
    }
}

public struct WeatherSnapshot: Codable, Sendable {
    public var current: WeatherCurrent
    public var forecast: [ForecastDay]

    public init(current: WeatherCurrent, forecast: [ForecastDay]) {
        self.current = current
        self.forecast = forecast
    }

    public static let sample = WeatherSnapshot(
        current: WeatherCurrent(
            temperatureC: 27.4,
            feelsLikeC: 30.1,
            humidityPercent: 82,
            windSpeedKmh: 6.3,
            windGustKmh: 9.2,
            windDirectionDegrees: 145,
            uvIndex: 3.4,
            solarWm2: 214,
            rainRateMmPerHour: 0,
            status: .stable,
            symbolName: "cloud.sun.fill",
            lastUpdated: Date()
        ),
        forecast: [
            ForecastDay(dateISO: "2026-03-25", highC: 29, lowC: 23, precipitationMm: 0.2),
            ForecastDay(dateISO: "2026-03-26", highC: 30, lowC: 24, precipitationMm: 1.8),
            ForecastDay(dateISO: "2026-03-27", highC: 31, lowC: 24, precipitationMm: 3.4)
        ]
    )
}
