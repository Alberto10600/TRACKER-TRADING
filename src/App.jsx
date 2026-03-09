import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Layout/Sidebar'
import Dashboard from './components/Dashboard/Dashboard'
import TradeLog from './components/TradeLog/TradeLog'
import TradeDetail from './components/TradeDetail/TradeDetail'
import Analytics from './components/Analytics/Analytics'
import TradeCalendar from './components/Calendar/TradeCalendar'
import ImportXTB from './components/Import/ImportXTB'
import Settings from './components/Settings/Settings'
import NewTrade from './components/TradeLog/NewTrade'
import ExportData from './components/Export/ExportData'
import PerformanceReport from './components/Export/PerformanceReport'
import PositionSizer from './components/Tools/PositionSizer'
import TradingAnalyst from './components/Analyst/TradingAnalyst'

export default function App() {
  const [account, setAccount] = useState(null)

  useEffect(() => {
    window.api?.account.get().then(setAccount)
  }, [])

  return (
    <div className="flex h-screen w-screen bg-bg-primary overflow-hidden">
      <Sidebar account={account} />
      <main className="flex-1 overflow-hidden flex flex-col">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard account={account} />} />
          <Route path="/trades" element={<TradeLog />} />
          <Route path="/trades/new" element={<NewTrade />} />
          <Route path="/trades/:id" element={<TradeDetail />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/calendar" element={<TradeCalendar />} />
          <Route path="/import" element={<ImportXTB />} />
          <Route path="/settings" element={<Settings account={account} setAccount={setAccount} />} />
          <Route path="/export" element={<ExportData />} />
          <Route path="/report" element={<PerformanceReport />} />
          <Route path="/tools" element={<PositionSizer />} />
          <Route path="/analyst" element={<TradingAnalyst />} />
        </Routes>
      </main>
    </div>
  )
}
