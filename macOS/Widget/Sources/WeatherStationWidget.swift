import SwiftUI
import WeatherShared
import WidgetKit

struct WeatherEntry: TimelineEntry {
    let date: Date
    let snapshot: WeatherSnapshot?
    let errorMessage: String?
}

struct WeatherProvider: TimelineProvider {
    private let service = WeatherService()

    func placeholder(in context: Context) -> WeatherEntry {
        WeatherEntry(date: Date(), snapshot: .sample, errorMessage: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (WeatherEntry) -> Void) {
        service.loadSnapshot { result in
            completion(entry(from: result))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WeatherEntry>) -> Void) {
        service.loadSnapshot { result in
            let entry = entry(from: result)
            let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date().addingTimeInterval(900)
            completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
        }
    }

    private func entry(from result: Result<WeatherSnapshot, Error>) -> WeatherEntry {
        switch result {
        case .success(let snapshot):
            return WeatherEntry(date: Date(), snapshot: snapshot, errorMessage: nil)
        case .failure(let error):
            return WeatherEntry(date: Date(), snapshot: .sample, errorMessage: error.localizedDescription)
        }
    }
}

struct WeatherStationWidget: Widget {
    private let kind = "WeatherStationWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WeatherProvider()) { entry in
            WeatherWidgetView(entry: entry)
        }
        .configurationDisplayName("SWIS Weather")
        .description("Current weather from your station on the macOS desktop.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

private struct WeatherWidgetView: View {
    let entry: WeatherEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        if let snapshot = entry.snapshot {
            content(for: snapshot)
                .containerBackground(.fill.tertiary, for: .widget)
        } else {
            Text("Weather unavailable")
                .font(.caption)
                .containerBackground(.fill.tertiary, for: .widget)
        }
    }

    @ViewBuilder
    private func content(for snapshot: WeatherSnapshot) -> some View {
        switch family {
        case .systemSmall:
            SmallWidget(snapshot: snapshot)
        default:
            MediumWidget(snapshot: snapshot)
        }
    }
}

private struct SmallWidget: View {
    let snapshot: WeatherSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: snapshot.current.symbolName)
                    .foregroundStyle(.blue)
                Spacer()
                Text(snapshot.current.status.title)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Text("\(snapshot.current.temperatureC, specifier: "%.1f")°C")
                .font(.system(size: 30, weight: .bold, design: .rounded))
                .lineLimit(1)

            Text("Feels \(snapshot.current.feelsLikeC, specifier: "%.1f")°C")
                .font(.caption)
                .foregroundStyle(.secondary)

            Spacer(minLength: 2)

            if let today = snapshot.forecast.first {
                Text("H \(today.highC, specifier: "%.0f")°  L \(today.lowC, specifier: "%.0f")°  Rain \(today.precipitationMm, specifier: "%.1f") mm")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .padding(12)
    }
}

private struct MediumWidget: View {
    let snapshot: WeatherSnapshot

    var body: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    Image(systemName: snapshot.current.symbolName)
                        .foregroundStyle(.blue)
                    Text(snapshot.current.status.title)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Text("\(snapshot.current.temperatureC, specifier: "%.1f")°C")
                    .font(.system(size: 34, weight: .bold, design: .rounded))

                Text("Humidity \(snapshot.current.humidityPercent, specifier: "%.0f")%")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("Wind \(snapshot.current.windSpeedKmh, specifier: "%.1f") km/h")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Divider()

            VStack(alignment: .leading, spacing: 6) {
                Text("Forecast")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                ForEach(Array(snapshot.forecast.prefix(3).enumerated()), id: \.element.id) { index, day in
                    HStack {
                        Text(WeatherFormatting.shortDayLabel(from: day.dateISO, index: index))
                            .frame(width: 62, alignment: .leading)
                        Text("H \(day.highC, specifier: "%.0f")°")
                        Text("L \(day.lowC, specifier: "%.0f")°")
                        Text("\(day.precipitationMm, specifier: "%.1f") mm")
                            .foregroundStyle(.teal)
                    }
                    .font(.caption2)
                }
            }
        }
        .padding(12)
    }
}
