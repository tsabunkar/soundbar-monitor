const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('soundbar', {
  onMetricsUpdate: (callback) => {
    ipcRenderer.on('metrics-update', (_event, metrics) => callback(metrics))
  },
  onSettingsUpdate: (callback) => {
    ipcRenderer.on('settings-update', (_event, settings) => callback(settings))
  },
  sendMetrics: (metrics) => {
    ipcRenderer.send('audio-metrics', metrics)
  },
  sendSettings: (settings) => {
    ipcRenderer.send('settings-change', settings)
  },
  getSettings: () => ipcRenderer.invoke('get-settings'),
  getPresets: () => ipcRenderer.invoke('get-presets'),
  setPreset: (name) => ipcRenderer.send('set-preset', name),
  selectAudioDevice: (deviceId) => ipcRenderer.send('select-audio-device', deviceId),
  getAudioInputDevices: () => ipcRenderer.invoke('get-audio-input-devices'),
  openDevTools: () => ipcRenderer.send('open-dev-tools')
})
