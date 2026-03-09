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
  goals: path.join(DATA_DIR, 'goals.json'),
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
  if (!fs.existsSync(FILES.goals)) write('goals', {})
}

// ============ WINDOW ============
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1200, minHeight: 700,
    backgroundColor: '#0f0e0d',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#181614', symbolColor: '#9e9890', height: 38 },
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

  const winRate = trades.length > 0 ? winners.length / trades.length : 0
  const avgWin = avg(winners.map(t => t.pnl))
  const avgLoss = avg(losers.map(t => t.pnl)) // negative value
  const totalPnl = sum(pnls)

  // --- Profit Factor ---
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0

  // --- Expected Value per trade ---
  const lossRate = trades.length > 0 ? losers.length / trades.length : 0
  const expectedValue = (winRate * avgWin) + (lossRate * avgLoss) // avgLoss is already negative

  // --- Max Drawdown (absolute and %) from equity peak ---
  const sortedByDate = [...trades].sort((a, b) =>
    new Date(a.close_time) - new Date(b.close_time)
  )
  let runningPnl = 0
  let peak = 0
  let maxDrawdown = 0
  let peakAtMaxDD = 0
  for (const t of sortedByDate) {
    runningPnl += t.pnl
    if (runningPnl > peak) peak = runningPnl
    const dd = peak - runningPnl
    if (dd > maxDrawdown) { maxDrawdown = dd; peakAtMaxDD = peak }
  }
  const maxDrawdownPct = peakAtMaxDD > 0 ? (maxDrawdown / peakAtMaxDD) * 100 : 0

  // --- Recovery Factor ---
  const recoveryFactor = maxDrawdown > 0 ? totalPnl / maxDrawdown : totalPnl > 0 ? Infinity : 0

  // --- Consecutive wins / losses ---
  let maxWinStreak = 0, maxLossStreak = 0, curW = 0, curL = 0
  for (const t of sortedByDate) {
    if (t.pnl > 0) { curW++; curL = 0; if (curW > maxWinStreak) maxWinStreak = curW }
    else if (t.pnl < 0) { curL++; curW = 0; if (curL > maxLossStreak) maxLossStreak = curL }
    else { curW = 0; curL = 0 }
  }

  // --- Average holding time in minutes ---
  const holdingTimes = trades
    .filter(t => t.open_time && t.close_time)
    .map(t => (new Date(t.close_time) - new Date(t.open_time)) / 60000)
    .filter(m => m >= 0)
  const avgHoldingTimeMinutes = holdingTimes.length > 0 ? avg(holdingTimes) : 0

  // --- Trades per active trading day ---
  const tradingDays = new Set(sortedByDate.map(t => t.close_time?.substring(0, 10)).filter(Boolean))
  const tradesPerDay = tradingDays.size > 0 ? trades.length / tradingDays.size : 0

  const stats = {
    total_trades: trades.length,
    winning_trades: winners.length,
    losing_trades: losers.length,
    total_pnl: totalPnl,
    avg_pnl: avg(pnls),
    best_trade: pnls.length ? Math.max(...pnls) : 0,
    worst_trade: pnls.length ? Math.min(...pnls) : 0,
    avg_win: avgWin,
    avg_loss: avgLoss,
    gross_profit: grossProfit,
    gross_loss: -grossLoss,
    avg_rr: avg(trades.filter(t => t.risk_reward).map(t => t.risk_reward)),
    total_commission: sum(trades.map(t => t.commission || 0)),
    total_swap: sum(trades.map(t => t.swap || 0)),
    // --- Advanced metrics ---
    profit_factor: profitFactor,
    expected_value: expectedValue,
    max_drawdown: maxDrawdown,
    max_drawdown_pct: maxDrawdownPct,
    recovery_factor: recoveryFactor,
    consecutive_wins: maxWinStreak,
    consecutive_losses: maxLossStreak,
    avg_holding_time_minutes: avgHoldingTimeMinutes,
    trades_per_day: tradesPerDay,
    win_rate: winRate * 100,
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

  // --- Monthly stats ---
  const monthlyMap = {}
  trades.forEach(t => {
    if (!t.close_time) return
    const month = t.close_time.substring(0, 7) // "YYYY-MM"
    if (!monthlyMap[month]) monthlyMap[month] = { month, pnl: 0, trades: 0, wins: 0 }
    monthlyMap[month].pnl += t.pnl
    monthlyMap[month].trades++
    if (t.pnl > 0) monthlyMap[month].wins++
  })
  const monthlyStats = Object.values(monthlyMap)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(m => ({ ...m, win_rate: m.trades > 0 ? (m.wins / m.trades) * 100 : 0 }))

  return { stats, bySymbol, bySetup, bySession, dailyPnl, byDirection, byDayOfWeek, byHour, monthlyStats }
})

