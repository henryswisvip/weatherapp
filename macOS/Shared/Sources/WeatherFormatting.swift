import Foundation

public enum WeatherFormatting {
    private static let isoDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter
    }()

    public static func shortDayLabel(from dateISO: String, locale: Locale = .current) -> String {
        guard let date = isoDateFormatter.date(from: dateISO) else {
            return dateISO
        }

        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            return "Today"
        }
        if calendar.isDateInTomorrow(date) {
            return "Tomorrow"
        }

        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.dateFormat = "EEE"
        return formatter.string(from: date)
    }

    public static func compassDirection(from degrees: Double) -> String {
        let directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
        guard degrees.isFinite else {
            return "--"
        }
        let index = Int((round(degrees / 45)).truncatingRemainder(dividingBy: 8))
        return directions[(index + 8) % 8]
    }
}
