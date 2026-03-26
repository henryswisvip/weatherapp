@preconcurrency import Foundation

public struct WeatherConfiguration: Sendable {
    public var ecowittApplicationKey: String
    public var ecowittAPIKey: String
    public var ecowittMAC: String
    public var latitude: Double
    public var longitude: Double
    public var timezone: String
    public var forecastDays: Int

    public init(
        ecowittApplicationKey: String = "38E4E6CBDE53C4D5AB510E4AD693A522",
        ecowittAPIKey: String = "547d3f02-e7c4-46d1-bef9-072d402873d8",
        ecowittMAC: String = "60:01:94:23:9D:CB",
        latitude: Double = 22.50,
        longitude: Double = 113.93,
        timezone: String = "Asia/Shanghai",
        forecastDays: Int = 7
    ) {
        self.ecowittApplicationKey = ecowittApplicationKey
        self.ecowittAPIKey = ecowittAPIKey
        self.ecowittMAC = ecowittMAC
        self.latitude = latitude
        self.longitude = longitude
        self.timezone = timezone
        self.forecastDays = forecastDays
    }

    public static let `default` = WeatherConfiguration()
}

public enum WeatherServiceError: LocalizedError {
    case invalidRealtimeResponse
    case invalidForecastResponse
    case invalidHistoryResponse
    case historyFailure(message: String)
    case networkFailure(statusCode: Int)

    public var errorDescription: String? {
        switch self {
        case .invalidRealtimeResponse:
            return "Could not parse real-time weather response."
        case .invalidForecastResponse:
            return "Could not parse forecast response."
        case .invalidHistoryResponse:
            return "Could not parse historical weather response."
        case .historyFailure(let message):
            return "Historical weather request failed: \(message)"
        case .networkFailure(let statusCode):
            return "Weather request failed with HTTP \(statusCode)."
        }
    }
}

public struct WeatherService: Sendable {
    private let configuration: WeatherConfiguration
    private let session: URLSession

    public init(configuration: WeatherConfiguration = .default, session: URLSession = .shared) {
        self.configuration = configuration
        self.session = session
    }

    public func loadSnapshot() async throws -> WeatherSnapshot {
        async let current = fetchCurrentWeather()
        async let forecast = fetchForecast()
        async let history = fetchHistory()
        return try await WeatherSnapshot(current: current, forecast: forecast, history: history)
    }