// ============ EMOTION ANALYSIS ============
ipcMain.handle('stats:getEmotionAnalysis', (_, filters = {}) => {
  let trades = read('trades').filter(t => t.status === 'closed' && t.pnl !== null)

  if (filters.dateFrom) trades = trades.filter(t => (t.close_time || '') >= filters.dateFrom)
  if (filters.dateTo) trades = trades.filter(t => (t.close_time || '') <= filters.dateTo + ' 23:59:59')

  // Group by primary emotion before trade
  const emotionMap = {}
  trades.forEach(t => {
    const emotions = Array.isArray(t.emotions_before) ? t.emotions_before : []
    const primaryEmotion = emotions[0] || 'Sin registro'
    if (!emotionMap[primaryEmotion]) {
      emotionMap[primaryEmotion] = { emotion: primaryEmotion, trades: 0, wins: 0, totalPnl: 0, pnls: [] }
    }
    emotionMap[primaryEmotion].trades++
    emotionMap[primaryEmotion].totalPnl += t.pnl
    emotionMap[primaryEmotion].pnls.push(t.pnl)
    if (t.pnl > 0) emotionMap[primaryEmotion].wins++
  })

  const result = Object.values(emotionMap).map(e => ({
    emotion: e.emotion,
    trades: e.trades,
    win_rate: e.trades > 0 ? (e.wins / e.trades) * 100 : 0,
    avg_pnl: e.pnls.length > 0 ? e.totalPnl / e.pnls.length : 0,
    total_pnl: e.totalPnl,
  })).sort((a, b) => b.avg_pnl - a.avg_pnl)

  return result
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

// ============ GOALS ============
ipcMain.handle('goals:get', () => {
  return read('goals', {}) || { monthly_pnl: null, win_rate: null, max_trades: null }
})

ipcMain.handle('goals:update', (_, data) => {
  write('goals', data)
  return data
})

ipcMain.handle('goals:save', (_, data) => {
  write('goals', data)
  return data
})

// ============ EXPORT ============
ipcMain.handle('export:csv', (_, filters = {}) => {
  const trades = read('trades').filter(t => {
    if (filters.status && t.status !== filters.status) return false
    if (filters.dateFrom && t.close_time && t.close_time < filters.dateFrom) return false
    if (filters.dateTo && t.close_time && t.close_time > filters.dateTo + ' 23:59:59') return false
    return true
  })
  const headers = ['id','position_id','symbol','instrument_type','direction','status','open_time','close_time','open_price','close_price','volume','stop_loss','take_profit','pnl','commission','swap','setup','session','risk_reward','risk_amount','rating','followed_plan','notes']
  const rows = trades.map(t => headers.map(h => {
    const v = t[h]
    if (v === null || v === undefined) return ''
    if (typeof v === 'string' && v.includes(',')) return `"${v.replace(/"/g, '""')}"`
    return String(v)
  }).join(','))
  return [headers.join(','), ...rows].join('\n')
})

ipcMain.handle('stats:getDailyLoss', () => {
  const trades = read('trades')
  const account = read('account') || {}
  const today = new Date().toISOString().substring(0, 10)
  const todayTrades = trades.filter(t =>
    t.status === 'closed' && t.close_time && t.close_time.substring(0, 10) === today
  )
  const todayPnl = todayTrades.reduce((s, t) => s + (t.pnl || 0), 0)
  const balance = account.initial_balance || 10000
  const maxLossPct = account.max_daily_loss || 3
  const maxLossAmt = -(balance * maxLossPct / 100)
  return {
    today_pnl: todayPnl,
    max_loss_amount: maxLossAmt,
    max_loss_pct: maxLossPct,
    is_exceeded: todayPnl < maxLossAmt,
    pct_used: maxLossAmt < 0 ? Math.min(100, (Math.abs(todayPnl) / Math.abs(maxLossAmt)) * 100) : 0
  }
})

// ============ DAILY LOSS CHECK ============
ipcMain.handle('stats:getDailyPnl', (_, date) => {
  const dateStr = date || new Date().toISOString().substring(0, 10)
  const trades = read('trades').filter(t =>
    t.status === 'closed' && t.close_time && t.close_time.startsWith(dateStr)
  )
  const pnl = trades.reduce((s, t) => s + (t.pnl || 0), 0)
  return { date: dateStr, pnl, trades: trades.length }
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

// ============ CLAUDE AI ANALYST ============
const CONFIG_FILE = path.join(DATA_DIR, 'config.json')

function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {}
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
  } catch { return {} }
}

function writeConfig(data) {
  const current = readConfig()
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ...current, ...data }, null, 2), 'utf8')
}

