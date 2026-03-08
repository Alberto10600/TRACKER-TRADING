const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

const userDataPath = app.getPath('userData')
const imagesPath = path.join(userDataPath, 'trade_images')
const DATA_DIR = userDataPath

if (!fs.existsSync(imagesPath)) fs.mkdirSync(imagesPath, { recursive: true })

let mainWindow

// ============ JSON STORAGE ============
const FILES = {
  trades: path.join(DATA_DIR, 'trades.json'),
  account: path.join(DATA_DIR, 'account.json'),
  setups: path.join(DATA_DIR, 'setups.json'),
  daily_notes: path.join(DATA_DIR, 'daily_notes.json'),
}

function read(key, def = []) {
  try {
    if (!fs.existsSync(FILES[key])) return def
    return JSON.parse(fs.readFileSync(FILES[key], 'utf8'))
  } catch { return def }
}

function write(key, data) {
  fs.writeFileSync(FILES[key], JSON.stringify(data, null, 2), 'utf8')
}

function nextId(arr) {
  return arr.length > 0 ? Math.max(0, ...arr.map(x => x.id || 0)) + 1 : 1
}

const sum = arr => arr.reduce((s, x) => s + (x || 0), 0)
const avg = arr => arr.length ? sum(arr) / arr.length : 0

// ============ INIT DEFAULTS ============
function initDefaults() {
  const account = read('account', null)
  if (!account) {
    write('account', {
      id: 1, account_name: 'Mi Cuenta Principal',
      initial_balance: 10000, currency: 'EUR',
      risk_per_trade: 1.0, max_daily_loss: 3.0, broker: 'XTB',
    })
  }
  const setups = read('setups', null)
  if (!setups) {
    write('setups', [
      { id: 1, name: 'Breakout', description: 'Ruptura de niveles clave', active: 1 },
      { id: 2, name: 'Pullback', description: 'Retroceso a zona de valor', active: 1 },
      { id: 3, name: 'Trend Following', description: 'Seguimiento de tendencia', active: 1 },
      { id: 4, name: 'Reversal', description: 'Reversión en zonas extremas', active: 1 },
      { id: 5, name: 'Order Block', description: 'Bloques de órdenes institucionales', active: 1 },
      { id: 6, name: 'Fair Value Gap', description: 'Gaps de valor razonable (FVG)', active: 1 },
      { id: 7, name: 'Support/Resistance', description: 'Soportes y resistencias clásicos', active: 1 },
      { id: 8, name: 'News Trading', description: 'Trading de noticias fundamentales', active: 1 },
    ])
  }
  if (!fs.existsSync(FILES.trades)) write('trades', [])
  if (!fs.existsSync(FILES.daily_notes)) write('daily_notes', {})
}

// ============ WINDOW ============
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1200, minHeight: 700,
    backgroundColor: '#0a0e1a',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0a0e1a', symbolColor: '#94a3b8', height: 38 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
  mainWindow.on('closed', () => { mainWindow = null })
}

// ============ TRADES ============
ipcMain.handle('trades:getAll', (_, filters = {}) => {
  let trades = read('trades')

  if (filters.status) trades = trades.filter(t => t.status === filters.status)
  if (filters.symbol) trades = trades.filter(t => t.symbol?.toUpperCase().includes(filters.symbol.toUpperCase()))
  if (filters.direction) trades = trades.filter(t => t.direction === filters.direction)
  if (filters.setup) trades = trades.filter(t => t.setup === filters.setup)
  if (filters.session) trades = trades.filter(t => t.session === filters.session)
  if (filters.dateFrom) trades = trades.filter(t => (t.close_time || t.open_time || '') >= filters.dateFrom)
  if (filters.dateTo) trades = trades.filter(t => (t.close_time || t.open_time || '') <= filters.dateTo + ' 23:59:59')

  return trades.sort((a, b) => {
    const da = a.close_time || a.open_time || ''
    const db = b.close_time || b.open_time || ''
    return db.localeCompare(da)
  })
})

ipcMain.handle('trades:getById', (_, id) => {
  const trades = read('trades')
  return trades.find(t => t.id === id) || null
})

