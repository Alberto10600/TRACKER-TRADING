import Papa from 'papaparse'
import * as XLSX from 'xlsx'

// ============ SYMBOL NORMALIZATION ============
// Maps XTB-specific symbol names to standard industry symbols
const SYMBOL_MAP = {
  'GOLD': 'XAUUSD',
  'SILVER': 'XAGUSD',
  'PLATINUM': 'XPTUSD',
  'PALLADIUM': 'XPDUSD',
  'OIL': 'USOIL',
  'OILUK': 'UKOIL',
  'BRENT': 'UKOIL',
  'NATGAS': 'XNGUSD',
  'COPPER': 'XCUUSD',
  'CORN': 'CORN',
  'WHEAT': 'WHEAT',
  'SOYBEAN': 'SOYBEAN',
  'BITCOIN': 'BTCUSD',
  'BTC': 'BTCUSD',
  'ETH': 'ETHUSD',
  'ETHEREUM': 'ETHUSD',
  'LITECOIN': 'LTCUSD',
  'LTC': 'LTCUSD',
  'US100': 'US100',
  'US30': 'US30',
  'US500': 'US500',
  'DE40': 'DE40',
  'UK100': 'UK100',
  'EU50': 'EU50',
  'JP225': 'JP225',
  'AUS200': 'AUS200',
  'HK50': 'HK50',
  'NASDAQ': 'US100',
  'DOW': 'US30',
  'SPX': 'US500',
  'DAX': 'DE40',
  'FTSE': 'UK100',
}

// Detect instrument type from (normalized) symbol
function detectInstrumentType(symbol) {
  if (!symbol) return 'unknown'
  const s = symbol.toUpperCase()

  // Commodities - metals
  if (['XAUUSD', 'XAGUSD', 'XPTUSD', 'XPDUSD', 'XCUUSD'].includes(s)) return 'commodity'
  // Commodities - energy
  if (['USOIL', 'UKOIL', 'XNGUSD'].includes(s)) return 'commodity'
  // Commodities - softs
  if (['CORN', 'WHEAT', 'SOYBEAN'].includes(s)) return 'commodity'
  // Crypto
  if (s.endsWith('BTC') || s.startsWith('BTC') || s.endsWith('ETH') || s.startsWith('ETH') ||
      ['BTCUSD', 'ETHUSD', 'LTCUSD', 'XRPUSD', 'ADAUSD', 'SOLUSD', 'DOTUSD'].includes(s)) return 'crypto'
  // Indices
  if (['US100', 'US30', 'US500', 'DE40', 'UK100', 'EU50', 'JP225', 'AUS200', 'HK50',
       'NAS100', 'SPX500', 'NASDAQ', 'DOW', 'DAX', 'FTSE'].includes(s)) return 'index'
  // Stocks (typically end in .US, .DE, .UK etc or are known tickers)
  if (s.includes('.') || s.match(/^[A-Z]{1,5}(\.US|\.DE|\.UK|\.FR)$/)) return 'stock'
  // Forex: standard 6-char currency pairs or with suffix
  if (s.match(/^[A-Z]{6}(\.?[a-z]*)?$/) && !s.includes('USD') === false) {
    // Most 6-char uppercase symbols that look like currency pairs
    const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD', 'SEK', 'NOK', 'DKK', 'SGD', 'HKD', 'MXN', 'ZAR', 'TRY', 'PLN', 'CZK', 'HUF', 'RON']
    const base = s.substring(0, 3)
    const quote = s.substring(3, 6)
    if (currencies.includes(base) && currencies.includes(quote)) return 'forex'
  }
  // Fallback: if 6 chars and all uppercase letters, likely forex
  if (s.match(/^[A-Z]{6}$/)) return 'forex'
  return 'unknown'
}

// Normalize XTB symbol to standard form
function normalizeSymbol(rawSymbol) {
  if (!rawSymbol) return rawSymbol
  const upper = rawSymbol.trim().toUpperCase()
  // Check direct map first
  if (SYMBOL_MAP[upper]) return SYMBOL_MAP[upper]
  // Some XTB symbols have suffixes like "GOLD.US" or "XAUUSD_4" — strip known suffixes
  const withoutSuffix = upper.replace(/[._].*$/, '')
  if (SYMBOL_MAP[withoutSuffix]) return SYMBOL_MAP[withoutSuffix]
  // Return cleaned uppercase symbol
  return upper
}

