const STYLES = ['Bars', 'Waveform', 'Spectrum', 'Circle']
let currentStyle = 0
let canvas, ctx
let metrics = { fft: [], rms: { L: -Infinity, R: -Infinity }, active: false, devices: [], selectedDeviceId: null }
let animId = null
let phase = 0
let lastDeviceListJSON = ''

function escapeHtml(s) {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

function updateDeviceSelector() {
  const sel = document.getElementById('micSelector')
  if (!sel) return
  const devices = metrics.devices
  if (!devices || devices.length === 0) {
    sel.style.display = 'none'
    return
  }
  sel.style.display = 'inline-block'
  const currentId = metrics.selectedDeviceId ?? ''
  const deviceJSON = JSON.stringify({ devices, currentId })
  if (deviceJSON === lastDeviceListJSON) return
  lastDeviceListJSON = deviceJSON
  sel.innerHTML = '<option value="">Default</option>' +
    devices.map(d => `<option value="${d.deviceId}"${d.deviceId === currentId ? ' selected' : ''}>${escapeHtml(d.label)}</option>`).join('')
}

function onDeviceSelect(deviceId) {
  window.soundbar.selectAudioDevice(deviceId)
}

function initCanvas() {
  canvas = document.getElementById('canvas')
  ctx = canvas.getContext('2d')
  resize()
  window.addEventListener('resize', resize)
}

function resize() {
  if (!canvas) return
  const rect = canvas.parentElement.getBoundingClientRect()
  canvas.width = rect.width * window.devicePixelRatio
  canvas.height = rect.height * window.devicePixelRatio
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
}

function cycleStyle(dir) {
  currentStyle = (currentStyle + dir + STYLES.length) % STYLES.length
  document.getElementById('styleName').textContent = STYLES[currentStyle]
}

function hsvToRgb(h, s, v) {
  const f = (n, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0)
  return [f(5), f(3), f(1)]
}

function drawBars(w, h) {
  const fft = metrics.fft
  if (!fft || fft.length === 0) return

  const barCount = 64
  const step = Math.floor(fft.length / barCount)
  const barW = (w - 10) / barCount
  const gap = 1

  for (let i = 0; i < barCount; i++) {
    let sum = 0
    for (let j = 0; j < step; j++) {
      sum += fft[i * step + j] || 0
    }
    const avg = sum / step
    const norm = avg / 255
    const barH = norm * h * 0.85
    const x = 5 + i * barW
    const hue = 200 + norm * 160
    const [r, g, b] = hsvToRgb(hue, 0.85, 0.5 + norm * 0.5)
    ctx.fillStyle = `rgb(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0})`
    ctx.fillRect(x, h - barH, barW - gap, barH)
  }
}

function drawWaveform(w, h) {
  const fft = metrics.fft
  if (!fft || fft.length === 0) return

  const len = 128
  const step = Math.max(1, Math.floor(fft.length / len))
  const cx = w / 2
  const cy = h / 2

  ctx.beginPath()
  ctx.strokeStyle = '#33ccff'
  ctx.lineWidth = 2
  ctx.shadowColor = 'rgba(51, 204, 255, 0.3)'
  ctx.shadowBlur = 8

  for (let i = 0; i < len; i++) {
    let sum = 0
    for (let j = 0; j < step; j++) {
      sum += fft[i * step + j] || 0
    }
    const norm = (sum / step) / 255
    const x = (i / len) * w
    const y = cy + (norm - 0.5) * h * 0.8
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }

  ctx.stroke()
  ctx.shadowBlur = 0
}

function drawSpectrum(w, h) {
  const fft = metrics.fft
  if (!fft || fft.length === 0) return

  ctx.beginPath()
  ctx.strokeStyle = '#ff6633'
  ctx.lineWidth = 2
  ctx.shadowColor = 'rgba(255, 102, 51, 0.3)'
  ctx.shadowBlur = 6

  const len = fft.length
  ctx.moveTo(0, h)
  for (let i = 0; i < len; i++) {
    const norm = fft[i] / 255
    const x = (i / len) * w
    const y = h - norm * h * 0.9
    ctx.lineTo(x, y)
  }
  ctx.lineTo(w, h)
  ctx.closePath()

  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, 'rgba(255, 102, 51, 0.4)')
  grad.addColorStop(0.5, 'rgba(255, 102, 51, 0.15)')
  grad.addColorStop(1, 'rgba(255, 102, 51, 0)')
  ctx.fillStyle = grad
  ctx.fill()

  ctx.stroke()
  ctx.shadowBlur = 0
}

function drawCircle(w, h) {
  const fft = metrics.fft
  if (!fft || fft.length === 0) return

  const cx = w / 2
  const cy = h / 2
  const maxR = Math.min(cx, cy) * 0.75
  const len = 64
  const step = Math.max(1, Math.floor(fft.length / len))

  phase += 0.008

  ctx.beginPath()
  const avgRms = ((isFinite(metrics.rms.L) ? metrics.rms.L : -60) +
                  (isFinite(metrics.rms.R) ? metrics.rms.R : -60)) / 2
  const rmsNorm = Math.min(1, Math.max(0, (avgRms + 60) / 60))
  const baseR = maxR * (0.2 + rmsNorm * 0.3)

  for (let i = 0; i <= len; i++) {
    const idx = i % len
    let sum = 0
    for (let j = 0; j < step; j++) {
      sum += fft[idx * step + j] || 0
    }
    const norm = (sum / step) / 255
    const angle = (i / len) * Math.PI * 2 - Math.PI / 2 + phase
    const r = baseR + norm * maxR * 0.6
    const x = cx + Math.cos(angle) * r
    const y = cy + Math.sin(angle) * r
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.closePath()

  const hue = 280 + rmsNorm * 60
  const [r, g, b] = hsvToRgb(hue, 0.7, 0.6 + rmsNorm * 0.4)
  ctx.fillStyle = `rgba(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0},0.5)`
  ctx.fill()
  ctx.strokeStyle = `rgb(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0})`
  ctx.lineWidth = 2
  ctx.stroke()
}

const RENDERERS = [drawBars, drawWaveform, drawSpectrum, drawCircle]

function render() {
  if (!canvas || !ctx) {
    animId = requestAnimationFrame(render)
    return
  }

  const rect = canvas.parentElement.getBoundingClientRect()
  const w = rect.width
  const h = rect.height

  if (!metrics.active) {
    ctx.clearRect(0, 0, w, h)
    animId = requestAnimationFrame(render)
    return
  }

  ctx.fillStyle = 'rgba(17, 17, 17, 0.85)'
  ctx.fillRect(0, 0, w, h)

  RENDERERS[currentStyle](w, h)

  animId = requestAnimationFrame(render)
}

function updateUI() {
  const emptyState = document.getElementById('emptyState')
  const vizContent = document.getElementById('vizContent')

  if (!metrics.active || !metrics.fft || metrics.fft.length === 0) {
    emptyState.style.display = 'flex'
    vizContent.style.display = 'none'
  } else {
    emptyState.style.display = 'none'
    vizContent.style.display = 'block'
  }
}

initCanvas()
document.getElementById('styleName').textContent = STYLES[currentStyle]

window.soundbar.onMetricsUpdate((m) => {
  const wasInactive = !metrics.active
  metrics = m
  updateUI()
  updateDeviceSelector()
  if (metrics.active && wasInactive && animId === null) {
    animId = requestAnimationFrame(render)
  }
})

window.soundbar.onSettingsUpdate(() => {
  updateDeviceSelector()
})

updateUI()

if (!animId) {
  animId = requestAnimationFrame(render)
}
