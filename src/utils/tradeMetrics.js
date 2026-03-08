// Trading metrics calculations

export function calcMetrics(trades) {
  const closed = trades.filter(t => t.status === 'closed' && t.pnl !== null)
  if (closed.length === 0) return getEmptyMetrics()

  const winners = closed.filter(t => t.pnl > 0)
  const losers = closed.filter(t => t.pnl < 0)
  const breakeven = closed.filter(t => t.pnl === 0)

  const totalPnl = closed.reduce((sum, t) => sum + t.pnl, 0)
  const grossProfit = winners.reduce((sum, t) => sum + t.pnl, 0)
  const grossLoss = Math.abs(losers.reduce((sum, t) => sum + t.pnl, 0))

  const winRate = closed.length > 0 ? (winners.length / closed.length) * 100 : 0
  const avgWin = winners.length > 0 ? grossProfit / winners.length : 0
  const avgLoss = losers.length > 0 ? grossLoss / losers.length : 0
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0

  const avgRR = closed.filter(t => t.risk_reward).reduce((sum, t) => sum + t.risk_reward, 0) /
    (closed.filter(t => t.risk_reward).length || 1)

  // Expectancy = (WinRate * AvgWin) - (LossRate * AvgLoss)
  const lossRate = losers.length / closed.length
  const expectancy = (winRate / 100 * avgWin) - (lossRate * avgLoss)

  // Max drawdown
  let peak = 0
  let maxDrawdown = 0
  let runningPnl = 0
  const sortedByDate = [...closed].sort((a, b) => new Date(a.close_time) - new Date(b.close_time))
  for (const t of sortedByDate) {
    runningPnl += t.pnl
    if (runningPnl > peak) peak = runningPnl
    const dd = peak - runningPnl
    if (dd > maxDrawdown) maxDrawdown = dd
  }

  // Streaks
  let currentStreak = 0
  let maxWinStreak = 0
  let maxLossStreak = 0
  let winStreak = 0
  let lossStreak = 0
  for (const t of sortedByDate) {
    if (t.pnl > 0) {
      winStreak++; lossStreak = 0
      if (winStreak > maxWinStreak) maxWinStreak = winStreak
    } else if (t.pnl < 0) {
      lossStreak++; winStreak = 0
      if (lossStreak > maxLossStreak) maxLossStreak = lossStreak
    } else {
      winStreak = 0; lossStreak = 0
    }
  }

  const lastTrade = sortedByDate[sortedByDate.length - 1]
  if (lastTrade?.pnl > 0) currentStreak = winStreak
  else if (lastTrade?.pnl < 0) currentStreak = -lossStreak

  return {
    totalTrades: closed.length,
    winningTrades: winners.length,
    losingTrades: losers.length,
    breakevenTrades: breakeven.length,
    winRate,
    totalPnl,
    grossProfit,
    grossLoss,
    avgWin,
    avgLoss,
    profitFactor,
    avgRR,
    expectancy,
    bestTrade: Math.max(...closed.map(t => t.pnl)),
    worstTrade: Math.min(...closed.map(t => t.pnl)),
    avgPnl: totalPnl / closed.length,
    maxDrawdown,
    maxWinStreak,
    maxLossStreak,
    currentStreak,
  }
}

function getEmptyMetrics() {
  return {
    totalTrades: 0, winningTrades: 0, losingTrades: 0, breakevenTrades: 0,
    winRate: 0, totalPnl: 0, grossProfit: 0, grossLoss: 0,
    avgWin: 0, avgLoss: 0, profitFactor: 0, avgRR: 0, expectancy: 0,
    bestTrade: 0, worstTrade: 0, avgPnl: 0, maxDrawdown: 0,
    maxWinStreak: 0, maxLossStreak: 0, currentStreak: 0,
  }
}

export function buildEquityCurve(trades, initialBalance = 10000) {
  const closed = trades
    .filter(t => t.status === 'closed' && t.pnl !== null)
    .sort((a, b) => new Date(a.close_time) - new Date(b.close_time))

  let balance = initialBalance
  return closed.map(t => {
    balance += t.pnl
    return {
      date: t.close_time.substring(0, 10),
      balance: Math.round(balance * 100) / 100,
      pnl: t.pnl,
      symbol: t.symbol,
    }
  })
}

export function buildDailyPnl(trades) {
  const byDay = {}
  trades
    .filter(t => t.status === 'closed' && t.pnl !== null && t.close_time)
    .forEach(t => {
      const day = t.close_time.substring(0, 10)
      if (!byDay[day]) byDay[day] = { date: day, pnl: 0, trades: 0, wins: 0, losses: 0 }
      byDay[day].pnl += t.pnl
      byDay[day].trades++
      if (t.pnl > 0) byDay[day].wins++
      else if (t.pnl < 0) byDay[day].losses++
    })
  return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date))
}

export function formatCurrency(val, currency = 'EUR') {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(val)
}

export function formatPercent(val) {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`
}

export function pnlClass(val) {
  if (val > 0) return 'profit'
  if (val < 0) return 'loss'
  return 'neutral-pnl'
}

export function pnlSign(val) {
  if (val > 0) return '+'
  if (val < 0) return ''
  return ''
}
