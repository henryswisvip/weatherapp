import Foundation
import WeatherShared

@MainActor
final class DashboardViewModel: ObservableObject {
    @Published private(set) var snapshot: WeatherSnapshot?
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private let service: WeatherService
    private var refreshTask: Task<Void, Never>?

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
                try? await Task.sleep(for: .seconds(600))
                await refresh()
            }
        }
    }
}
