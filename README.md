# SoundBar Monitor

macOS menu bar app that captures microphone audio and displays a live waveform in the tray icon, with a detachable visualizer window.

## Features

- **Menu bar icon** — live waveform in the tray (4 visual styles synced to the visualizer window)
- **Visualizer window** — real-time canvas rendering with 4 modes: Bars, Waveform, Spectrum, Circle
- **Mic input selector** — choose any connected microphone from the toolbar dropdown
- **Safe zone presets** — EBU R128, Podcast/Speech, Music Production (selectable from tray menu)
- **RMS/Peak metering** — tooltip shows current levels in dBFS
- **No hidden windows** — audio pipeline runs directly in the visible visualizer window

## Requirements

- macOS 12+
- Node.js **22+** (see `.nvmrc`)

## Setup

```bash
# Use correct Node version
nvm use

# Install dependencies
npm install
```

## Usage

```bash
# Development mode (with dev hints)
npm run dev

# Or just
npm start
```

### Controls

| Action | How |
|---|---|
| Open/close visualizer | Click tray icon, or press `Cmd+Shift+V` |
| Cycle visualizer style | Click `‹` / `›` in the toolbar |
| Select microphone | Choose from the dropdown in the visualizer toolbar |
| Switch safe zone preset | Right-click tray icon → Presets |
| Open DevTools | Click the ⚙ button in the visualizer toolbar |

### Visualizer Styles

| Style | Description |
|---|---|
| Bars | 64 scrolling bars in the voice-frequency range |
| Waveform | Center-symmetrical waveform line |
| Spectrum | Bottom-up full-range frequency spectrum |
| Circle | Pulsing filled ring that responds to RMS + FFT |

### Safe Zone Presets

| Preset | Range |
|---|---|
| Full Range | -60 to 0 dBFS |
| EBU R128 | -18 to -12 dBFS |
| Podcast / Speech | -12 to -6 dBFS |
| Music Production | -6 to -3 dBFS |

## Project Structure

```
soundbar-monitor/
├── main.js                     # Electron main process
├── preload.js                  # Context bridge API
├── renderer/
│   ├── visualizer.html         # Visualizer window
│   ├── visualizer.js           # Canvas rendering & UI
│   ├── visualizer.css          # Styles
│   └── shared/
│       └── audio-pipeline.js   # Audio capture & FFT engine
├── build/
│   └── entitlements.mac.plist  # macOS entitlements for mic access
└── assets/
    └── icon.svg                # App icon source
```

## Packaging

Build a standalone `.dmg` for distribution:

```bash
npm run dist
```

Output: `dist/SoundBar Monitor-1.0.0-arm64.dmg`

**Note:** The app is unsigned by default. On first launch, macOS may block it — right-click the app → **Open** to bypass Gatekeeper. To sign it, set `CSC_LINK` and `CSC_KEY_PASSWORD` environment variables with your Apple Developer certificate.

## Privacy

This app processes all audio **locally on your machine**. No audio data is ever sent over the network. The only permission required is microphone access, which is requested when the app starts.