// Determine trading session from time
function detectSession(timeStr) {
  if (!timeStr) return null
  const date = new Date(timeStr)
  const hour = date.getUTCHours()
  if (hour >= 0 && hour < 8) return 'Asiática'
  if (hour >= 8 && hour < 12) return 'Londres AM'
  if (hour >= 12 && hour < 16) return 'Nueva York AM'
  if (hour >= 16 && hour < 20) return 'Nueva York PM'
  return 'Pre-Mercado'
}

// Parse XTB CSV export format
export function parseXTBCSV(content) {
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: h => h.trim(),
  })

  const trades = []
  const errors = []

  for (const [index, row] of result.data.entries()) {
    try {
      // XTB CSV column names (may vary by version/language)
      // Try multiple possible column names
      const positionId = row['Position'] || row['ID'] || row['Nº operación'] || row['Trade ID'] || `ROW_${index}`
      const symbol = row['Symbol'] || row['Símbolo'] || row['Instrumento'] || ''
      const type = (row['Type'] || row['Tipo'] || row['Side'] || '').toUpperCase()
      const openTime = parseXTBDate(row['Open time'] || row['Hora apertura'] || row['Open Time'] || row['OpenTime'])
      const closeTime = parseXTBDate(row['Close time'] || row['Hora cierre'] || row['Close Time'] || row['CloseTime'])
      const openPrice = parseFloat(row['Open price'] || row['Precio apertura'] || row['Open Price'] || 0)
      const closePrice = parseFloat(row['Close price'] || row['Precio cierre'] || row['Close Price'] || 0)
      const volume = parseFloat(row['Volume'] || row['Volumen'] || row['Lots'] || row['Lotes'] || 0)
      const sl = parseFloat(row['S/L'] || row['Stop Loss'] || row['SL'] || 0) || null
      const tp = parseFloat(row['T/P'] || row['Take Profit'] || row['TP'] || 0) || null
      const commission = parseFloat(row['Commission'] || row['Comisión'] || row['Comision'] || 0) || 0
      const swap = parseFloat(row['Swap'] || row['Financiación'] || 0) || 0
      const profit = parseFloat(row['Profit'] || row['Beneficio'] || row['P&L'] || row['Net profit'] || 0)

      if (!symbol || !openTime) {
        errors.push({ row: index + 1, message: 'Symbol o fecha de apertura vacíos' })
        continue
      }

      // Determine direction
      let direction = 'BUY'
      if (type.includes('SELL') || type === 'S' || type === 'SHORT') direction = 'SELL'
      else if (type.includes('BUY') || type === 'B' || type === 'LONG') direction = 'BUY'

      const isOpen = !closeTime || closeTime === ''
      const pnl = isOpen ? null : profit + commission + swap
      const normalizedSymbol = normalizeSymbol(symbol)

      trades.push({
        position_id: String(positionId),
        symbol: normalizedSymbol,
        instrument_type: detectInstrumentType(normalizedSymbol),
        direction,
        open_time: openTime,
        close_time: isOpen ? null : closeTime,
        open_price: openPrice,
        close_price: isOpen ? null : closePrice,
        volume,
        stop_loss: sl,
        take_profit: tp,
        commission,
        swap,
        pnl: isOpen ? null : profit,
        status: isOpen ? 'open' : 'closed',
        session: detectSession(openTime),
        tags: '[]',
      })
    } catch (e) {
      errors.push({ row: index + 1, message: e.message })
    }
  }

  return { trades, errors, total: result.data.length }
}

