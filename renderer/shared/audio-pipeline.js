class AudioPipeline {
  constructor() {
    this.ctx = null
    this.stream = null
    this.source = null
    this.analyser = null
    this.processor = null

    this.rmsHistory = []
    this.rmsWindowMs = 300

    this.selectedDeviceId = null
    this.availableDevices = []

    this.state = {
      rms: { L: -Infinity, R: -Infinity },
      peak: { L: -Infinity, R: -Infinity },
      peakHold: { L: -Infinity, R: -Infinity },
      peakHoldTime: { L: 0, R: 0 },
      fft: [],
      clip: false,
      active: false,
      error: null,
      switching: false,
      devices: [],
      selectedDeviceId: null
    }

    this.settings = {
      peakHoldDuration: 2000,
      clipThreshold: -3
    }

    this.timer = null
    this.running = false
    this.restarting = false
  }

  async init() {
    try {
      if (window.soundbar) {
        try {
          const s = await window.soundbar.getSettings()
          if (s) {
            this.settings = { ...this.settings, ...s }
            if (s.selectedMicDevice) this.selectedDeviceId = s.selectedMicDevice
          }
        } catch (_) {}
        window.soundbar.onSettingsUpdate((s) => {
          const prevDevice = this.selectedDeviceId
          this.settings = { ...this.settings, ...s }
          if (s.selectedMicDevice !== undefined && s.selectedMicDevice !== prevDevice && !this.restarting) {
            this.selectedDeviceId = s.selectedMicDevice
            this.restart()
          }
        })
      }

      const constraints = {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: { ideal: 48000 },
          channelCount: { ideal: 2 }
        }
      }
      if (this.selectedDeviceId) {
        constraints.audio.deviceId = { exact: this.selectedDeviceId }
      }

      this.stream = await navigator.mediaDevices.getUserMedia(constraints)
      await this.enumerateDevices()

      this.ctx = new AudioContext()
      this.source = this.ctx.createMediaStreamSource(this.stream)

      this.analyser = this.ctx.createAnalyser()
      this.analyser.fftSize = 512
      this.analyser.smoothingTimeConstant = 0.85
      this.source.connect(this.analyser)

      this.processor = this.ctx.createScriptProcessor(2048, 2, 2)
      this.analyser.connect(this.processor)
      this.processor.connect(this.ctx.destination)

      this.processor.onaudioprocess = (e) => {
        if (!this.running) return
        this.process(e.inputBuffer.getChannelData(0), e.inputBuffer.getChannelData(1))
      }

      this.running = true
      this.state.active = true
      this.state.switching = false
      this.state.error = null
      this.timer = setInterval(() => this.send(), 50)
    } catch (err) {
      this.state.active = false
      this.state.switching = false
      this.state.error = err.message
      this.send()
    }
  }

  async enumerateDevices() {
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      this.availableDevices = all.filter(d => d.kind === 'audioinput')
      this.state.devices = this.availableDevices.map(d => ({
        deviceId: d.deviceId,
        label: d.label || d.deviceId.slice(0, 8) + '...',
        groupId: d.groupId
      }))
      this.state.selectedDeviceId = this.selectedDeviceId
    } catch (_) {}
  }

  async restart() {
    if (this.restarting) return
    this.restarting = true
    this.state.switching = true
    this.running = false
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    if (this.processor) this.processor.disconnect()
    if (this.source) this.source.disconnect()
    if (this.ctx) this.ctx.close()
    if (this.stream) this.stream.getTracks().forEach(t => t.stop())
    this.ctx = null
    this.stream = null
    this.source = null
    this.processor = null
    this.rmsHistory = []
    await this.init()
    this.restarting = false
  }

  process(l, r) {
    const windowLen = Math.round((this.rmsWindowMs / 1000) * (this.ctx.sampleRate || 48000))

    const rmsL = this.rms(l)
    const rmsR = this.rms(r)

    this.rmsHistory.push({ L: rmsL, R: rmsR, time: Date.now() })
    while (this.rmsHistory.length && Date.now() - this.rmsHistory[0].time > this.rmsWindowMs) {
      this.rmsHistory.shift()
    }

    const avgL = this.rmsHistory.reduce((s, v) => s + v.L, 0) / this.rmsHistory.length
    const avgR = this.rmsHistory.reduce((s, v) => s + v.R, 0) / this.rmsHistory.length
    const rmsDbfsL = 20 * Math.log10(Math.max(avgL, 1e-10))
    const rmsDbfsR = 20 * Math.log10(Math.max(avgR, 1e-10))

    const peakL = this.peak(l)
    const peakR = this.peak(r)
    const peakDbfsL = 20 * Math.log10(Math.max(peakL, 1e-10))
    const peakDbfsR = 20 * Math.log10(Math.max(peakR, 1e-10))

    const now = Date.now()
    if (peakDbfsL > this.state.peakHold.L || now - this.state.peakHoldTime.L > this.settings.peakHoldDuration) {
      this.state.peakHold.L = peakDbfsL
      this.state.peakHoldTime.L = now
    }
    if (peakDbfsR > this.state.peakHold.R || now - this.state.peakHoldTime.R > this.settings.peakHoldDuration) {
      this.state.peakHold.R = peakDbfsR
      this.state.peakHoldTime.R = now
    }

    this.state.rms.L = rmsDbfsL
    this.state.rms.R = rmsDbfsR
    this.state.peak.L = peakDbfsL
    this.state.peak.R = peakDbfsR
    this.state.clip = Math.max(peakDbfsL, peakDbfsR) > this.settings.clipThreshold

    const fft = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(fft)
    this.state.fft = Array.from(fft)
  }

  rms(samples) {
    let sum = 0
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
    return Math.sqrt(sum / samples.length)
  }

  peak(samples) {
    let p = 0
    for (let i = 0; i < samples.length; i++) {
      const a = Math.abs(samples[i])
      if (a > p) p = a
    }
    return p
  }

  send() {
    if (!window.soundbar) return
    const { rms, peak, peakHold, fft, clip, active, switching, error, devices, selectedDeviceId } = this.state
    window.soundbar.sendMetrics({ rms, peak, peakHold, fft, clip, active, switching, error, devices, selectedDeviceId })
  }
}

let pipeline

function start() {
  if (!pipeline) pipeline = new AudioPipeline()
  if (window.soundbar) {
    pipeline.init()
  } else {
    document.addEventListener('DOMContentLoaded', () => pipeline.init())
  }
}

start()
