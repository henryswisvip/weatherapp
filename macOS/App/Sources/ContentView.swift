import Charts
import Foundation
import SwiftUI
import WeatherShared

private enum ChartMode {
    case history
    case forecast

    var chartTitle: String {
        switch self {
        case .history:
            return "Last 7 Days History"
        case .forecast:
            return "7-Day Forecast"
        }
    }

    var toggleButtonTitle: String {
        switch self {
        case .history:
            return "Show 7-Day Forecast"
        case .forecast:
            return "Show Last 7 Days"
        }
    }

    var cardsTitle: String {
        switch self {
        case .history:
            return "Last 7 Days Rain"
        case .forecast:
            return "Rain Outlook"
        }
    }

    var chartFootnote: String {
        switch self {
        case .history:
            return "Top: historical temperature, Bottom: daily rain total"
        case .forecast:
            return "Top: forecast temperature, Bottom: forecast precipitation"
        }
    }
}

private struct TrendDay {
    let dateISO: String
    let highC: Double?
    let lowC: Double?
    let precipitationMm: Double
}

struct ContentView: View {
    @StateObject private var viewModel = DashboardViewModel()
    @State private var chartMode: ChartMode = .history

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.92, green: 0.97, blue: 1.0), Color.white],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    header

                    if let snapshot = viewModel.snapshot {
                        currentSection(snapshot.current)
                        trendChart(snapshot)
                        trendCards(snapshot)
                    } else if viewModel.isLoading {
                        loadingState
                    } else {
                        fallbackState
                    }
                }
                .padding(22)
            }
        }
        .frame(minWidth: 980, minHeight: 700)
        .task {
            await viewModel.refresh()
            viewModel.startAutoRefresh()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("SWIS Weather Station")
                        .font(.system(size: 30, weight: .bold))

                    Text(viewModel.snapshot.map { snapshot in
                        "Last updated \(snapshot.current.lastUpdated.formatted(date: .abbreviated, time: .shortened))"
                    } ?? "Loading latest weather data")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                    Text("Updates automatically every minute")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Spacer()
            }

            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage)
                    .font(.subheadline)
                    .foregroundStyle(.orange)
            }
        }
    }

    private func currentSection(_ current: WeatherCurrent) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 16) {
                Image(systemName: current.symbolName)
                    .font(.system(size: 44))
                    .foregroundStyle(.blue)
                    .frame(width: 60)

                VStack(alignment: .leading, spacing: 2) {
                    Text("\(current.temperatureC, specifier: "%.1f")°C")
                        .font(.system(size: 50, weight: .black, design: .rounded))

                    Text(current.status.title)
                        .font(.headline)
                        .foregroundStyle(.secondary)
                }
            }

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 12)], spacing: 12) {
                MetricCard(title: "Feels Like", value: "\(format(current.feelsLikeC, 1))°C", icon: "thermometer")
                MetricCard(title: "Humidity", value: "\(format(current.humidityPercent, 0))%", icon: "humidity")
                MetricCard(title: "Wind", value: "\(format(current.windSpeedKmh, 1)) km/h", icon: "wind")
                MetricCard(title: "Wind Gust", value: "\(format(current.windGustKmh, 1)) km/h", icon: "tornado")
                MetricCard(title: "Direction", value: WeatherFormatting.compassDirection(from: current.windDirectionDegrees), icon: "location.north.line")
                MetricCard(title: "UV", value: format(current.uvIndex, 1), icon: "sun.max")
                MetricCard(title: "Solar", value: "\(format(current.solarWm2, 0)) W/m²", icon: "sun.horizon")
                MetricCard(title: "Rain Rate", value: "\(format(current.rainRateMmPerHour, 1)) mm/h", icon: "cloud.rain")
            }
        }
        .padding(18)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func trendChart(_ snapshot: WeatherSnapshot) -> some View {
        let points = indexedTrendDays(for: snapshot)
        let temperaturePoints = temperatureSeriesPoints(from: points)
        let maxRain = max(points.map(\.day.precipitationMm).max() ?? 0, 0.2)
        let tempDomain = temperatureDomain(for: points)

        return VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center) {
                Text(chartMode.chartTitle)
                    .font(.title3.weight(.semibold))

                Spacer()

                Button {
                    withAnimation(.easeOut(duration: 0.65)) {
                        chartMode = chartMode == .forecast ? .history : .forecast
                    }
                } label: {
                    Label(chartMode.toggleButtonTitle, systemImage: "arrow.triangle.2.circlepath")
                        .font(.subheadline.weight(.semibold))
                }
                .buttonStyle(.bordered)
            }

            temperatureChart(points: points, temperaturePoints: temperaturePoints, tempDomain: tempDomain)

            VStack(alignment: .leading, spacing: 6) {
                Text(chartMode == .history ? "Daily Rainfall (mm)" : "Forecast Rainfall (mm)")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)

                rainfallChart(points: points, maxRain: maxRain)
            }

            HStack(spacing: 16) {
                Label("High", systemImage: "line.diagonal")
                    .foregroundStyle(.red)
                Label("Low", systemImage: "line.diagonal")
                    .foregroundStyle(.blue)
                Label("Rain", systemImage: "chart.bar.fill")
                    .foregroundStyle(.teal)
                Spacer()
                Text(chartMode.chartFootnote)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .animation(.easeOut(duration: 0.65), value: chartMode)
        .animation(.easeOut(duration: 0.65), value: chartAnimationSeed(points))
        .padding(18)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func temperatureChart(
        points: [IndexedTrendDay],
        temperaturePoints: [TemperaturePlotPoint],
        tempDomain: ClosedRange<Double>
    ) -> some View {
        let highPoints = temperaturePoints.filter { $0.series == .high }
        let lowPoints = temperaturePoints.filter { $0.series == .low }

        return Chart {
            ForEach(highPoints) { point in
                LineMark(
                    x: .value("Day", point.index),
                    y: .value("Temperature", point.value)
                )
                .foregroundStyle(.red)
                .lineStyle(StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
                .interpolationMethod(.monotone)

                PointMark(
                    x: .value("Day", point.index),
                    y: .value("Temperature", point.value)
                )
                .foregroundStyle(.red)
                .symbolSize(42)
            }

            ForEach(lowPoints) { point in
                LineMark(
                    x: .value("Day", point.index),
                    y: .value("Temperature", point.value)
                )
                .foregroundStyle(.blue)
                .lineStyle(StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
                .interpolationMethod(.monotone)

                PointMark(
                    x: .value("Day", point.index),
                    y: .value("Temperature", point.value)
                )
                .foregroundStyle(.blue)
                .symbolSize(42)
            }
        }
        .frame(height: 240)
        .chartYScale(domain: tempDomain)
        .chartYAxis {
            AxisMarks(position: .leading, values: .automatic(desiredCount: 5)) { value in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 1, dash: [3, 4]))
                    .foregroundStyle(.secondary.opacity(0.3))
                AxisTick()
                AxisValueLabel {
                    if let tempValue = value.as(Double.self) {
                        Text("\(Int(tempValue.rounded()))°")
                    }
                }
            }
        }
        .chartXAxis {
            AxisMarks(values: points.map(\.index)) { value in
                AxisGridLine().foregroundStyle(.secondary.opacity(0.2))
                AxisTick()
                AxisValueLabel {
                    if let index = value.as(Int.self), points.indices.contains(index) {
                        Text(points[index].label)
                    }
                }
            }
        }
        .chartPlotStyle { plot in
            plot
                .background(Color.white.opacity(0.25))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }

    private func rainfallChart(points: [IndexedTrendDay], maxRain: Double) -> some View {
        return Chart {
            ForEach(points) { point in
                BarMark(
                    x: .value("Day", point.label),
                    y: .value("Precipitation", point.day.precipitationMm)
                )
                .foregroundStyle(
                    LinearGradient(
                        colors: [
                            Color.teal.opacity(0.55),
                            Color.cyan.opacity(0.9)
                        ],
                        startPoint: .bottom,
                        endPoint: .top
                    )
                )
                .cornerRadius(7)
            }
        }
        .frame(height: 110)
        .chartYScale(domain: 0...(maxRain * 1.4))
        .chartYAxis {
            AxisMarks(position: .leading, values: .automatic(desiredCount: 3)) { value in
                AxisGridLine().foregroundStyle(.secondary.opacity(0.25))
                AxisTick()
                AxisValueLabel {
                    if let rainValue = value.as(Double.self) {
                        Text(rainValue == 0 ? "0" : format(rainValue, 1))
                    }
                }
            }
        }
        .chartXAxis {
            AxisMarks(values: points.map(\.label)) { _ in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 1, dash: [4, 4]))
                    .foregroundStyle(.secondary.opacity(0.2))
                AxisTick()
                AxisValueLabel()
            }
        }
        .chartPlotStyle { plot in
            plot
                .background(Color.white.opacity(0.2))
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
    }

    private func trendCards(_ snapshot: WeatherSnapshot) -> some View {
        let points = indexedTrendDays(for: snapshot)

        return VStack(alignment: .leading, spacing: 10) {
            Text(chartMode.cardsTitle)
                .font(.title3.weight(.semibold))

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 130), spacing: 10)], spacing: 10) {
                ForEach(points) { point in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(point.label)
                            .font(.headline)
                        Text("H \(temperatureText(point.day.highC))  L \(temperatureText(point.day.lowC))")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Label("\(format(point.day.precipitationMm, 1)) mm", systemImage: "drop.fill")
                            .font(.footnote)
                            .foregroundStyle(.teal)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(10)
                    .background(Color.white.opacity(0.75), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
            }
        }
        .animation(.easeOut(duration: 0.65), value: chartMode)
        .padding(18)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private var loadingState: some View {
        HStack(spacing: 10) {
            ProgressView()
            Text("Loading weather data...")
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, minHeight: 320)
    }

    private var fallbackState: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Weather unavailable")
                .font(.title2.weight(.semibold))
            Text("The app could not load data from Ecowitt/Open-Meteo.")
                .foregroundStyle(.secondary)
        }
        .padding(18)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func format(_ value: Double, _ digits: Int) -> String {
        String(format: "%.\(digits)f", value)
    }

    private func temperatureText(_ value: Double?) -> String {
        guard let value else {
            return "--"
        }
        return "\(format(value, 0))°"
    }

    private func chartAnimationSeed(_ points: [IndexedTrendDay]) -> String {
        points.map { point in
            let high = point.day.highC.map(String.init(describing:)) ?? "nil"
            let low = point.day.lowC.map(String.init(describing:)) ?? "nil"
            return "\(point.day.dateISO):\(high):\(low):\(point.day.precipitationMm)"
        }
        .joined(separator: "|")
    }

    private func temperatureSeriesPoints(from points: [IndexedTrendDay]) -> [TemperaturePlotPoint] {
        points.flatMap { point in
            var result: [TemperaturePlotPoint] = []
            if let high = point.day.highC {
                result.append(
                    TemperaturePlotPoint(
                        id: "high-\(point.day.dateISO)",
                        index: point.index,
                        value: high,
                        series: .high
                    )
                )
            }
            if let low = point.day.lowC {
                result.append(
                    TemperaturePlotPoint(
                        id: "low-\(point.day.dateISO)",
                        index: point.index,
                        value: low,
                        series: .low
                    )
                )
            }
            return result
        }
    }

    private func temperatureDomain(for points: [IndexedTrendDay]) -> ClosedRange<Double> {
        let highs = points.compactMap(\.day.highC)
        let lows = points.compactMap(\.day.lowC)

        guard
            let minLow = lows.min(),
            let maxHigh = highs.max()
        else {
            return 0...40
        }

        let padding = max(1.2, (maxHigh - minLow) * 0.25)
        let minValue = minLow - padding
        let maxValue = maxHigh + padding
        return minValue...maxValue
    }

    private func indexedTrendDays(for snapshot: WeatherSnapshot) -> [IndexedTrendDay] {
        let days: [TrendDay]
        switch chartMode {
        case .forecast:
            days = snapshot.forecast.map {
                TrendDay(dateISO: $0.dateISO, highC: $0.highC, lowC: $0.lowC, precipitationMm: $0.precipitationMm)
            }
        case .history:
            if snapshot.history.isEmpty {
                days = snapshot.forecast.map {
                    TrendDay(dateISO: $0.dateISO, highC: $0.highC, lowC: $0.lowC, precipitationMm: $0.precipitationMm)
                }
            } else {
                days = snapshot.history.map {
                    TrendDay(dateISO: $0.dateISO, highC: $0.highC, lowC: $0.lowC, precipitationMm: $0.precipitationMm)
                }
            }
        }

        return days.enumerated().map { index, day in
            IndexedTrendDay(index: index, day: day, label: trendLabel(for: day, at: index, totalCount: days.count))
        }
    }

    private func trendLabel(for day: TrendDay, at index: Int, totalCount: Int) -> String {
        switch chartMode {
        case .forecast:
            return WeatherFormatting.shortDayLabel(from: day.dateISO, index: index)
        case .history:
            if index == totalCount - 1 {
                return "Today"
            }
            return WeatherFormatting.weekdayLabel(from: day.dateISO)
        }
    }
}

private struct MetricCard: View {
    let title: String
    let value: String
    let icon: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(title, systemImage: icon)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title3.weight(.semibold))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color.white.opacity(0.78), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

private struct IndexedTrendDay: Identifiable {
    let index: Int
    let day: TrendDay
    let label: String

    var id: String {
        day.dateISO
    }
}

private enum TemperatureSeries: String {
    case high = "High"
    case low = "Low"
}

private struct TemperaturePlotPoint: Identifiable {
    let id: String
    let index: Int
    let value: Double
    let series: TemperatureSeries
}