// Parse XTB Excel/XLSX format
// XTB exports have metadata rows on top before the actual headers:
//   Row 1: Account | 2594247
//   Row 2: (account name)
//   Row 3: Date from (UTC): ...
//   Row 4: Date to (UTC): ...
//   Row 5: "Closed Positions"
//   Row 6: Instrument | Category | Ticker | Type | Volume | Open Price | Open Time (UTC) | ...
//   Row 7+: data
export function parseXTBXLSX(buffer) {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const trades = []
  const errors = []

  const sheetName = wb.SheetNames.find(n =>
    n.toLowerCase().includes('closed') ||
    n.toLowerCase().includes('cerrad') ||
    n.toLowerCase().includes('trade') ||
    n.toLowerCase().includes('histor')
  ) || wb.SheetNames[0]

  const ws = wb.Sheets[sheetName]

  // Read as strings for header detection
  const allRowsStr = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' })
  // Read as raw values (Date objects, numbers) for actual data
  const allRowsRaw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, cellDates: true, defval: null })

  // Find the row that contains actual column headers (has ≥2 known keywords)
  const headerKeywords = ['instrument', 'position', 'type', 'volume', 'symbol', 'ticker', 'open price', 'close price', 'open time', 'close time', 'profit']
  let headerRowIdx = -1
  for (let i = 0; i < Math.min(allRowsStr.length, 25); i++) {
    const row = allRowsStr[i]
    if (!row || !row.length) continue
    const rowStr = row.map(c => String(c || '').toLowerCase()).join('|')
    const matches = headerKeywords.filter(kw => rowStr.includes(kw)).length
    if (matches >= 3) { headerRowIdx = i; break }
  }

  if (headerRowIdx === -1) {
    // Try with lower threshold
    for (let i = 0; i < Math.min(allRowsStr.length, 25); i++) {
      const row = allRowsStr[i]
      if (!row || !row.length) continue
      const rowStr = row.map(c => String(c || '').toLowerCase()).join('|')
      const matches = headerKeywords.filter(kw => rowStr.includes(kw)).length
      if (matches >= 2) { headerRowIdx = i; break }
    }
  }

  if (headerRowIdx === -1) {
    const firstRows = allRowsStr.slice(0, 5).map(r => r?.join(' | ')).join('\n')
    return { trades: [], errors: [{ row: 0, message: `No se encontraron las columnas de XTB. Primeras filas detectadas:\n${firstRows}` }], total: 0 }
  }

  // Use string row for header names, raw rows for data values
  const headers = allRowsStr[headerRowIdx].map(h => String(h || '').trim())
  const dataRowsStr = allRowsStr.slice(headerRowIdx + 1)
  const dataRowsRaw = allRowsRaw.slice(headerRowIdx + 1)

  // Normalize a string: lowercase, remove all non-alphanumeric chars
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

  for (const [index, rowArr] of dataRowsRaw.entries()) {
    const rowArrStr = dataRowsStr[index] || []
    if (!rowArr || rowArr.every(c => c === null || c === undefined || c === '')) continue // skip blank rows

    // Build objects: raw for values, string for fallback
    const row = {}
    const rowStr = {}
    headers.forEach((h, i) => {
      if (h) {
        row[h] = rowArr[i]
        rowStr[h] = rowArrStr[i]
      }
    })

    try {
      const keys = Object.keys(row)
      // Flexible column getter: matches by normalized name, prefers raw, falls back to string
      const get = (...names) => {
        for (const n of names) {
          const key = keys.find(k => norm(k) === norm(n))
          if (key !== undefined) {
            const rawVal = row[key]
            const strVal = rowStr[key]
            // Return raw value if it's a Date or meaningful number/string
            if (rawVal instanceof Date) return rawVal
            if (rawVal !== null && rawVal !== undefined && rawVal !== '') return rawVal
            if (strVal !== null && strVal !== undefined && strVal !== '') return strVal
          }
        }
        return ''
      }

      // XTB exact column names + common fallbacks
      const positionId = get('Position ID', 'Position', 'ID', 'Trade ID', 'Nº operación') || `XLSX_${index}`
      const symbol     = get('Instrument', 'Symbol', 'Símbolo', 'Instrumento', 'Ticker')
      const type       = String(get('Type', 'Tipo', 'Side') || '').toUpperCase()
      const openTime   = parseXTBDate(get('Open Time (UTC)', 'Open Time UTC', 'Open Time', 'OpenTime', 'Hora apertura'))
      const closeTime  = parseXTBDate(get('Close Time (UTC)', 'Close Time UTC', 'Close Time', 'CloseTime', 'Hora cierre'))
      const openPrice  = parseNum(get('Open Price', 'OpenPrice', 'Precio apertura'))
      const closePrice = parseNum(get('Close Price', 'ClosePrice', 'Precio cierre'))
      const volume     = parseNum(get('Volume', 'Volumen', 'Lots', 'Lotes'))
      const sl         = parseNum(get('Stop Loss', 'S/L', 'SL', 'StopLoss')) || null
      const tp         = parseNum(get('Take Profit', 'T/P', 'TP', 'TakeProfit')) || null
      const commission = parseNum(get('Commission', 'Comisión', 'Comision')) || 0
      const swap       = parseNum(get('Swap', 'Financiación', 'Rollover')) || 0
      const profit     = parseNum(get('Profit/Loss', 'Profit', 'Beneficio', 'P&L', 'Net profit', 'ProfitLoss'))

      if (!symbol || !openTime) {
        errors.push({ row: index + 1, message: `Symbol="${symbol}" openTime="${openTime}" — fila ignorada` })
        continue
      }

      let direction = type.includes('SELL') || type === 'S' ? 'SELL' : 'BUY'
      const isOpen = !closeTime
      const normalizedSymbol = normalizeSymbol(String(symbol))

      trades.push({
        position_id: String(positionId),
        symbol: normalizedSymbol,
        instrument_type: detectInstrumentType(normalizedSymbol),
        direction,
        open_time: openTime,
        close_time: isOpen ? null : closeTime,
        open_price: openPrice,
        close_price: isOpen ? null : closePrice,
        volume,
        stop_loss: sl,
        take_profit: tp,
        commission,
        swap,
        pnl: isOpen ? null : profit,
        status: isOpen ? 'open' : 'closed',
        session: detectSession(openTime),
        tags: '[]',
      })
    } catch (e) {
      errors.push({ row: index + 1, message: e.message })
    }
  }

  return { trades, errors, total: dataRowsRaw.filter(r => r && r.some(c => c !== null && c !== undefined && c !== '')).length }
}

