const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

const userDataPath = app.getPath('userData')
const dbPath = path.join(userDataPath, 'trading_tracker.db')
const imagesPath = path.join(userDataPath, 'trade_images')

if (!fs.existsSync(imagesPath)) {
  fs.mkdirSync(imagesPath, { recursive: true })
}

let db
let mainWindow

function initDatabase() {
  // Uses Node's built-in sqlite module (Node 22+) — no compilation needed
  const { DatabaseSync } = require('node:sqlite')
  db = new DatabaseSync(dbPath)

  db.exec("PRAGMA journal_mode = WAL")
  db.exec("PRAGMA foreign_keys = ON")

  db.exec(`
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      position_id TEXT UNIQUE,
      symbol TEXT NOT NULL,
      direction TEXT NOT NULL CHECK(direction IN ('BUY', 'SELL')),
      open_time TEXT NOT NULL,
      close_time TEXT,
      open_price REAL NOT NULL,
      close_price REAL,
      volume REAL NOT NULL,
      stop_loss REAL,
      take_profit REAL,
      commission REAL DEFAULT 0,
      swap REAL DEFAULT 0,
      pnl REAL,
      pnl_pips REAL,
      status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed', 'cancelled')),
      setup TEXT,
      session TEXT,
      tags TEXT DEFAULT '[]',
      emotions_before TEXT DEFAULT '[]',
      emotions_after TEXT DEFAULT '[]',
      rating INTEGER CHECK(rating BETWEEN 1 AND 5),
      notes TEXT DEFAULT '',
      mistakes TEXT DEFAULT '',
      lessons TEXT DEFAULT '',
      followed_plan INTEGER DEFAULT 1,
      risk_reward REAL,
      risk_amount REAL,
      account_balance REAL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trade_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trade_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT,
      type TEXT DEFAULT 'chart' CHECK(type IN ('chart', 'entry', 'exit', 'analysis', 'other')),
      timeframe TEXT,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS account_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_name TEXT DEFAULT 'Mi Cuenta',
      initial_balance REAL DEFAULT 10000,
      currency TEXT DEFAULT 'EUR',
      risk_per_trade REAL DEFAULT 1.0,
      max_daily_loss REAL DEFAULT 3.0,
      broker TEXT DEFAULT 'XTB',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      market_conditions TEXT DEFAULT '',
      pre_market_notes TEXT DEFAULT '',
      post_market_notes TEXT DEFAULT '',
      mood TEXT DEFAULT 'neutral',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS setups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      rules TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)

  const account = db.prepare('SELECT id FROM account_settings LIMIT 1').get()
  if (!account) {
    db.prepare('INSERT INTO account_settings (account_name) VALUES (?)').run('Mi Cuenta Principal')
  }

  const setupCount = db.prepare('SELECT COUNT(*) as c FROM setups').get()
  if (setupCount.c === 0) {
    const insertSetup = db.prepare('INSERT INTO setups (name, description) VALUES (?, ?)')
    const setups = [
      ['Breakout', 'Ruptura de niveles clave'],
      ['Pullback', 'Retroceso a zona de valor'],
      ['Trend Following', 'Seguimiento de tendencia'],
      ['Reversal', 'Reversión en zonas extremas'],
      ['Order Block', 'Bloques de órdenes institucionales'],
      ['Fair Value Gap', 'Gaps de valor razonable (FVG)'],
      ['Support/Resistance', 'Soportes y resistencias clásicos'],
      ['News Trading', 'Trading de noticias fundamentales'],
    ]
    setups.forEach(([name, desc]) => insertSetup.run(name, desc))
  }

  console.log('Database initialized at:', dbPath)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#0a0e1a',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0e1a',
      symbolColor: '#94a3b8',
      height: 38,
    },
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

// ============ IPC HANDLERS ============

ipcMain.handle('trades:getAll', (_, filters = {}) => {
  let query = 'SELECT * FROM trades WHERE 1=1'
  const params = []

  if (filters.status) { query += ' AND status = ?'; params.push(filters.status) }
  if (filters.symbol) { query += ' AND symbol LIKE ?'; params.push(`%${filters.symbol}%`) }
  if (filters.direction) { query += ' AND direction = ?'; params.push(filters.direction) }
  if (filters.setup) { query += ' AND setup = ?'; params.push(filters.setup) }
  if (filters.dateFrom) { query += ' AND close_time >= ?'; params.push(filters.dateFrom) }
  if (filters.dateTo) { query += ' AND close_time <= ?'; params.push(filters.dateTo) }
  if (filters.session) { query += ' AND session = ?'; params.push(filters.session) }

  query += ' ORDER BY COALESCE(close_time, open_time) DESC'
  return db.prepare(query).all(...params)
})

ipcMain.handle('trades:getById', (_, id) => {
  const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(id)
  if (trade) {
    trade.images = db.prepare('SELECT * FROM trade_images WHERE trade_id = ?').all(id)
    trade.tags = JSON.parse(trade.tags || '[]')
    trade.emotions_before = JSON.parse(trade.emotions_before || '[]')
    trade.emotions_after = JSON.parse(trade.emotions_after || '[]')
  }
  return trade
})

ipcMain.handle('trades:create', (_, t) => {
  const stmt = db.prepare(`
    INSERT INTO trades (
      position_id, symbol, direction, open_time, close_time, open_price, close_price,
      volume, stop_loss, take_profit, commission, swap, pnl, pnl_pips, status,
      setup, session, tags, emotions_before, emotions_after, rating, notes,
      mistakes, lessons, followed_plan, risk_reward, risk_amount, account_balance
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    t.position_id ?? null, t.symbol, t.direction, t.open_time,
    t.close_time ?? null, t.open_price, t.close_price ?? null,
    t.volume, t.stop_loss ?? null, t.take_profit ?? null,
    t.commission ?? 0, t.swap ?? 0, t.pnl ?? null, t.pnl_pips ?? null,
    t.status ?? 'closed', t.setup ?? null, t.session ?? null,
    JSON.stringify(t.tags || []),
    JSON.stringify(t.emotions_before || []),
    JSON.stringify(t.emotions_after || []),
    t.rating ?? null, t.notes ?? '', t.mistakes ?? '', t.lessons ?? '',
    t.followed_plan ? 1 : 0,
    t.risk_reward ?? null, t.risk_amount ?? null, t.account_balance ?? null
  )
  return { id: result.lastInsertRowid, ...t }
})

