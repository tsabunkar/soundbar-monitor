const {
  app, Tray, Menu, BrowserWindow, ipcMain, nativeImage, session
} = require('electron')
const path = require('path')

let tray
let visualizerWindow

const PRESETS = {
  'full-range': { min: -60, max: 0, label: 'Full Range' },
  'ebu-r128': { min: -18, max: -12, label: 'EBU R128' },
  'podcast': { min: -12, max: -6, label: 'Podcast / Speech' },
  'music-production': { min: -6, max: -3, label: 'Music Production' }
}

let settings = {
  peakHoldDuration: 2000,
  clipThreshold: -3,
  safeZonePreset: 'podcast',
  safeZoneMin: -12,
  safeZoneMax: -6,
  safeZoneEnabled: true,
  selectedMicDevice: null,
  availableDevices: []
}

function updateSafeZoneFromPreset(presetName) {
  const preset = PRESETS[presetName]
  if (preset) {
    settings.safeZonePreset = presetName
    settings.safeZoneMin = preset.min
    settings.safeZoneMax = preset.max
  }
}

const WAVE_BUF_LEN = 7
let waveHistory = new Array(WAVE_BUF_LEN).fill(0)

function createTrayIcon(level, fft) {
  const size = 28
  const buf = Buffer.alloc(size * size * 4, 0)

  let r, g, b
  if (level < -30) { r = 0xdd; g = 0xdd; b = 0xdd }
  else if (level < -12) { r = 0x33; g = 0xdd; b = 0x33 }
  else if (level < -6) { r = 0xff; g = 0xcc; b = 0x00 }
  else { r = 0xff; g = 0x33; b = 0x33 }

  const fillRect = (x, y, w, h) => {
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        const px = x + dx
        const py = y + dy
        if (px < 0 || px >= size || py < 0 || py >= size) continue
        const i = (py * size + px) * 4
        buf[i]     = b
        buf[i + 1] = g
        buf[i + 2] = r
        buf[i + 3] = 255
      }
    }
  }

  if (fft && fft.length > 0) {
    const voiceBins = fft.slice(0, 16)
    const avg = voiceBins.reduce((s, v) => s + v, 0) / voiceBins.length
    const norm = Math.min(1, Math.sqrt(avg / 255))

    waveHistory.shift()
    waveHistory.push(norm)

    for (let i = 0; i < WAVE_BUF_LEN; i++) {
      const val = waveHistory[i]
      const h = Math.max(1, Math.round(val * (size - 2)))
      const x = 2 + i * 4
      fillRect(x, size - 1 - h, 3, h)
    }
  } else {
    fillRect(3, 16, 6, 10)
    fillRect(12, 10, 6, 16)
    fillRect(21, 4, 6, 22)
  }

  const img = nativeImage.createFromBuffer(buf, { width: size, height: size })
  return img
}

function createTray() {
  tray = new Tray(createTrayIcon(-60))
  tray.setToolTip('SoundBar Monitor')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Visualizer',
      click: () => toggleVisualizerWindow(),
      accelerator: 'CmdOrCtrl+Shift+V'
    },
    { type: 'separator' },
    {
      label: 'Presets',
      submenu: Object.entries(PRESETS).map(([key, preset]) => ({
        label: preset.label,
        type: 'radio',
        checked: key === settings.safeZonePreset,
        click: () => {
          updateSafeZoneFromPreset(key)
          broadcastSettings()
        }
      }))
    },
    { type: 'separator' },
    {
      label: 'Quit',
      accelerator: 'CmdOrCtrl+Q',
      click: () => app.quit()
    }
  ])
  tray.setContextMenu(contextMenu)

  tray.on('click', () => toggleVisualizerWindow())
  tray.on('right-click', () => tray.popUpContextMenu())
}

function toggleVisualizerWindow() {
  if (visualizerWindow && !visualizerWindow.isDestroyed()) {
    visualizerWindow.isVisible() ? visualizerWindow.hide() : visualizerWindow.show()
    visualizerWindow.focus()
    return
  }
  createVisualizerWindow()
}

function createVisualizerWindow() {
  visualizerWindow = new BrowserWindow({
    width: 500,
    height: 400,
    minWidth: 300,
    minHeight: 300,
    title: 'SoundBar Visualizer',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  visualizerWindow.loadFile(path.join(__dirname, 'renderer', 'visualizer.html'))
  visualizerWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      visualizerWindow.hide()
    }
  })
  visualizerWindow.once('ready-to-show', () => {
    visualizerWindow.show()
    visualizerWindow.focus()
  })
}

function broadcastSettings() {
  if (visualizerWindow && !visualizerWindow.isDestroyed()) {
    try { visualizerWindow.webContents.send('settings-update', settings) } catch (_) {}
  }
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true)
    } else {
      callback(false)
    }
  })

  createTray()
  createVisualizerWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createVisualizerWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  app.isQuitting = true
})

ipcMain.on('audio-metrics', (_event, metrics) => {
  const rmsAvg = (metrics.rms.L + metrics.rms.R) / 2
  const peakMax = Math.max(metrics.peak.L, metrics.peak.R)
  const level = isFinite(rmsAvg) ? rmsAvg : -60

  try {
    tray.setImage(createTrayIcon(level, metrics.fft))
    tray.setToolTip(
      `RMS: ${level.toFixed(1)} dBFS  |  Peak: ${isFinite(peakMax) ? peakMax.toFixed(1) : '-∞'} dBFS`
    )
  } catch (_) {}

  if (metrics.devices) {
    settings.availableDevices = metrics.devices
  }
  if (metrics.selectedDeviceId !== undefined) {
    settings.selectedMicDevice = metrics.selectedDeviceId
  }

  if (visualizerWindow && !visualizerWindow.isDestroyed()) {
    try {
      visualizerWindow.webContents.send('metrics-update', { ...metrics, settings })
    } catch (_) {}
  }
})

ipcMain.handle('get-presets', () => PRESETS)
ipcMain.handle('get-settings', () => settings)
ipcMain.handle('get-audio-input-devices', () => settings.availableDevices)

ipcMain.on('settings-change', (_event, newSettings) => {
  settings = { ...settings, ...newSettings }
  broadcastSettings()
})

ipcMain.on('set-preset', (_event, presetName) => {
  updateSafeZoneFromPreset(presetName)
  broadcastSettings()
})

ipcMain.on('select-audio-device', (_event, deviceId) => {
  settings.selectedMicDevice = deviceId
  broadcastSettings()
})

ipcMain.on('open-dev-tools', (_event) => {
  const win = BrowserWindow.fromWebContents(_event.sender)
  if (win) win.webContents.openDevTools()
})
