import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function ExportData() {
  const navigate = useNavigate()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [status, setStatus] = useState('closed')
  const [exporting, setExporting] = useState(false)
  const [done, setDone] = useState(false)
  const [reportFrom, setReportFrom] = useState('')
  const [reportTo, setReportTo] = useState('')

  async function handleExport() {
    setExporting(true)
    setDone(false)
    try {
      const filters = { status: status || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }
      const csv = await window.api.export.csv(filters)
      // Create and download the file
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const today = new Date().toISOString().substring(0, 10)
      a.download = `trading-tracker-export-${today}.csv`
      a.click()
      URL.revokeObjectURL(url)
      setDone(true)
      setTimeout(() => setDone(false), 3000)
    } catch (e) {
      alert('Error al exportar: ' + e.message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 fade-in">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Exportar Datos</h1>
          <p className="text-text-secondary text-sm mt-1">
            Exporta tu historial de operaciones en formato CSV para análisis externo
          </p>
        </div>

        <div className="card space-y-5">
          <h2 className="text-text-primary font-semibold border-b border-border pb-2">Configurar exportación</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-text-muted text-xs block mb-1">Fecha desde</label>
              <input type="date" className="input w-full" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-text-muted text-xs block mb-1">Fecha hasta</label>
              <input type="date" className="input w-full" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-text-muted text-xs block mb-1">Estado de operaciones</label>
            <select className="input w-full" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="closed">Solo cerradas</option>
              <option value="open">Solo abiertas</option>
              <option value="">Todas</option>
            </select>
          </div>

          <div className="bg-bg-tertiary rounded-xl p-4">
            <p className="text-text-secondary text-sm font-medium mb-2">Campos incluidos en el CSV:</p>
            <p className="text-text-muted text-xs leading-relaxed font-mono">
              id, position_id, symbol, instrument_type, direction, status, open_time, close_time, open_price, close_price, volume, stop_loss, take_profit, pnl, commission, swap, setup, session, risk_reward, risk_amount, rating, followed_plan, notes
            </p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="btn-primary px-6"
            >
              {exporting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Exportando...
                </span>
              ) : done ? (
                '✓ Descargado'
              ) : (
                'Descargar CSV'
              )}
            </button>
          </div>
        </div>

        {/* Performance Report */}
        <div className="card space-y-5">
          <div>
            <h2 className="text-text-primary font-semibold border-b border-border pb-2">Informe de Rendimiento PDF</h2>
            <p className="text-text-muted text-xs mt-2">
              Genera un informe profesional con KPIs, desglose mensual, rendimiento por símbolo y setup. Se abre una previsualización desde la que puedes guardar como PDF.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-text-muted text-xs block mb-1">Fecha desde</label>
              <input type="date" className="input w-full" value={reportFrom} onChange={e => setReportFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-text-muted text-xs block mb-1">Fecha hasta</label>
              <input type="date" className="input w-full" value={reportTo} onChange={e => setReportTo(e.target.value)} />
            </div>
          </div>

          <div className="bg-bg-tertiary rounded-xl p-4 text-xs text-text-muted space-y-1">
            <p className="text-text-secondary font-medium text-sm mb-1">Contenido del informe:</p>
            <p>· Resumen de KPIs: P&L, Win Rate, Profit Factor, Expectativa, Max Drawdown, Recovery Factor</p>
            <p>· Estadísticas detalladas: rachas, comisiones, tiempos, días activos</p>
            <p>· Desglose mensual con barras de P&L</p>
            <p>· Rendimiento por símbolo, setup y sesión</p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => {
                const params = new URLSearchParams()
                if (reportFrom) params.set('from', reportFrom)
                if (reportTo) params.set('to', reportTo)
                navigate(`/report?${params.toString()}`)
              }}
              className="btn-primary px-6"
            >
              Ver Informe →
            </button>
          </div>
        </div>

        <div className="card space-y-3">
          <h2 className="text-text-primary font-semibold border-b border-border pb-2">Backup de datos</h2>
          <p className="text-text-muted text-xs">
            Tus datos se almacenan localmente en: <span className="font-mono text-text-secondary">%APPDATA%/trading-tracker/</span>
          </p>
          <p className="text-text-muted text-xs">
            Para hacer backup completo, copia el directorio de datos de la aplicación.
          </p>
        </div>
      </div>
    </div>
  )
}