ipcMain.handle('trades:update', (_, { id, ...updates }) => {
  if (Array.isArray(updates.tags)) updates.tags = JSON.stringify(updates.tags)
  if (Array.isArray(updates.emotions_before)) updates.emotions_before = JSON.stringify(updates.emotions_before)
  if (Array.isArray(updates.emotions_after)) updates.emotions_after = JSON.stringify(updates.emotions_after)

  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ')
  db.prepare(`UPDATE trades SET ${fields}, updated_at = datetime('now') WHERE id = ?`).run(...Object.values(updates), id)
  return { success: true }
})

ipcMain.handle('trades:delete', (_, id) => {
  const images = db.prepare('SELECT filename FROM trade_images WHERE trade_id = ?').all(id)
  images.forEach(img => {
    const imgPath = path.join(imagesPath, img.filename)
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath)
  })
  db.prepare('DELETE FROM trades WHERE id = ?').run(id)
  return { success: true }
})

ipcMain.handle('trades:bulkImport', (_, tradesArray) => {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO trades (
      position_id, symbol, direction, open_time, close_time, open_price, close_price,
      volume, stop_loss, take_profit, commission, swap, pnl, status, session, tags
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  db.exec('BEGIN')
  let imported = 0
  try {
    for (const t of tradesArray) {
      const result = stmt.run(
        t.position_id ?? null, t.symbol, t.direction, t.open_time,
        t.close_time ?? null, t.open_price, t.close_price ?? null,
        t.volume, t.stop_loss ?? null, t.take_profit ?? null,
        t.commission ?? 0, t.swap ?? 0, t.pnl ?? null,
        t.status ?? 'closed', t.session ?? null, t.tags ?? '[]'
      )
      if (result.changes > 0) imported++
    }
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
  return { imported }
})

// --- IMAGES ---
ipcMain.handle('images:save', async (_, { tradeId, filePath, type, timeframe, notes, originalName }) => {
  const ext = path.extname(filePath)
  const filename = `trade_${tradeId}_${Date.now()}${ext}`
  const destPath = path.join(imagesPath, filename)
  fs.copyFileSync(filePath, destPath)
  const result = db.prepare(
    'INSERT INTO trade_images (trade_id, filename, original_name, type, timeframe, notes) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(tradeId, filename, originalName || filename, type || 'chart', timeframe || '', notes || '')
  return { id: result.lastInsertRowid, filename, path: destPath }
})

ipcMain.handle('images:delete', (_, imageId) => {
  const image = db.prepare('SELECT filename FROM trade_images WHERE id = ?').get(imageId)
  if (image) {
    const imgPath = path.join(imagesPath, image.filename)
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath)
    db.prepare('DELETE FROM trade_images WHERE id = ?').run(imageId)
  }
  return { success: true }
})

ipcMain.handle('images:getPath', (_, filename) => path.join(imagesPath, filename))

// --- STATS ---
ipcMain.handle('stats:getSummary', (_, filters = {}) => {
  let w = "WHERE status = 'closed'"
  const p = []
  if (filters.dateFrom) { w += ' AND close_time >= ?'; p.push(filters.dateFrom) }
  if (filters.dateTo) { w += ' AND close_time <= ?'; p.push(filters.dateTo) }
  if (filters.symbol) { w += ' AND symbol LIKE ?'; p.push(`%${filters.symbol}%`) }

  const stats = db.prepare(`
    SELECT COUNT(*) as total_trades,
      SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
      SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losing_trades,
      SUM(pnl) as total_pnl, AVG(pnl) as avg_pnl,
      MAX(pnl) as best_trade, MIN(pnl) as worst_trade,
      AVG(CASE WHEN pnl > 0 THEN pnl END) as avg_win,
      AVG(CASE WHEN pnl < 0 THEN pnl END) as avg_loss,
      SUM(CASE WHEN pnl > 0 THEN pnl ELSE 0 END) as gross_profit,
      SUM(CASE WHEN pnl < 0 THEN pnl ELSE 0 END) as gross_loss,
      AVG(risk_reward) as avg_rr,
      SUM(commission) as total_commission, SUM(swap) as total_swap
    FROM trades ${w}
  `).get(...p)

  const bySymbol = db.prepare(`
    SELECT symbol, COUNT(*) as trades, SUM(pnl) as total_pnl,
      SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as win_rate, AVG(pnl) as avg_pnl
    FROM trades ${w} GROUP BY symbol ORDER BY total_pnl DESC
  `).all(...p)

  const bySetup = db.prepare(`
    SELECT setup, COUNT(*) as trades, SUM(pnl) as total_pnl,
      SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as win_rate
    FROM trades ${w} AND setup IS NOT NULL GROUP BY setup ORDER BY total_pnl DESC
  `).all(...p)

  const bySession = db.prepare(`
    SELECT session, COUNT(*) as trades, SUM(pnl) as total_pnl,
      SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as win_rate
    FROM trades ${w} AND session IS NOT NULL GROUP BY session ORDER BY total_pnl DESC
  `).all(...p)

  const dailyPnl = db.prepare(`
    SELECT DATE(close_time) as date, SUM(pnl) as pnl, COUNT(*) as trades
    FROM trades ${w} GROUP BY DATE(close_time) ORDER BY date ASC
  `).all(...p)

  const byDirection = db.prepare(`
    SELECT direction, COUNT(*) as trades, SUM(pnl) as total_pnl,
      SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as win_rate
    FROM trades ${w} GROUP BY direction
  `).all(...p)

  const byDayOfWeek = db.prepare(`
    SELECT strftime('%w', close_time) as dow, COUNT(*) as trades, SUM(pnl) as total_pnl
    FROM trades ${w} GROUP BY dow ORDER BY dow
  `).all(...p)

  const byHour = db.prepare(`
    SELECT strftime('%H', close_time) as hour, COUNT(*) as trades, SUM(pnl) as total_pnl
    FROM trades ${w} GROUP BY hour ORDER BY hour
  `).all(...p)

  return { stats, bySymbol, bySetup, bySession, dailyPnl, byDirection, byDayOfWeek, byHour }
})

// --- ACCOUNT ---
ipcMain.handle('account:get', () => {
  return db.prepare('SELECT * FROM account_settings ORDER BY id DESC LIMIT 1').get()
})

ipcMain.handle('account:update', (_, data) => {
  const account = db.prepare('SELECT id FROM account_settings LIMIT 1').get()
  if (account) {
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ')
    db.prepare(`UPDATE account_settings SET ${fields} WHERE id = ?`).run(...Object.values(data), account.id)
  }
  return { success: true }
})

// --- SETUPS ---
ipcMain.handle('setups:getAll', () => {
  return db.prepare('SELECT * FROM setups WHERE active = 1 ORDER BY name').all()
})

ipcMain.handle('setups:create', (_, { name, description, rules }) => {
  const result = db.prepare('INSERT INTO setups (name, description, rules) VALUES (?, ?, ?)').run(name, description || '', rules || '')
  return { id: result.lastInsertRowid, name, description }
})

// --- DAILY NOTES ---
ipcMain.handle('dailyNotes:get', (_, date) => {
  return db.prepare('SELECT * FROM daily_notes WHERE date = ?').get(date)
})

ipcMain.handle('dailyNotes:save', (_, data) => {
  db.prepare(`
    INSERT INTO daily_notes (date, market_conditions, pre_market_notes, post_market_notes, mood)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      market_conditions = excluded.market_conditions,
      pre_market_notes = excluded.pre_market_notes,
      post_market_notes = excluded.post_market_notes,
      mood = excluded.mood
  `).run(data.date, data.market_conditions || '', data.pre_market_notes || '', data.post_market_notes || '', data.mood || 'neutral')
  return { success: true }
})

// --- DIALOGS ---
ipcMain.handle('dialog:openFile', async (_, options) => {
  return dialog.showOpenDialog(mainWindow, options)
})

ipcMain.handle('dialog:openImage', async () => {
  return dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }],
    properties: ['openFile', 'multiSelections'],
  })
})

ipcMain.handle('shell:openExternal', (_, url) => shell.openExternal(url))
ipcMain.handle('app:getVersion', () => app.getVersion())

// ============ APP LIFECYCLE ============
app.whenReady().then(() => {
  initDatabase()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (db) db.close()
    app.quit()
  }
})
