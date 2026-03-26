import Charts
import Foundation
import SwiftUI
import WeatherShared

private enum TrendMode {
    case history
    case forecast

    var title: String {
        switch self {
        case .history:
            return "Last 7 Days History"
        case .forecast:
            return "7-Day Forecast"
        }
    }

    var buttonTitle: String {
        switch self {
        case .history:
            return "Show 7-Day Forecast"
        case .forecast:
            return "Show Last 7 Days"
        }
    }
}

private struct TrendEntry: Identifiable {
    let id: String
    let index: Int
    let label: String
    let high: Double
    let low: Double
    let precipitation: Double
}

private struct MinuteRainSample: Identifiable {
    let id: Int
    let slot: Int
    let mmPerHour: Double
}

private struct HourlyForecastPoint: Identifiable {
    let id: Int
    let offset: Int
    let label: String
    let symbol: String
    let temperature: Double
    let rainChance: Int
}

private struct TrendSeedDay {
    let dateISO: String
    let highC: Double
    let lowC: Double
    let precipitationMm: Double
}

struct ContentView: View {
    @StateObject private var viewModel = DashboardViewModel()
    @State private var trendMode: TrendMode = .history
    @State private var trendAnimationProgress = 0.0

    var body: some View {
        ZStack {
            atmosphericBackground(for: viewModel.snapshot?.current)

            if let snapshot = viewModel.snapshot {
                dashboard(snapshot)
            } else if viewModel.isLoading {
                loadingState
            } else {
                fallbackState
            }
        }
        .frame(minWidth: 1120, minHeight: 780)
        .preferredColorScheme(.dark)
        .task {
            await viewModel.refresh()
            viewModel.startAutoRefresh()
        }
    }

    private func dashboard(_ snapshot: WeatherSnapshot) -> some View {
        GeometryReader { geometry in
            let compact = geometry.size.width < 1230

            ScrollView {
                VStack(spacing: 18) {
                    heroHeader(snapshot)

                    if compact {
                        VStack(spacing: 18) {
                            precipitationNowCard(snapshot)
                            hourlyForecastCard(snapshot)
                            forecastRowsCard(snapshot.forecast)
                            precipitationRadarCard(snapshot.current)
                            airQualityCard(snapshot.current)
                            windCard(snapshot.current)
                        }
                    } else {
                        HStack(alignment: .top, spacing: 18) {
                            VStack(spacing: 18) {
                                precipitationNowCard(snapshot)
                                hourlyForecastCard(snapshot)
                                forecastRowsCard(snapshot.forecast)
                            }
                            .frame(maxWidth: .infinity)

                            VStack(spacing: 18) {
                                precipitationRadarCard(snapshot.current)
                                airQualityCard(snapshot.current)
                                windCard(snapshot.current)
                            }
                            .frame(maxWidth: .infinity)
                        }
                    }

                    temperatureTrendCard(snapshot)
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 18)
            }
        }
    }

