const {
  app, Tray, Menu, BrowserWindow, ipcMain, nativeImage, session, shell
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

let currentTrayStyle = 0
const TRAYS_COLS = 7
let traysHistory = new Array(TRAYS_COLS).fill(0)

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

  const fillCol = (x, w, y, h) => {
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        const px = x + dx, py = y + dy
        if (px < 0 || px >= size || py < 0 || py >= size) continue
        const i = (py * size + px) * 4
        buf[i] = b; buf[i + 1] = g; buf[i + 2] = r; buf[i + 3] = 255
      }
    }
  }

  const fftAvg = (arr, start, count) => {
    const end = Math.min(start + count, arr.length)
    if (end <= start) return 0
    let s = 0
    for (let i = start; i < end; i++) s += arr[i]
    return s / (end - start)
  }

  const hasData = fft && fft.length > 0

  if (currentTrayStyle === 0) {
    if (hasData) {
      const voiceAvg = fftAvg(fft, 0, 16)
      const norm = Math.min(1, Math.sqrt(voiceAvg / 255))
      traysHistory.shift()
      traysHistory.push(norm)
      for (let i = 0; i < TRAYS_COLS; i++) {
        const h = Math.max(1, Math.round(traysHistory[i] * (size - 2)))
        fillCol(2 + i * 4, 3, size - 1 - h, h)
      }
    } else {
      fillCol(3, 6, 16, 10); fillCol(12, 6, 10, 16); fillCol(21, 6, 4, 22)
    }
  } else if (currentTrayStyle === 1) {
    if (hasData) {
      const cols = size
      const step = Math.max(1, Math.floor(fft.length / cols))
      for (let x = 0; x < cols; x++) {
        const avg = fftAvg(fft, x * step, step)
        const norm = Math.min(1, avg / 255)
        const halfH = Math.max(1, Math.round(norm * (size / 2 - 1)))
        const cy = size / 2
        fillCol(x, 1, Math.round(cy - halfH), halfH * 2 + 1)
      }
    } else {
      fillCol(3, 6, 16, 10); fillCol(12, 6, 10, 16); fillCol(21, 6, 4, 22)
    }
  } else if (currentTrayStyle === 2) {
    if (hasData) {
      const cols = size
      const step = Math.max(1, Math.floor(fft.length / cols))
      for (let x = 0; x < cols; x++) {
        const avg = fftAvg(fft, x * step, step)
        const norm = Math.min(1, Math.sqrt(avg / 255))
        const h = Math.max(1, Math.round(norm * (size - 1)))
        fillCol(x, 1, size - h, h)
      }
    } else {
      fillCol(3, 6, 16, 10); fillCol(12, 6, 10, 16); fillCol(21, 6, 4, 22)
    }
  } else if (currentTrayStyle === 3) {
    if (hasData) {
      const avg = fftAvg(fft, 0, fft.length)
      const norm = Math.min(1, Math.sqrt(avg / 255))
      const maxR = size / 2 - 1
      const r2 = Math.max(2, Math.round(maxR * (0.2 + norm * 0.8)))
      for (let dy = -r2; dy <= r2; dy++) {
        for (let dx = -r2; dx <= r2; dx++) {
          if (dx * dx + dy * dy <= r2 * r2) {
            const px = size / 2 + dx
            const py = size / 2 + dy
            if (px >= 0 && px < size && py >= 0 && py < size) {
              const i = (py * size + px) * 4
              buf[i] = b; buf[i + 1] = g; buf[i + 2] = r; buf[i + 3] = 255
            }
          }
        }
      }
    } else {
      fillCol(3, 6, 16, 10); fillCol(12, 6, 10, 16); fillCol(21, 6, 4, 22)
    }
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
    icon: path.join(__dirname, 'favicon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  visualizerWindow.loadFile(path.join(__dirname, 'renderer', 'visualizer.html'))
  visualizerWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
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

  if (app.dock) app.dock.setIcon(path.join(__dirname, 'favicon.png'))
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

ipcMain.on('set-visualizer-style', (_event, index) => {
  currentTrayStyle = index
})

ipcMain.on('open-dev-tools', (_event) => {
  const win = BrowserWindow.fromWebContents(_event.sender)
  if (win) win.webContents.openDevTools()
})