function parseXTBDate(val) {
  if (!val) return null

  // Date object (from XLSX cellDates:true)
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null
    return val.toISOString().replace('T', ' ').substring(0, 19)
  }

  // Excel serial number (number of days since 1900-01-01)
  if (typeof val === 'number') {
    if (val < 1 || val > 2958465) return null // outside 1900–9999 range
    // Adjust for Excel's phantom leap day (Feb 29, 1900)
    const adjusted = val > 59 ? val - 1 : val
    const ms = Math.round((adjusted - 25568) * 86400000)
    const d = new Date(ms)
    if (isNaN(d.getTime())) return null
    return d.toISOString().replace('T', ' ').substring(0, 19)
  }

  const str = String(val).trim()
  if (!str || str === '0' || str.toLowerCase() === 'nan') return null

  // ISO-like: 2024-01-15 09:30:00 or 2024-01-15T09:30:00
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(str)) {
    const d = new Date(str.replace(' ', 'T').replace(/(?<!\+\d{2}:\d{2})$/, 'Z').replace('ZZ', 'Z'))
    if (!isNaN(d.getTime())) return d.toISOString().replace('T', ' ').substring(0, 19)
  }

  // DD.MM.YYYY HH:mm:ss
  const m1 = str.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):?(\d{2})?/)
  if (m1) {
    const d = new Date(`${m1[3]}-${m1[2]}-${m1[1]}T${m1[4]}:${m1[5]}:${m1[6] || '00'}Z`)
    if (!isNaN(d.getTime())) return d.toISOString().replace('T', ' ').substring(0, 19)
  }

  // MM/DD/YYYY HH:mm:ss or M/D/YYYY H:mm:ss
  const m2 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):?(\d{2})?/)
  if (m2) {
    const d = new Date(`${m2[3]}-${m2[1].padStart(2, '0')}-${m2[2].padStart(2, '0')}T${m2[4].padStart(2, '0')}:${m2[5]}:${m2[6] || '00'}Z`)
    if (!isNaN(d.getTime())) return d.toISOString().replace('T', ' ').substring(0, 19)
  }

  // Fallback: native Date parse
  const d = new Date(str)
  if (!isNaN(d.getTime())) return d.toISOString().replace('T', ' ').substring(0, 19)
  return null
}

function parseNum(val) {
  if (val === null || val === undefined || val === '') return 0
  const n = parseFloat(String(val).replace(',', '.').replace(/\s/g, ''))
  return isNaN(n) ? 0 : n
}
