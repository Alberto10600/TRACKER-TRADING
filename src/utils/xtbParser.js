import Papa from 'papaparse'
import * as XLSX from 'xlsx'

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

      trades.push({
        position_id: String(positionId),
        symbol: symbol.toUpperCase(),
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
export function parseXTBXLSX(buffer) {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const trades = []
  const errors = []

  // XTB typically puts trades in first sheet or "Closed" sheet
  const sheetName = wb.SheetNames.find(n =>
    n.toLowerCase().includes('closed') ||
    n.toLowerCase().includes('cerrad') ||
    n.toLowerCase().includes('trade') ||
    n.toLowerCase().includes('histor')
  ) || wb.SheetNames[0]

  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: 'yyyy-mm-dd hh:mm:ss' })

  for (const [index, row] of rows.entries()) {
    try {
      const keys = Object.keys(row)
      const get = (...names) => {
        for (const n of names) {
          const key = keys.find(k => k.toLowerCase().replace(/\s/g,'') === n.toLowerCase().replace(/\s/g,''))
          if (key && row[key] !== '' && row[key] !== undefined) return row[key]
        }
        return ''
      }

      const positionId = get('Position', 'ID', 'Trade', 'Nº') || `XLSX_${index}`
      const symbol = get('Symbol', 'Símbolo', 'Instrumento', 'Instrument')
      const type = String(get('Type', 'Tipo', 'Side')).toUpperCase()
      const openTime = parseXTBDate(get('Open time', 'OpenTime', 'Open Time', 'Hora apertura'))
      const closeTime = parseXTBDate(get('Close time', 'CloseTime', 'Close Time', 'Hora cierre'))
      const openPrice = parseNum(get('Open price', 'OpenPrice', 'Open Price', 'Precio apertura'))
      const closePrice = parseNum(get('Close price', 'ClosePrice', 'Close Price', 'Precio cierre'))
      const volume = parseNum(get('Volume', 'Volumen', 'Lots', 'Lotes'))
      const sl = parseNum(get('S/L', 'Stop Loss', 'SL')) || null
      const tp = parseNum(get('T/P', 'Take Profit', 'TP')) || null
      const commission = parseNum(get('Commission', 'Comisión', 'Comision')) || 0
      const swap = parseNum(get('Swap', 'Financiación')) || 0
      const profit = parseNum(get('Profit', 'Beneficio', 'P&L', 'Net profit'))

      if (!symbol || !openTime) continue

      let direction = type.includes('SELL') || type === 'S' ? 'SELL' : 'BUY'
      const isOpen = !closeTime

      trades.push({
        position_id: String(positionId),
        symbol: symbol.toUpperCase(),
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

  return { trades, errors, total: rows.length }
}

function parseXTBDate(val) {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().replace('T', ' ').substring(0, 19)
  const str = String(val).trim()
  if (!str || str === '0' || str.toLowerCase() === 'nan') return null
  // Try ISO format first
  const d = new Date(str)
  if (!isNaN(d)) return d.toISOString().replace('T', ' ').substring(0, 19)
  // Try DD.MM.YYYY HH:mm:ss
  const m = str.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):?(\d{2})?/)
  if (m) {
    const iso = `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6] || '00'}`
    return iso.replace('T', ' ')
  }
  return null
}

function parseNum(val) {
  if (val === null || val === undefined || val === '') return 0
  const n = parseFloat(String(val).replace(',', '.').replace(/\s/g, ''))
  return isNaN(n) ? 0 : n
}