    public func loadSnapshot(completion: @escaping (Result<WeatherSnapshot, Error>) -> Void) {
        requestData(with: makeRealtimeURL()) { realtimeResult in
            switch realtimeResult {
            case .failure(let error):
                completion(.failure(error))
            case .success(let realtimeData):
                requestData(with: makeForecastURL()) { forecastResult in
                    switch forecastResult {
                    case .failure(let error):
                        completion(.failure(error))
                    case .success(let forecastData):
                        requestData(with: makeHistoryURL()) { historyResult in
                            switch historyResult {
                            case .failure(let error):
                                completion(.failure(error))
                            case .success(let historyData):
                                do {
                                    let current = try decodeCurrent(from: realtimeData)
                                    let forecast = try decodeForecast(from: forecastData)
                                    let history = try decodeHistory(from: historyData)
                                    completion(.success(WeatherSnapshot(current: current, forecast: forecast, history: history)))
                                } catch {
                                    completion(.failure(error))
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    public func fetchCurrentWeather() async throws -> WeatherCurrent {
        let data = try await requestData(from: makeRealtimeURL())
        return try decodeCurrent(from: data)
    }

    public func fetchForecast() async throws -> [ForecastDay] {
        let data = try await requestData(from: makeForecastURL())
        return try decodeForecast(from: data)
    }

    public func fetchHistory() async throws -> [HistoryDay] {
        let data = try await requestData(from: makeHistoryURL())
        return try decodeHistory(from: data)
    }

    private func decodeCurrent(from data: Data) throws -> WeatherCurrent {
        let decoder = JSONDecoder()
        let envelope = try decoder.decode(RealtimeEnvelope.self, from: data)

        guard let weather = envelope.data else {
            throw WeatherServiceError.invalidRealtimeResponse
        }

        let temp = weather.outdoor?.temperature?.value ?? .zero
        let feelsLike = weather.outdoor?.feelsLike?.value ?? .zero
        let humidity = weather.outdoor?.humidity?.value ?? .zero
        let windSpeedMps = weather.wind?.windSpeed?.value ?? .zero
        let windGustMps = weather.wind?.windGust?.value ?? .zero
        let windDirection = weather.wind?.windDirection?.value ?? .zero
        let solar = weather.solarAndUvi?.solar?.value ?? .zero
        let uv = weather.solarAndUvi?.uvi?.value ?? .zero
        let rainRate = weather.rainfall?.rainRate?.value ?? .zero

        return WeatherCurrent(
            temperatureC: temp,
            feelsLikeC: feelsLike,
            humidityPercent: humidity,
            windSpeedKmh: windSpeedMps * 3.6,
            windGustKmh: windGustMps * 3.6,
            windDirectionDegrees: windDirection,
            uvIndex: uv,
            solarWm2: solar,
            rainRateMmPerHour: rainRate,
            status: computeStatus(rainRate: rainRate, uv: uv, temp: temp),
            symbolName: selectSymbol(temp: temp, solar: solar, rainRate: rainRate),
            lastUpdated: Date()
        )
    }

    private func decodeForecast(from data: Data) throws -> [ForecastDay] {
        let decoder = JSONDecoder()
        let envelope = try decoder.decode(ForecastEnvelope.self, from: data)

        guard
            let dates = envelope.daily?.time,
            let highs = envelope.daily?.temperatureMax,
            let lows = envelope.daily?.temperatureMin,
            let rains = envelope.daily?.precipitationSum
        else {
            throw WeatherServiceError.invalidForecastResponse
        }

        let count = min(dates.count, highs.count, lows.count, rains.count)
        guard count > 0 else {
            throw WeatherServiceError.invalidForecastResponse
        }

        return (0..<count).map { index in
            ForecastDay(
                dateISO: dates[index],
                highC: highs[index],
                lowC: lows[index],
                precipitationMm: rains[index]
            )
        }
    }

    private func decodeHistory(from data: Data) throws -> [HistoryDay] {
        let decoder = JSONDecoder()
        let envelope = try decoder.decode(HistoryEnvelope.self, from: data)

        if envelope.code != 0 {
            throw WeatherServiceError.historyFailure(message: envelope.message ?? "Unknown history API error.")
        }

        let dates = buildLastSevenDatesEndingToday()
        guard !dates.isEmpty else {
            throw WeatherServiceError.invalidHistoryResponse
        }

        var byDate = Dictionary(uniqueKeysWithValues: dates.map {
            ($0, HistoryAggregate(high: nil, low: nil, rain: 0))
        })

        let temperatureSeries = envelope.data?.outdoor?.temperature?.list ?? [:]
        for (timestamp, seriesValue) in temperatureSeries {
            guard
                let epochSeconds = Double(timestamp),
                let value = seriesValue.value
            else {
                continue
            }

            let isoDate = isoDateString(forUnixSeconds: epochSeconds)
            guard var aggregate = byDate[isoDate] else {
                continue
            }

            aggregate.high = max(aggregate.high ?? value, value)
            aggregate.low = min(aggregate.low ?? value, value)
            byDate[isoDate] = aggregate
        }

        let rainSeries = envelope.data?.rainfall?.daily?.list ?? [:]
        for (timestamp, seriesValue) in rainSeries {
            guard
                let epochSeconds = Double(timestamp),
                let value = seriesValue.value
            else {
                continue
            }

            let isoDate = isoDateString(forUnixSeconds: epochSeconds)
            guard var aggregate = byDate[isoDate] else {
                continue
            }

            aggregate.rain = max(aggregate.rain, value)
            byDate[isoDate] = aggregate
        }

        return dates.map { date in
            let aggregate = byDate[date] ?? HistoryAggregate(high: nil, low: nil, rain: 0)
            return HistoryDay(
                dateISO: date,
                highC: aggregate.high,
                lowC: aggregate.low,
                precipitationMm: aggregate.rain
            )
        }
    }

    private func requestData(from url: URL) async throws -> Data {
        let (data, response) = try await session.data(from: url)
        guard let http = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        guard 200..<300 ~= http.statusCode else {
            throw WeatherServiceError.networkFailure(statusCode: http.statusCode)
        }
        return data
    }

    private func requestData(with url: URL, completion: @escaping (Result<Data, Error>) -> Void) {
        let completionBox = DataCompletionBox(completion)
        session.dataTask(with: url) { data, response, error in
            if let error {
                completionBox.completion(.failure(error))
                return
            }

            guard let http = response as? HTTPURLResponse else {
                completionBox.completion(.failure(URLError(.badServerResponse)))
                return
            }

            guard 200..<300 ~= http.statusCode else {
                completionBox.completion(.failure(WeatherServiceError.networkFailure(statusCode: http.statusCode)))
                return
            }

            guard let data else {
                completionBox.completion(.failure(WeatherServiceError.invalidRealtimeResponse))
                return
            }

            completionBox.completion(.success(data))
        }.resume()
    }

    private func makeRealtimeURL() -> URL {
        var components = URLComponents(string: "https://api.ecowitt.net/api/v3/device/real_time")!
        components.queryItems = [
            URLQueryItem(name: "application_key", value: configuration.ecowittApplicationKey),
            URLQueryItem(name: "api_key", value: configuration.ecowittAPIKey),
            URLQueryItem(name: "mac", value: configuration.ecowittMAC),
            URLQueryItem(name: "call_back", value: "all"),
            URLQueryItem(name: "temp_unitid", value: "1"),
            URLQueryItem(name: "pressure_unitid", value: "3"),
            URLQueryItem(name: "wind_speed_unitid", value: "6"),
            URLQueryItem(name: "rainfall_unitid", value: "12")
        ]
        return components.url!
    }

    private func makeForecastURL() -> URL {
        var components = URLComponents(string: "https://api.open-meteo.com/v1/forecast")!
        components.queryItems = [
            URLQueryItem(name: "latitude", value: String(format: "%.2f", configuration.latitude)),
            URLQueryItem(name: "longitude", value: String(format: "%.2f", configuration.longitude)),
            URLQueryItem(name: "daily", value: "temperature_2m_max,temperature_2m_min,precipitation_sum"),
            URLQueryItem(name: "timezone", value: configuration.timezone),
            URLQueryItem(name: "forecast_days", value: String(configuration.forecastDays))
        ]
        return components.url!
    }

    private func makeHistoryURL() -> URL {
        let dates = buildLastSevenDatesEndingToday()
        let startDate = dates.first ?? isoDateString(for: Date())
        let endDate = dates.last ?? startDate

        var components = URLComponents(string: "https://api.ecowitt.net/api/v3/device/history")!
        components.queryItems = [
            URLQueryItem(name: "application_key", value: configuration.ecowittApplicationKey),
            URLQueryItem(name: "api_key", value: configuration.ecowittAPIKey),
            URLQueryItem(name: "mac", value: configuration.ecowittMAC),
            URLQueryItem(name: "call_back", value: "outdoor.temperature,rainfall.daily"),
            URLQueryItem(name: "cycle_type", value: "5min"),
            URLQueryItem(name: "start_date", value: "\(startDate) 00:00:00"),
            URLQueryItem(name: "end_date", value: "\(endDate) 23:59:59"),
            URLQueryItem(name: "temp_unitid", value: "1"),
            URLQueryItem(name: "rainfall_unitid", value: "12")
        ]
        return components.url!
    }

    private func buildLastSevenDatesEndingToday() -> [String] {
        let calendar = shanghaiCalendar
        let today = calendar.startOfDay(for: Date())

        return (0..<7).compactMap { offset in
            guard let day = calendar.date(byAdding: .day, value: offset - 6, to: today) else {
                return nil
            }
            return isoDateString(for: day)
        }
    }

    private var shanghaiCalendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: configuration.timezone) ?? .current
        return calendar
    }

    private func isoDateString(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = shanghaiCalendar
        formatter.timeZone = shanghaiCalendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    private func isoDateString(forUnixSeconds seconds: Double) -> String {
        isoDateString(for: Date(timeIntervalSince1970: seconds))
    }

    private func selectSymbol(temp: Double, solar: Double, rainRate: Double) -> String {
        if rainRate > 50 {
            return "cloud.heavyrain.fill"
        }
        if rainRate > 10 && solar > 50 {
            return "cloud.sun.rain.fill"
        }
        if rainRate > 10 {
            return "cloud.rain.fill"
        }
        if rainRate > 0 {
            return "cloud.drizzle.fill"
        }
        if solar == 0 {
            return "moon.stars.fill"
        }
        if temp < 11 {
            return "cloud.snow.fill"
        }
        if temp > 34 && solar > 10 {
            return "thermometer.sun.fill"
        }
        if solar > 100 {
            return "sun.max.fill"
        }
        if solar > 50 {
            return "cloud.sun.fill"
        }
        if temp <= 15 {
            return "cloud.fill"
        }
        if solar > 0 {
            return "cloud.fill"
        }
        return "cloud.fog.fill"
    }

    private func computeStatus(rainRate: Double, uv: Double, temp: Double) -> WeatherStatus {
        if rainRate > 0 {
            return .rainNow
        }
        if uv >= 6 && temp >= 26 {
            return .sunnyAndWarm
        }
        if temp <= 16 {
            return .cool
        }
        return .stable
    }
}

private struct RealtimeEnvelope: Decodable {
    let data: RealtimeData?
}

private struct RealtimeData: Decodable {
    let outdoor: RealtimeOutdoor?
    let wind: RealtimeWind?
    let solarAndUvi: RealtimeSolarAndUVI?
    let rainfall: RealtimeRainfall?

    enum CodingKeys: String, CodingKey {
        case outdoor
        case wind
        case solarAndUvi = "solar_and_uvi"
        case rainfall
    }
}

private struct RealtimeOutdoor: Decodable {
    let temperature: SensorValue?
    let feelsLike: SensorValue?
    let humidity: SensorValue?

    enum CodingKeys: String, CodingKey {
        case temperature
        case feelsLike = "feels_like"
        case humidity
    }
}

private struct RealtimeWind: Decodable {
    let windSpeed: SensorValue?
    let windGust: SensorValue?
    let windDirection: SensorValue?

    enum CodingKeys: String, CodingKey {
        case windSpeed = "wind_speed"
        case windGust = "wind_gust"
        case windDirection = "wind_direction"
    }
}

private struct RealtimeSolarAndUVI: Decodable {
    let solar: SensorValue?
    let uvi: SensorValue?
}

private struct RealtimeRainfall: Decodable {
    let rainRate: SensorValue?

    enum CodingKeys: String, CodingKey {
        case rainRate = "rain_rate"
    }
}

private struct SensorValue: Decodable {
    let value: Double?

    private enum CodingKeys: String, CodingKey {
        case value
    }

    init(from decoder: Decoder) throws {
        if let keyed = try? decoder.container(keyedBy: CodingKeys.self) {
            value = try keyed.decodeIfPresent(FlexibleDouble.self, forKey: .value)?.value
            return
        }

        if let singleValue = try? FlexibleDouble(from: decoder) {
            value = singleValue.value
            return
        }

        value = nil
    }
}

private struct FlexibleDouble: Decodable {
    let value: Double

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let number = try? container.decode(Double.self) {
            value = number
            return
        }
        if let number = try? container.decode(Int.self) {
            value = Double(number)
            return
        }
        if let text = try? container.decode(String.self), let number = Double(text) {
            value = number
            return
        }

        throw DecodingError.dataCorruptedError(
            in: container,
            debugDescription: "Expected number or numeric string"
        )
    }
}

private struct ForecastEnvelope: Decodable {
    let daily: ForecastDaily?
}

private struct ForecastDaily: Decodable {
    let time: [String]?
    let temperatureMax: [Double]?
    let temperatureMin: [Double]?
    let precipitationSum: [Double]?

    enum CodingKeys: String, CodingKey {
        case time
        case temperatureMax = "temperature_2m_max"
        case temperatureMin = "temperature_2m_min"
        case precipitationSum = "precipitation_sum"
    }
}

private struct HistoryAggregate {
    var high: Double?
    var low: Double?
    var rain: Double
}

private struct HistoryEnvelope: Decodable {
    let code: Int
    let message: String?
    let data: HistoryData?

    enum CodingKeys: String, CodingKey {
        case code
        case message = "msg"
        case data
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        code = (try? container.decode(FlexibleDouble.self, forKey: .code).value).map(Int.init) ?? -1
        message = try container.decodeIfPresent(String.self, forKey: .message)
        data = try container.decodeIfPresent(HistoryData.self, forKey: .data)
    }
}

private struct HistoryData: Decodable {
    let outdoor: HistoryOutdoor?
    let rainfall: HistoryRainfall?
}

private struct HistoryOutdoor: Decodable {
    let temperature: HistorySeries?
}

private struct HistoryRainfall: Decodable {
    let daily: HistorySeries?
}

private struct HistorySeries: Decodable {
    let list: [String: SensorValue]?
}

private final class DataCompletionBox: @unchecked Sendable {
    let completion: (Result<Data, Error>) -> Void

    init(_ completion: @escaping (Result<Data, Error>) -> Void) {
        self.completion = completion
    }
}
