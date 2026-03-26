import Charts
import Foundation
import SwiftUI
import WeatherShared

struct ContentView: View {
    @StateObject private var viewModel = DashboardViewModel()

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
                        forecastChart(snapshot.forecast)
                        forecastCards(snapshot.forecast)
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

    private func forecastChart(_ forecast: [ForecastDay]) -> some View {
        let points = indexedForecast(forecast)
        let maxRain = max(points.map(\.day.precipitationMm).max() ?? 0, 1)

        return VStack(alignment: .leading, spacing: 10) {
            Text("7-Day Forecast")
                .font(.title3.weight(.semibold))

            Chart {
                ForEach(points) { point in
                    LineMark(
                        x: .value("Day", point.label),
                        y: .value("High", point.day.highC)
                    )
                    .foregroundStyle(.red)
                    .lineStyle(StrokeStyle(lineWidth: 2.4))
                    .interpolationMethod(.catmullRom)

                    PointMark(
                        x: .value("Day", point.label),
                        y: .value("High", point.day.highC)
                    )
                    .foregroundStyle(.red)

                    LineMark(
                        x: .value("Day", point.label),
                        y: .value("Low", point.day.lowC)
                    )
                    .foregroundStyle(.blue)
                    .lineStyle(StrokeStyle(lineWidth: 2.4))
                    .interpolationMethod(.catmullRom)

                    PointMark(
                        x: .value("Day", point.label),
                        y: .value("Low", point.day.lowC)
                    )
                    .foregroundStyle(.blue)
                }
            }
            .frame(height: 180)
            .chartYAxis {
                AxisMarks(position: .leading)
            }
            .chartXAxis {
                AxisMarks(values: points.map(\.label)) { _ in
                    AxisValueLabel()
                }
            }

            Chart {
                ForEach(points) { point in
                    BarMark(
                        x: .value("Day", point.label),
                        y: .value("Precipitation", point.day.precipitationMm)
                    )
                    .foregroundStyle(.teal.gradient)
                    .cornerRadius(5)
                }
            }
            .frame(height: 90)
            .chartYScale(domain: 0...(maxRain + 1))
            .chartYAxis {
                AxisMarks(position: .leading)
            }
            .chartXAxis {
                AxisMarks(values: points.map(\.label)) { _ in
                    AxisGridLine()
                    AxisTick()
                    AxisValueLabel()
                }
            }

            HStack(spacing: 16) {
                Label("High", systemImage: "line.diagonal")
                    .foregroundStyle(.red)
                Label("Low", systemImage: "line.diagonal")
                    .foregroundStyle(.blue)
                Label("Rain", systemImage: "chart.bar.fill")
                    .foregroundStyle(.teal)
                Spacer()
                Text("Top: temperature, Bottom: precipitation")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(18)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func forecastCards(_ forecast: [ForecastDay]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Rain Outlook")
                .font(.title3.weight(.semibold))

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 130), spacing: 10)], spacing: 10) {
                ForEach(forecast) { day in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(WeatherFormatting.shortDayLabel(from: day.dateISO))
                            .font(.headline)
                        Text("H \(format(day.highC, 0))°  L \(format(day.lowC, 0))°")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Label("\(format(day.precipitationMm, 1)) mm", systemImage: "drop.fill")
                            .font(.footnote)
                            .foregroundStyle(.teal)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(10)
                    .background(Color.white.opacity(0.75), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
            }
        }
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

    private func indexedForecast(_ forecast: [ForecastDay]) -> [IndexedForecast] {
        forecast.enumerated().map { index, day in
            IndexedForecast(index: index, day: day, label: forecastLabel(for: day, at: index))
        }
    }

    private func forecastLabel(for day: ForecastDay, at index: Int) -> String {
        WeatherFormatting.shortDayLabel(from: day.dateISO, index: index)
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

private struct IndexedForecast: Identifiable {
    let index: Int
    let day: ForecastDay
    let label: String

    var id: String {
        day.id
    }
}
