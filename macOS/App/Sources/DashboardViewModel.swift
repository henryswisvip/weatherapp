import Foundation
import WeatherShared

@MainActor
final class DashboardViewModel: ObservableObject {
    @Published private(set) var snapshot: WeatherSnapshot?
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private let service: WeatherService
    private var refreshTask: Task<Void, Never>?
    private var lastForecastRefreshAt: Date?
    private let currentRefreshIntervalSeconds: TimeInterval = 60
    private let forecastRefreshIntervalSeconds: TimeInterval = 6 * 60 * 60

    init(service: WeatherService = WeatherService()) {
        self.service = service
    }

    deinit {
        refreshTask?.cancel()
    }

    func refresh() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let latest = try await service.loadSnapshot()
            snapshot = latest
            errorMessage = nil
            lastForecastRefreshAt = Date()
        } catch {
            errorMessage = error.localizedDescription
            if snapshot == nil {
                snapshot = .sample
            }
        }
    }

    func startAutoRefresh() {
        guard refreshTask == nil else { return }

        refreshTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(currentRefreshIntervalSeconds))
                if shouldRefreshForecast() {
                    await refresh()
                } else {
                    await refreshCurrentOnly()
                }
            }
        }
    }

    private func refreshCurrentOnly() async {
        do {
            let current = try await service.fetchCurrentWeather()
            if var snapshot {
                snapshot.current = current
                self.snapshot = snapshot
                errorMessage = nil
            } else {
                await refresh()
            }
        } catch {
            errorMessage = error.localizedDescription
            if snapshot == nil {
                snapshot = .sample
            }
        }
    }

    private func shouldRefreshForecast() -> Bool {
        guard let lastForecastRefreshAt else {
            return true
        }
        return Date().timeIntervalSince(lastForecastRefreshAt) >= forecastRefreshIntervalSeconds
    }
}
