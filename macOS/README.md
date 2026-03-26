# SWIS Weather macOS App + Desktop Widget

This folder contains a native macOS conversion of the web app:

- `WeatherStationMac` target: SwiftUI desktop app
- `WeatherWidgetExtension` target: WidgetKit desktop widget
- `WeatherShared` target: shared weather models + API client

## 1) Generate Xcode project

```bash
cd "/Users/henryswisvip/Documents/Chatgpt codex/weatherapp/macOS"
xcodegen generate
```

This creates `WeatherStationMac.xcodeproj`.

## 2) Open and run

```bash
open WeatherStationMac.xcodeproj
```

In Xcode:

1. Select `WeatherStationMac` scheme.
2. Run on **My Mac**.
3. Add the widget from macOS widget gallery and pick **SWIS Weather**.

## 3) Build from terminal (optional)

```bash
xcodebuild \
  -project WeatherStationMac.xcodeproj \
  -scheme WeatherStationMac \
  -configuration Debug \
  -destination 'platform=macOS' \
  CODE_SIGNING_ALLOWED=NO \
  build
```

## Notes

- Current API configuration is in `Shared/Sources/WeatherService.swift` (ported from the existing web app values).
- macOS app loads data at startup and supports manual refresh from the app header.
- Widget uses an automatic timeline refresh policy (about every 30 minutes).
- For production use, move secrets to a secure backend and avoid embedding keys in client app binaries.