ipcMain.handle('claude:getKey', () => readConfig().anthropic_api_key || null)

ipcMain.handle('claude:saveKey', (_, key) => {
  writeConfig({ anthropic_api_key: key })
  return { success: true }
})

const TRADING_SYSTEM_PROMPT = `You are an elite ICT (Inner Circle Trader) / Smart Money Concepts trading analyst specializing exclusively in XAUUSD (Gold) and US100 (NASDAQ 100).

Your methodology:
- **Market Structure**: HH/HL = bullish, LH/LL = bearish. Identify CHoCH (Change of Character) and BOS (Break of Structure).
- **Key Levels**: Order Blocks (OBs), Fair Value Gaps (FVGs/Imbalances), Liquidity pools (equal highs/lows, previous session H/L, swing points), Supply & Demand zones.
- **Sessions**: Asian (00:00-08:00 UTC) range building; London (07:00-11:00 UTC) liquidity hunts & trend initiation; New York (12:00-17:00 UTC) major moves & reversals, NY Open kill zone 13:30-15:00 UTC.
- **Entry Models**: OTE (Optimal Trade Entry) at 61.8–79% Fibonacci retracement, Breaker Blocks, Mitigation Blocks, FVG entries with confluence.
- **Risk Management**: SL below/above Order Block or key structure. Minimum 1:2 RR. TP at next liquidity pool or key level.

Instrument specifics:
- **XAUUSD (Gold)**: Inverse correlation with DXY. Highly sensitive to CPI, NFP, Fed speeches. Safe-haven spikes on geopolitical risk. Watch for London and NY open setups. Typical SL: 8-20 points minimum.
- **US100 (NASDAQ)**: Risk-on asset, correlates with tech sentiment. Sensitive to Fed rate decisions, tech earnings. Watch DXY for direction. Typical SL: 30-80 points minimum.

Always structure your analysis with these sections:
1. **BIAS** (Bullish / Bearish / Neutral + Confidence 1-10)
2. **Market Structure** (current structure, recent CHoCH/BOS)
3. **Key Levels** (exact price levels for OBs, FVGs, liquidity, support/resistance)
4. **Trade Setup** (Direction, Entry Zone, Stop Loss, TP1/TP2/TP3, R:R)
5. **Session Notes** (what to watch for current/upcoming session)
6. **Warnings** (news events, countertrend risks, invalidation level)

Be precise with price levels. Be direct and actionable. If information is insufficient, ask specific follow-up questions.`

ipcMain.handle('claude:analyze', async (event, { apiKey, messages, instrument }) => {
  let Anthropic
  try {
    Anthropic = require('@anthropic-ai/sdk')
  } catch (e) {
    event.sender.send('claude:chunk', { type: 'error', message: 'SDK no instalado. Ejecuta: npm install @anthropic-ai/sdk' })
    return { success: false }
  }

  const client = new Anthropic.default({ apiKey })
  const systemPrompt = `${TRADING_SYSTEM_PROMPT}\n\nInstrument activo: **${instrument}**`

  try {
    const stream = await client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      system: systemPrompt,
      messages,
    })

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        if (!event.sender.isDestroyed()) {
          event.sender.send('claude:chunk', { type: 'text', content: chunk.delta.text })
        }
      }
    }

    if (!event.sender.isDestroyed()) {
      event.sender.send('claude:chunk', { type: 'done' })
    }
    return { success: true }
  } catch (err) {
    if (!event.sender.isDestroyed()) {
      event.sender.send('claude:chunk', { type: 'error', message: err.message })
    }
    return { success: false, error: err.message }
  }
})

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