ipcMain.handle('trades:create', (_, tradeData) => {
  const trades = read('trades')
  const newTrade = {
    ...tradeData,
    id: nextId(trades),
    tags: tradeData.tags || [],
    emotions_before: tradeData.emotions_before || [],
    emotions_after: tradeData.emotions_after || [],
    images: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  trades.push(newTrade)
  write('trades', trades)
  return newTrade
})

ipcMain.handle('trades:update', (_, { id, ...updates }) => {
  const trades = read('trades')
  const idx = trades.findIndex(t => t.id === id)
  if (idx !== -1) {
    trades[idx] = { ...trades[idx], ...updates, id, updated_at: new Date().toISOString() }
    write('trades', trades)
  }
  return { success: true }
})

ipcMain.handle('trades:delete', (_, id) => {
  let trades = read('trades')
  const trade = trades.find(t => t.id === id)
  if (trade?.images) {
    trade.images.forEach(img => {
      const p = path.join(imagesPath, img.filename)
      if (fs.existsSync(p)) fs.unlinkSync(p)
    })
  }
  write('trades', trades.filter(t => t.id !== id))
  return { success: true }
})

ipcMain.handle('trades:bulkImport', (_, tradesArray) => {
  const trades = read('trades')
  const existingIds = new Set(trades.map(t => t.position_id).filter(Boolean))
  let imported = 0
  let baseId = nextId(trades)

  for (const t of tradesArray) {
    if (t.position_id && existingIds.has(t.position_id)) continue
    trades.push({
      ...t,
      id: baseId++,
      tags: t.tags ? JSON.parse(t.tags) : [],
      emotions_before: [],
      emotions_after: [],
      images: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    if (t.position_id) existingIds.add(t.position_id)
    imported++
  }
  write('trades', trades)
  return { imported }
})

// ============ IMAGES ============
ipcMain.handle('images:save', async (_, { tradeId, filePath, type, timeframe, notes, originalName }) => {
  const ext = path.extname(filePath)
  const filename = `trade_${tradeId}_${Date.now()}${ext}`
  const destPath = path.join(imagesPath, filename)
  fs.copyFileSync(filePath, destPath)

  const trades = read('trades')
  const idx = trades.findIndex(t => t.id === tradeId)
  if (idx !== -1) {
    if (!trades[idx].images) trades[idx].images = []
    const imageId = Date.now()
    trades[idx].images.push({ id: imageId, filename, original_name: originalName || filename, type: type || 'chart', timeframe: timeframe || '', notes: notes || '' })
    write('trades', trades)
    return { id: imageId, filename, path: destPath }
  }
  return { error: 'Trade not found' }
})

ipcMain.handle('images:delete', (_, imageId) => {
  const trades = read('trades')
  for (const trade of trades) {
    if (!trade.images) continue
    const img = trade.images.find(i => i.id === imageId)
    if (img) {
      const p = path.join(imagesPath, img.filename)
      if (fs.existsSync(p)) fs.unlinkSync(p)
      trade.images = trade.images.filter(i => i.id !== imageId)
      write('trades', trades)
      return { success: true }
    }
  }
  return { success: true }
})

ipcMain.handle('images:getPath', (_, filename) => path.join(imagesPath, filename))

// ============ STATS ============
ipcMain.handle('stats:getSummary', (_, filters = {}) => {
  let trades = read('trades').filter(t => t.status === 'closed' && t.pnl !== null)

  if (filters.dateFrom) trades = trades.filter(t => (t.close_time || '') >= filters.dateFrom)
  if (filters.dateTo) trades = trades.filter(t => (t.close_time || '') <= filters.dateTo + ' 23:59:59')
  if (filters.symbol) trades = trades.filter(t => t.symbol?.includes(filters.symbol.toUpperCase()))

  const winners = trades.filter(t => t.pnl > 0)
  const losers = trades.filter(t => t.pnl < 0)
  const pnls = trades.map(t => t.pnl)
  const grossProfit = sum(winners.map(t => t.pnl))
  const grossLoss = Math.abs(sum(losers.map(t => t.pnl)))

  const stats = {
    total_trades: trades.length,
    winning_trades: winners.length,
    losing_trades: losers.length,
    total_pnl: sum(pnls),
    avg_pnl: avg(pnls),
    best_trade: pnls.length ? Math.max(...pnls) : 0,
    worst_trade: pnls.length ? Math.min(...pnls) : 0,
    avg_win: avg(winners.map(t => t.pnl)),
    avg_loss: avg(losers.map(t => t.pnl)),
    gross_profit: grossProfit,
    gross_loss: -grossLoss,
    avg_rr: avg(trades.filter(t => t.risk_reward).map(t => t.risk_reward)),
    total_commission: sum(trades.map(t => t.commission || 0)),
    total_swap: sum(trades.map(t => t.swap || 0)),
  }

  const groupBy = (arr, key) => arr.reduce((acc, t) => {
    const k = t[key]; if (!k) return acc
    if (!acc[k]) acc[k] = []
    acc[k].push(t); return acc
  }, {})

  const toStats = (map, keyName) => Object.entries(map).map(([k, ts]) => ({
    [keyName]: k, trades: ts.length,
    total_pnl: sum(ts.map(t => t.pnl)),
    win_rate: (ts.filter(t => t.pnl > 0).length / ts.length) * 100,
    avg_pnl: avg(ts.map(t => t.pnl)),
  })).sort((a, b) => b.total_pnl - a.total_pnl)

  const bySymbol = toStats(groupBy(trades, 'symbol'), 'symbol')
  const bySetup = toStats(groupBy(trades, 'setup'), 'setup')
  const bySession = toStats(groupBy(trades, 'session'), 'session')
  const byDirection = toStats(groupBy(trades, 'direction'), 'direction')

  const dailyMap = {}
  trades.forEach(t => {
    if (!t.close_time) return
    const day = t.close_time.substring(0, 10)
    if (!dailyMap[day]) dailyMap[day] = { date: day, pnl: 0, trades: 0 }
    dailyMap[day].pnl += t.pnl; dailyMap[day].trades++
  })
  const dailyPnl = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date))

  const dowMap = {}, hourMap = {}
  trades.forEach(t => {
    if (!t.close_time) return
    const d = new Date(t.close_time)
    const dow = d.getDay().toString()
    const hour = String(d.getHours()).padStart(2, '0')
    if (!dowMap[dow]) dowMap[dow] = { dow, pnl: 0, trades: 0 }
    if (!hourMap[hour]) hourMap[hour] = { hour, pnl: 0, trades: 0 }
    dowMap[dow].pnl += t.pnl; dowMap[dow].trades++
    hourMap[hour].pnl += t.pnl; hourMap[hour].trades++
  })
  const byDayOfWeek = Object.values(dowMap).sort((a, b) => a.dow.localeCompare(b.dow))
  const byHour = Object.values(hourMap).sort((a, b) => a.hour.localeCompare(b.hour))

  return { stats, bySymbol, bySetup, bySession, dailyPnl, byDirection, byDayOfWeek, byHour }
})

// ============ ACCOUNT ============
ipcMain.handle('account:get', () => read('account', {
  id: 1, account_name: 'Mi Cuenta', initial_balance: 10000,
  currency: 'EUR', risk_per_trade: 1.0, max_daily_loss: 3.0, broker: 'XTB',
}))

ipcMain.handle('account:update', (_, data) => {
  const current = read('account', {})
  write('account', { ...current, ...data })
  return { success: true }
})

// ============ SETUPS ============
ipcMain.handle('setups:getAll', () => read('setups', []).filter(s => s.active !== 0))

ipcMain.handle('setups:create', (_, { name, description, rules }) => {
  const setups = read('setups', [])
  const newSetup = { id: nextId(setups), name, description: description || '', rules: rules || '', active: 1 }
  setups.push(newSetup)
  write('setups', setups)
  return newSetup
})

// ============ DAILY NOTES ============
ipcMain.handle('dailyNotes:get', (_, date) => {
  const notes = read('daily_notes', {})
  return notes[date] || null
})

ipcMain.handle('dailyNotes:save', (_, data) => {
  const notes = read('daily_notes', {})
  notes[data.date] = { ...data }
  write('daily_notes', notes)
  return { success: true }
})

// ============ DIALOGS ============
ipcMain.handle('dialog:openFile', async (_, options) => dialog.showOpenDialog(mainWindow, options))
ipcMain.handle('dialog:openImage', async () => dialog.showOpenDialog(mainWindow, {
  filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }],
  properties: ['openFile', 'multiSelections'],
}))
ipcMain.handle('shell:openExternal', (_, url) => shell.openExternal(url))
ipcMain.handle('app:getVersion', () => app.getVersion())

// ============ APP LIFECYCLE ============
app.whenReady().then(() => {
  initDefaults()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