    private func heroHeader(_ snapshot: WeatherSnapshot) -> some View {
        let today = snapshot.forecast.first

        return VStack(alignment: .center, spacing: 4) {
            Label("HOME", systemImage: "location.fill")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.white.opacity(0.72))

            Text("Shenzhen")
                .font(.system(size: 46, weight: .light, design: .rounded))
                .foregroundStyle(.white)

            HStack(alignment: .center, spacing: 14) {
                Text("\(Int(snapshot.current.temperatureC.rounded()))°")
                    .font(.system(size: 104, weight: .thin, design: .rounded))
                    .foregroundStyle(.white)

                Image(systemName: snapshot.current.symbolName)
                    .font(.system(size: 44, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.9))
            }

            Text("Feels Like \(Int(snapshot.current.feelsLikeC.rounded()))°")
                .font(.title3.weight(.medium))
                .foregroundStyle(.white.opacity(0.95))

            if let today {
                Text("H:\(Int(today.highC.rounded()))°  L:\(Int(today.lowC.rounded()))°")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.95))
            }

            Text(snapshot.current.status.title)
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.75))

            Text(lastUpdatedLabel(snapshot.current.lastUpdated))
                .font(.caption)
                .foregroundStyle(.white.opacity(0.62))

            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.orange.opacity(0.9))
                    .padding(.top, 4)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func precipitationNowCard(_ snapshot: WeatherSnapshot) -> some View {
        let samples = nextHourRainSamples(from: snapshot)
        let peak = max(samples.map(\.mmPerHour).max() ?? 0.2, 0.2)

        return WeatherGlassCard(
            title: rainHeadline(for: snapshot.current.rainRateMmPerHour),
            subtitle: "Chance of light rain in the next hour.",
            symbol: "cloud.rain.fill"
        ) {
            Chart(samples) { sample in
                BarMark(
                    x: .value("Slot", sample.slot),
                    y: .value("Rain", sample.mmPerHour)
                )
                .cornerRadius(2.5)
                .foregroundStyle(
                    LinearGradient(
                        colors: [Color(red: 0.42, green: 0.86, blue: 0.98), Color(red: 0.25, green: 0.64, blue: 0.86)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
            }
            .frame(height: 86)
            .chartYScale(domain: 0...(peak * 1.25))
            .chartYAxis(.hidden)
            .chartXAxis {
                AxisMarks(values: [0, 2, 4, 6, 8, 10]) { value in
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 1, dash: [3, 5]))
                        .foregroundStyle(.white.opacity(0.10))
                    AxisTick().foregroundStyle(.white.opacity(0.28))
                    AxisValueLabel {
                        if let slot = value.as(Int.self) {
                            if slot == 0 {
                                Text("Now")
                            } else {
                                Text("\(slot * 5)m")
                            }
                        }
                    }
                    .foregroundStyle(.white.opacity(0.72))
                    .font(.caption2)
                }
            }

            Text("Auto-updates every minute")
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.62))
        }
    }

    private func hourlyForecastCard(_ snapshot: WeatherSnapshot) -> some View {
        let points = hourlyForecastPoints(from: snapshot)

        return WeatherGlassCard(title: "Hourly Forecast", subtitle: "Next 8 hours", symbol: "clock") {
            HStack(alignment: .top, spacing: 14) {
                ForEach(points) { point in
                    VStack(spacing: 6) {
                        Text(point.label)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.72))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)

                        Image(systemName: point.symbol)
                            .font(.title3)
                            .foregroundStyle(.white.opacity(0.92))

                        Text("\(Int(point.temperature.rounded()))°")
                            .font(.headline)
                            .foregroundStyle(.white)

                        Text("\(point.rainChance)%")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.cyan.opacity(0.85))
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
    }

    private func forecastRowsCard(_ forecast: [ForecastDay]) -> some View {
        let days = Array(forecast.prefix(7))
        let minTemp = days.map(\.lowC).min() ?? 0
        let maxTemp = days.map(\.highC).max() ?? 30
        let span = max(1.0, maxTemp - minTemp)

        return WeatherGlassCard(title: "7-Day Forecast", subtitle: "Daily range and rain", symbol: "calendar") {
            VStack(spacing: 11) {
                ForEach(Array(days.enumerated()), id: \.element.id) { index, day in
                    let lowProgress = (day.lowC - minTemp) / span
                    let highProgress = (day.highC - minTemp) / span

                    HStack(spacing: 10) {
                        Text(WeatherFormatting.shortDayLabel(from: day.dateISO, index: index))
                            .font(.headline)
                            .frame(width: 95, alignment: .leading)

                        Image(systemName: iconForDay(high: day.highC, low: day.lowC, precipitation: day.precipitationMm))
                            .foregroundStyle(.white.opacity(0.86))
                            .frame(width: 22)

                        Text("\(Int(day.lowC.rounded()))°")
                            .foregroundStyle(.white.opacity(0.64))
                            .frame(width: 34, alignment: .trailing)

                        GeometryReader { proxy in
                            ZStack(alignment: .leading) {
                                Capsule()
                                    .fill(.white.opacity(0.12))
                                    .frame(height: 6)

                                Capsule()
                                    .fill(
                                        LinearGradient(
                                            colors: [
                                                Color(red: 0.47, green: 0.79, blue: 0.97),
                                                Color(red: 0.91, green: 0.90, blue: 0.54),
                                                Color(red: 0.95, green: 0.62, blue: 0.32)
                                            ],
                                            startPoint: .leading,
                                            endPoint: .trailing
                                        )
                                    )
                                    .frame(width: max(6, (highProgress - lowProgress) * proxy.size.width), height: 6)
                                    .offset(x: lowProgress * proxy.size.width)
                            }
                        }
                        .frame(height: 6)

                        Text("\(Int(day.highC.rounded()))°")
                            .foregroundStyle(.white)
                            .frame(width: 34, alignment: .leading)

                        Text("\(rainChancePercent(from: day.precipitationMm))%")
                            .foregroundStyle(.cyan.opacity(0.88))
                            .font(.subheadline.weight(.semibold))
                            .frame(width: 42, alignment: .trailing)
                    }
                    .frame(height: 22)
                }
            }
        }
    }

    private func precipitationRadarCard(_ current: WeatherCurrent) -> some View {
        let intensity = min(max(current.rainRateMmPerHour / 10.0, 0.08), 1.0)

        return WeatherGlassCard(title: "Precipitation", subtitle: "Station radar style", symbol: "location.north.line") {
            ZStack {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Color.white.opacity(0.05))

                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(Color.white.opacity(0.1), lineWidth: 1)

                VStack(spacing: 0) {
                    ForEach(0..<5, id: \.self) { _ in
                        Rectangle()
                            .fill(Color.white.opacity(0.04))
                            .frame(height: 1)
                        Spacer(minLength: 0)
                    }
                }
                .padding(12)

                HStack(spacing: 0) {
                    ForEach(0..<6, id: \.self) { _ in
                        Rectangle()
                            .fill(Color.white.opacity(0.04))
                            .frame(width: 1)
                        Spacer(minLength: 0)
                    }
                }
                .padding(12)

                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [
                                Color(red: 0.89, green: 0.42, blue: 0.74).opacity(0.68 * intensity),
                                Color(red: 0.49, green: 0.62, blue: 1.0).opacity(0.78 * intensity),
                                Color(red: 0.39, green: 0.84, blue: 0.95).opacity(0.68 * intensity),
                                Color.clear
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: 360, height: 90)
                    .rotationEffect(.degrees(-28))

                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [
                                Color(red: 0.40, green: 0.86, blue: 0.98).opacity(0.6 * intensity),
                                Color.white.opacity(0.22 * intensity),
                                Color.clear
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: 260, height: 44)
                    .rotationEffect(.degrees(-28))
                    .offset(x: -36, y: 10)

                VStack(spacing: 2) {
                    Text("My Location")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.82))
                    Text("\(Int(current.temperatureC.rounded()))")
                        .font(.title2.weight(.bold))
                        .foregroundStyle(.white)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color.black.opacity(0.52), in: Capsule())
            }
            .frame(height: 220)
        }
    }

    private func airQualityCard(_ current: WeatherCurrent) -> some View {
        let score = airQualityScore(for: current)

        let grade: String
        switch score {
        case ..<35:
            grade = "Poor"
        case ..<55:
            grade = "Moderate"
        case ..<75:
            grade = "Good"
        default:
            grade = "Great"
        }

        return WeatherGlassCard(title: "Air Quality", subtitle: "Station-derived index", symbol: "aqi.medium") {
            VStack(alignment: .leading, spacing: 10) {
                Text("\(Int(score))")
                    .font(.system(size: 42, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)

                Text(grade)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.9))

                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(.white.opacity(0.14))
                        Capsule()
                            .fill(
                                LinearGradient(
                                    colors: [.green, .yellow, .orange, .red],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: max(6, (score / 100) * proxy.size.width))
                    }
                }
                .frame(height: 8)

                Text("Air quality index is \(Int(score)), derived from humidity, UV, rainfall, and wind.")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.76))
            }
        }
    }

    private func windCard(_ current: WeatherCurrent) -> some View {
        WeatherGlassCard(title: "Wind", subtitle: "Live from station", symbol: "location.north.fill") {
            HStack(alignment: .center, spacing: 14) {
                VStack(alignment: .leading, spacing: 8) {
                    metricLine("Wind", "\(Int(current.windSpeedKmh.rounded())) km/h")
                    metricLine("Gusts", "\(Int(current.windGustKmh.rounded())) km/h")
                    metricLine(
                        "Direction",
                        "\(Int(current.windDirectionDegrees.rounded()))° \(WeatherFormatting.compassDirection(from: current.windDirectionDegrees))"
                    )
                }

                Spacer(minLength: 14)

                WindDial(directionDegrees: current.windDirectionDegrees, speedKmh: current.windSpeedKmh)
                    .frame(width: 160, height: 160)
            }
        }
    }

    private func temperatureTrendCard(_ snapshot: WeatherSnapshot) -> some View {
        let entries = trendEntries(from: snapshot)

        return WeatherGlassCard(
            title: trendMode.title,
            subtitle: "Two-line temperature chart with daily rain",
            symbol: "chart.xyaxis.line"
        ) {
            if entries.isEmpty {
                Text("Not enough weather data for the chart yet.")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.72))
                    .frame(maxWidth: .infinity, minHeight: 220, alignment: .center)
            } else {
                let minTemp = entries.map(\.low).min() ?? 0
                let maxTemp = entries.map(\.high).max() ?? 0
                let pad = max(2.0, (maxTemp - minTemp) * 0.28)
                let yDomain = (minTemp - pad)...(maxTemp + pad)

                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Spacer()

                        Button {
                            withAnimation(.easeInOut(duration: 0.3)) {
                                trendMode = trendMode == .history ? .forecast : .history
                            }
                            animateTrendChart()
                        } label: {
                            Label(trendMode.buttonTitle, systemImage: "arrow.triangle.2.circlepath")
                                .font(.headline)
                                .foregroundStyle(.white.opacity(0.9))
                                .padding(.horizontal, 16)
                                .padding(.vertical, 8)
                                .background(
                                    Capsule(style: .continuous)
                                        .fill(Color.white.opacity(0.12))
                                )
                        }
                        .buttonStyle(.plain)
                    }

                    temperatureChart(entries: entries, yDomain: yDomain)
                    rainfallChart(entries: entries)

                    HStack(spacing: 16) {
                        legendMark(color: .red, title: "High")
                        legendMark(color: .cyan, title: "Low")
                        legendMark(color: Color(red: 0.29, green: 0.84, blue: 0.95), title: "Rain")
                        Spacer()
                    }
                    .font(.caption.weight(.semibold))

                    Text("Top: temperature trend, Bottom: daily rainfall")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.6))
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }
            }
        }
        .onAppear {
            animateTrendChart()
        }
        .onChange(of: trendMode) { _, _ in
            animateTrendChart()
        }
    }

    private func temperatureChart(entries: [TrendEntry], yDomain: ClosedRange<Double>) -> some View {
        Chart {
            ForEach(entries) { entry in
                let mid = (entry.high + entry.low) / 2

                AreaMark(
                    x: .value("Day", entry.index),
                    yStart: .value("Low", animatedTemperature(entry.low, baseline: mid)),
                    yEnd: .value("High", animatedTemperature(entry.high, baseline: mid))
                )
                .interpolationMethod(.catmullRom)
                .foregroundStyle(
                    LinearGradient(
                        colors: [Color.red.opacity(0.22), Color.cyan.opacity(0.08)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
            }

            ForEach(entries) { entry in
                let mid = (entry.high + entry.low) / 2

                LineMark(
                    x: .value("Day", entry.index),
                    y: .value("High", animatedTemperature(entry.high, baseline: mid))
                )
                .interpolationMethod(.catmullRom)
                .lineStyle(StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round))
                .foregroundStyle(Color.red)

                PointMark(
                    x: .value("Day", entry.index),
                    y: .value("High", animatedTemperature(entry.high, baseline: mid))
                )
                .symbolSize(52)
                .foregroundStyle(Color.red)

                LineMark(
                    x: .value("Day", entry.index),
                    y: .value("Low", animatedTemperature(entry.low, baseline: mid))
                )
                .interpolationMethod(.catmullRom)
                .lineStyle(StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round))
                .foregroundStyle(Color.cyan)

                PointMark(
                    x: .value("Day", entry.index),
                    y: .value("Low", animatedTemperature(entry.low, baseline: mid))
                )
                .symbolSize(52)
                .foregroundStyle(Color.cyan)
            }
        }
        .frame(height: 300)
        .chartYScale(domain: yDomain)
        .chartXAxis {
            AxisMarks(values: entries.map(\.index)) { value in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 1, dash: [4, 6]))
                    .foregroundStyle(.white.opacity(0.08))
                AxisTick().foregroundStyle(.white.opacity(0.23))
                AxisValueLabel {
                    if let index = value.as(Int.self), entries.indices.contains(index) {
                        Text(entries[index].label)
                    }
                }
                .font(.headline)
                .foregroundStyle(.white.opacity(0.73))
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading, values: .automatic(desiredCount: 5)) { value in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 1, dash: [3, 5]))
                    .foregroundStyle(.white.opacity(0.14))
                AxisTick().foregroundStyle(.white.opacity(0.25))
                AxisValueLabel {
                    if let temp = value.as(Double.self) {
                        Text("\(Int(temp.rounded()))°")
                    }
                }
                .foregroundStyle(.white.opacity(0.74))
            }
        }
        .chartPlotStyle { plot in
            plot
                .padding(.top, 4)
                .padding(.trailing, 10)
                .background(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(Color.white.opacity(0.05))
                )
        }
        .animation(.easeInOut(duration: 0.85), value: trendAnimationProgress)
    }

    private func rainfallChart(entries: [TrendEntry]) -> some View {
        let maxRain = max(entries.map(\.precipitation).max() ?? 1.0, 1.0)

        return Chart(entries) { entry in
            BarMark(
                x: .value("Day", entry.index),
                y: .value("Rain", entry.precipitation)
            )
            .cornerRadius(5)
            .foregroundStyle(
                LinearGradient(
                    colors: [Color(red: 0.20, green: 0.92, blue: 0.96), Color(red: 0.17, green: 0.56, blue: 0.89)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
        }
        .frame(height: 120)
        .chartYScale(domain: 0...(maxRain * 1.45))
        .chartXAxis {
            AxisMarks(values: entries.map(\.index)) { value in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 1, dash: [4, 6]))
                    .foregroundStyle(.white.opacity(0.08))
                AxisTick().foregroundStyle(.white.opacity(0.25))
                AxisValueLabel {
                    if let index = value.as(Int.self), entries.indices.contains(index) {
                        Text(entries[index].label)
                    }
                }
                .foregroundStyle(.white.opacity(0.72))
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading, values: [0, maxRain]) { value in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 1, dash: [3, 5]))
                    .foregroundStyle(.white.opacity(0.09))
                AxisTick().foregroundStyle(.white.opacity(0.22))
                AxisValueLabel {
                    if let rain = value.as(Double.self) {
                        Text("\(format(rain, 1))")
                    }
                }
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.65))
            }
        }
        .chartPlotStyle { plot in
            plot
                .padding(.trailing, 10)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(Color.white.opacity(0.04))
                )
        }
        .animation(.easeInOut(duration: 0.8), value: trendMode)
    }

    private var loadingState: some View {
        VStack(spacing: 10) {
            ProgressView()
            Text("Loading weather data...")
                .foregroundStyle(.white.opacity(0.85))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var fallbackState: some View {
        VStack(spacing: 8) {
            Text("Weather unavailable")
                .font(.title2.weight(.semibold))
                .foregroundStyle(.white)
            Text("The app could not load data from Ecowitt/Open-Meteo.")
                .foregroundStyle(.white.opacity(0.76))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func atmosphericBackground(for current: WeatherCurrent?) -> some View {
        let gradient = backgroundGradient(for: current)

        return ZStack {
            LinearGradient(colors: gradient, startPoint: .topLeading, endPoint: .bottomTrailing)
                .ignoresSafeArea()

            Circle()
                .fill(Color.white.opacity(0.08))
                .frame(width: 460, height: 460)
                .blur(radius: 52)
                .offset(x: -290, y: -290)

            Circle()
                .fill(Color(red: 0.38, green: 0.60, blue: 0.98).opacity(0.22))
                .frame(width: 560, height: 560)
                .blur(radius: 92)
                .offset(x: 320, y: -250)

            Circle()
                .fill(Color(red: 0.18, green: 0.42, blue: 0.86).opacity(0.17))
                .frame(width: 620, height: 620)
                .blur(radius: 120)
                .offset(x: -140, y: 390)
        }
    }

    private func backgroundGradient(for current: WeatherCurrent?) -> [Color] {
        guard let current else {
            return [Color(red: 0.07, green: 0.10, blue: 0.19), Color(red: 0.10, green: 0.16, blue: 0.30)]
        }

        if current.rainRateMmPerHour > 0.1 {
            return [Color(red: 0.06, green: 0.09, blue: 0.18), Color(red: 0.10, green: 0.17, blue: 0.31)]
        }

        if current.uvIndex > 6 {
            return [Color(red: 0.08, green: 0.16, blue: 0.32), Color(red: 0.16, green: 0.31, blue: 0.48)]
        }

        return [Color(red: 0.07, green: 0.10, blue: 0.19), Color(red: 0.10, green: 0.16, blue: 0.30)]
    }

    private func trendEntries(from snapshot: WeatherSnapshot) -> [TrendEntry] {
        let forecastSeed = snapshot.forecast.map {
            TrendSeedDay(dateISO: $0.dateISO, highC: $0.highC, lowC: $0.lowC, precipitationMm: $0.precipitationMm)
        }

        let historySeed = snapshot.history.compactMap { day -> TrendSeedDay? in
            guard let high = day.highC, let low = day.lowC else {
                return nil
            }
            return TrendSeedDay(dateISO: day.dateISO, highC: high, lowC: low, precipitationMm: day.precipitationMm)
        }

        let source: [TrendSeedDay]
        switch trendMode {
        case .forecast:
            source = forecastSeed
        case .history:
            source = historySeed.isEmpty ? forecastSeed : historySeed
        }

        return Array(source.suffix(7)).enumerated().map { index, day in
            let label: String
            if trendMode == .history {
                label = index == source.suffix(7).count - 1 ? "Today" : WeatherFormatting.weekdayLabel(from: day.dateISO)
            } else {
                label = WeatherFormatting.shortDayLabel(from: day.dateISO, index: index)
            }

            return TrendEntry(
                id: day.dateISO,
                index: index,
                label: label,
                high: day.highC,
                low: day.lowC,
                precipitation: day.precipitationMm
            )
        }
    }

    private func nextHourRainSamples(from snapshot: WeatherSnapshot) -> [MinuteRainSample] {
        let currentRate = max(snapshot.current.rainRateMmPerHour, 0)
        let forecastRate = (snapshot.forecast.first?.precipitationMm ?? 0) / 7.5
        let base = max(currentRate, forecastRate)

        return (0..<12).map { slot in
            let wave = 0.74 + (sin(Double(slot) * 0.72) * 0.20) + (cos(Double(slot) * 0.31) * 0.08)
            let decay = max(0.16, 1 - (Double(slot) * 0.055))
            let value = max(0, base * wave * decay)
            return MinuteRainSample(id: slot, slot: slot, mmPerHour: value)
        }
    }

    private func hourlyForecastPoints(from snapshot: WeatherSnapshot) -> [HourlyForecastPoint] {
        let now = Date()
        let calendar = Calendar.current
        let baseTemp = snapshot.current.temperatureC
        let targetTemp = snapshot.forecast.first?.highC ?? baseTemp
        let rainBase = rainChancePercent(from: snapshot.forecast.first?.precipitationMm ?? 0)

        let formatter = DateFormatter()
        formatter.dateFormat = "ha"

        var points: [HourlyForecastPoint] = []
        points.reserveCapacity(8)

        for offset in 0..<8 {
            guard let date = calendar.date(byAdding: .hour, value: offset, to: now) else {
                continue
            }

            let label = offset == 0 ? "Now" : formatter.string(from: date)
            let smoothWave = sin((Double(offset) - 0.8) * 0.7) * 1.3
            let drift = (Double(offset) / 7.0) * (targetTemp - baseTemp) * 0.48
            let temperature = baseTemp + smoothWave + drift

            let chanceRaw = (Double(rainBase) * 0.55) + Double(offset * 3)
            let chanceValue = min(95, max(0, Int(chanceRaw.rounded())))
            let symbol = hourlySymbol(for: date, rainChance: chanceValue)

            points.append(
                HourlyForecastPoint(
                    id: offset,
                    offset: offset,
                    label: label,
                    symbol: symbol,
                    temperature: temperature,
                    rainChance: chanceValue
                )
            )
        }

        return points
    }

    private func hourlySymbol(for date: Date, rainChance: Int) -> String {
        let hour = Calendar.current.component(.hour, from: date)
        let night = hour < 6 || hour >= 19

        if rainChance > 65 {
            return night ? "cloud.moon.rain.fill" : "cloud.sun.rain.fill"
        }
        if rainChance > 35 {
            return "cloud.drizzle.fill"
        }
        if night {
            return "moon.stars.fill"
        }
        return "sun.max.fill"
    }

    private func rainHeadline(for rainRate: Double) -> String {
        switch rainRate {
        case 0..<0.1:
            return "No Immediate Rain"
        case 0.1..<1:
            return "Possible Light Rain"
        case 1..<4:
            return "Rain Likely Soon"
        default:
            return "Heavy Rain Signal"
        }
    }

    private func iconForDay(high: Double, low: Double, precipitation: Double) -> String {
        if precipitation >= 4 {
            return "cloud.heavyrain.fill"
        }
        if precipitation >= 1 {
            return "cloud.rain.fill"
        }
        if high >= 33 {
            return "sun.max.fill"
        }
        if low <= 9 {
            return "cloud.snow.fill"
        }
        return "cloud.fill"
    }

    private func rainChancePercent(from precipitationMm: Double) -> Int {
        Int(min(100, max(0, precipitationMm * 26)).rounded())
    }

    private func airQualityScore(for current: WeatherCurrent) -> Double {
        let humidityPenalty = max(0, current.humidityPercent - 68) * 0.5
        let uvPenalty = max(0, current.uvIndex - 6) * 4.5
        let rainPenalty = current.rainRateMmPerHour * 2.8
        let windBonus = min(16, current.windSpeedKmh * 0.45)
        let base = 72.0 - humidityPenalty - uvPenalty - rainPenalty + windBonus
        return min(100, max(0, base))
    }

    private func metricLine(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title)
                .foregroundStyle(.white.opacity(0.68))
            Spacer()
            Text(value)
                .foregroundStyle(.white)
        }
        .font(.subheadline)
    }

    private func legendMark(color: Color, title: String) -> some View {
        HStack(spacing: 6) {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)
            Text(title)
                .foregroundStyle(.white.opacity(0.86))
        }
    }

    private func lastUpdatedLabel(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return "Updated \(formatter.localizedString(for: date, relativeTo: Date()))"
    }

    private func animatedTemperature(_ target: Double, baseline: Double) -> Double {
        baseline + (target - baseline) * trendAnimationProgress
    }

    private func animateTrendChart() {
        trendAnimationProgress = 0
        withAnimation(.easeInOut(duration: 0.82)) {
            trendAnimationProgress = 1
        }
    }

    private func format(_ value: Double, _ digits: Int) -> String {
        String(format: "% .\(digits)f", value).replacingOccurrences(of: " ", with: "")
    }
}

