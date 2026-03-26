import Foundation

public enum WeatherFormatting {
    private static let utcCalendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
        return calendar
    }()

    public static func shortDayLabel(from dateISO: String, index: Int? = nil, locale: Locale = .current) -> String {
        if let index {
            if index == 0 {
                return "Today"
            }
            if index == 1 {
                return "Tomorrow"
            }
        }

        return weekdayLabel(from: dateISO, locale: locale)
    }

    public static func weekdayLabel(from dateISO: String, locale: Locale = .current) -> String {
        guard let date = parseISODate(dateISO) else {
            return dateISO
        }

        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.dateFormat = "EEE"
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
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

    private static func parseISODate(_ dateISO: String) -> Date? {
        let pieces = dateISO.split(separator: "-")
        guard
            pieces.count == 3,
            let year = Int(pieces[0]),
            let month = Int(pieces[1]),
            let day = Int(pieces[2])
        else {
            return nil
        }

        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = day
        return utcCalendar.date(from: components)
    }
}