private struct WeatherGlassCard<Content: View>: View {
    let title: String
    let subtitle: String
    let symbol: String
    let content: Content

    init(title: String, subtitle: String, symbol: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.subtitle = subtitle
        self.symbol = symbol
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 5) {
                Label(title.uppercased(), systemImage: symbol)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.64))
                Text(subtitle)
                    .font(.headline)
                    .foregroundStyle(.white.opacity(0.94))
            }

            content
        }
        .padding(18)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(Color.black.opacity(0.26))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(Color.white.opacity(0.11), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.24), radius: 16, y: 8)
    }
}

private struct WindDial: View {
    let directionDegrees: Double
    let speedKmh: Double

    var body: some View {
        ZStack {
            Circle()
                .fill(.white.opacity(0.03))

            Circle()
                .stroke(.white.opacity(0.14), lineWidth: 1)

            Circle()
                .stroke(.white.opacity(0.06), lineWidth: 10)
                .padding(14)

            ForEach(["N", "E", "S", "W"], id: \.self) { label in
                Text(label)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.72))
                    .offset(offset(for: label))
            }

            VStack(spacing: 0) {
                Capsule()
                    .fill(.white)
                    .frame(width: 4, height: 46)
                Circle()
                    .fill(.white)
                    .frame(width: 12, height: 12)
            }
            .rotationEffect(.degrees(directionDegrees))

            VStack(spacing: 2) {
                Text("\(Int(speedKmh.rounded()))")
                    .font(.title2.weight(.bold))
                    .foregroundStyle(.white)
                Text("km/h")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.7))
            }
        }
    }

    private func offset(for label: String) -> CGSize {
        switch label {
        case "N":
            return CGSize(width: 0, height: -68)
        case "E":
            return CGSize(width: 68, height: 0)
        case "S":
            return CGSize(width: 0, height: 68)
        default:
            return CGSize(width: -68, height: 0)
        }
    }
}
