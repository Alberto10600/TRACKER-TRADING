import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { parseXTBCSV, parseXTBXLSX } from '../../utils/xtbParser'
import { pnlClass } from '../../utils/tradeMetrics'

const STEPS = ['upload', 'preview', 'done']

export default function ImportXTB() {
  const [step, setStep] = useState('upload')
  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [previewPage, setPreviewPage] = useState(0)

  const onDrop = useCallback(async (acceptedFiles) => {
    const f = acceptedFiles[0]
    if (!f) return
    setFile(f)
    setParsed(null)

    try {
      let parseResult
      if (f.name.endsWith('.csv') || f.name.endsWith('.txt')) {
        const text = await f.text()
        parseResult = parseXTBCSV(text)
      } else if (f.name.endsWith('.xlsx') || f.name.endsWith('.xls')) {
        const buffer = await f.arrayBuffer()
        const arr = new Uint8Array(buffer)
        parseResult = parseXTBXLSX(arr)
      } else {
        alert('Formato no soportado. Usa CSV o Excel (.xlsx)')
        return
      }
      setParsed(parseResult)
      setStep('preview')
      setPreviewPage(0)
    } catch (e) {
      alert('Error al parsear el archivo: ' + e.message)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv', '.txt'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
  })

  async function handleImport() {
    if (!parsed?.trades?.length) return
    setImporting(true)
    const r = await window.api.trades.bulkImport(parsed.trades)
    setResult(r)
    setImporting(false)
    setStep('done')
  }

  function reset() {
    setStep('upload')
    setFile(null)
    setParsed(null)
    setResult(null)
    setPreviewPage(0)
  }

  const PAGE_SIZE = 20
  const previewTrades = parsed?.trades?.slice(previewPage * PAGE_SIZE, (previewPage + 1) * PAGE_SIZE) || []
  const totalPages = Math.ceil((parsed?.trades?.length || 0) / PAGE_SIZE)

  return (
    <div className="flex-1 overflow-y-auto p-6 fade-in">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Importar desde XTB</h1>
          <p className="text-text-secondary text-sm mt-1">
            Carga tu historial de operaciones exportado desde XTB (CSV o Excel)
          </p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-2 mb-8">
          {[
            { key: 'upload', label: '1. Cargar archivo' },
            { key: 'preview', label: '2. Previsualizar' },
            { key: 'done', label: '3. Completado' },
          ].map((s, i) => (
            <React.Fragment key={s.key}>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                step === s.key ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/30' :
                STEPS.indexOf(step) > i ? 'text-profit' : 'text-text-muted'
              }`}>
                {STEPS.indexOf(step) > i ? '✓ ' : ''}{s.label}
              </div>
              {i < 2 && <span className="text-text-muted">→</span>}
            </React.Fragment>
          ))}
        </div>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-6">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${
                isDragActive ? 'border-accent-blue bg-accent-blue/5' : 'border-border hover:border-accent-blue/50 hover:bg-bg-hover'
              }`}
            >
              <input {...getInputProps()} />
              <div className="text-6xl mb-4">📂</div>
              <h3 className="text-text-primary font-semibold text-lg mb-2">
                {isDragActive ? 'Suelta el archivo aquí' : 'Arrastra tu archivo de XTB'}
              </h3>
              <p className="text-text-secondary text-sm mb-4">
                o haz clic para seleccionarlo
              </p>
              <p className="text-text-muted text-xs">Formatos soportados: CSV, TXT, XLSX, XLS</p>
            </div>

            {/* How to export */}
            <div className="card">
              <h3 className="text-text-primary font-semibold mb-3">¿Cómo exportar desde XTB?</h3>
              <ol className="space-y-2 text-sm text-text-secondary">
                <li className="flex gap-2"><span className="text-accent-blue font-bold">1.</span> Inicia sesión en XTB (xStation 5 web o app)</li>
                <li className="flex gap-2"><span className="text-accent-blue font-bold">2.</span> Ve a <strong className="text-text-primary">Historial de Transacciones</strong> o <strong className="text-text-primary">Cuenta → Historial</strong></li>
                <li className="flex gap-2"><span className="text-accent-blue font-bold">3.</span> Selecciona el rango de fechas que quieres importar</li>
                <li className="flex gap-2"><span className="text-accent-blue font-bold">4.</span> Haz clic en <strong className="text-text-primary">Exportar</strong> o el icono de descarga</li>
                <li className="flex gap-2"><span className="text-accent-blue font-bold">5.</span> Elige formato <strong className="text-text-primary">CSV</strong> o <strong className="text-text-primary">Excel</strong></li>
                <li className="flex gap-2"><span className="text-accent-blue font-bold">6.</span> Arrastra el archivo descargado aquí arriba</li>
              </ol>
            </div>

            {/* Alternative: manual button */}
            <div className="text-center">
              <p className="text-text-muted text-sm mb-2">¿Prefieres añadir manualmente?</p>
              <a href="#/trades/new" className="btn-secondary inline-flex">
                + Nueva operación manual
              </a>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && parsed && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-4">
              <div className="card text-center">
                <p className="text-3xl font-bold text-text-primary font-num">{parsed.trades.length}</p>
                <p className="text-text-muted text-xs mt-1">Operaciones encontradas</p>
              </div>
              <div className="card text-center">
                <p className="text-3xl font-bold text-profit font-num">
                  {parsed.trades.filter(t => t.status === 'closed').length}
                </p>
                <p className="text-text-muted text-xs mt-1">Cerradas</p>
              </div>
              <div className="card text-center">
                <p className="text-3xl font-bold text-neutral font-num">
                  {parsed.trades.filter(t => t.status === 'open').length}
                </p>
                <p className="text-text-muted text-xs mt-1">Abiertas</p>
              </div>
              <div className="card text-center">
                <p className="text-3xl font-bold text-loss font-num">{parsed.errors.length}</p>
                <p className="text-text-muted text-xs mt-1">Errores</p>
              </div>
            </div>

            {/* Errors */}
            {parsed.errors.length > 0 && (
              <div className="card border-loss/20">
                <p className="text-loss text-sm font-semibold mb-2">⚠️ {parsed.errors.length} filas con errores (se omitirán)</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {parsed.errors.slice(0, 5).map((e, i) => (
                    <p key={i} className="text-text-muted text-xs">Fila {e.row}: {e.message}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Preview table */}
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <p className="text-text-primary font-semibold">Previsualización</p>
                <p className="text-text-muted text-xs">
                  {previewPage * PAGE_SIZE + 1}–{Math.min((previewPage + 1) * PAGE_SIZE, parsed.trades.length)} de {parsed.trades.length}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full trade-table text-xs">
                  <thead>
                    <tr>
                      <th>Símbolo</th>
                      <th>Dir.</th>
                      <th>Apertura</th>
                      <th>Cierre</th>
                      <th>Precio entrada</th>
                      <th>Precio salida</th>
                      <th>Volumen</th>
                      <th>Comisión</th>
                      <th>Estado</th>
                      <th>P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewTrades.map((t, i) => (
                      <tr key={i}>
                        <td className="font-semibold">{t.symbol}</td>
                        <td>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${t.direction === 'BUY' ? 'text-profit bg-profit/10' : 'text-loss bg-loss/10'}`}>
                            {t.direction}
                          </span>
                        </td>
                        <td className="font-num whitespace-nowrap">{t.open_time?.substring(0, 16)}</td>
                        <td className="font-num whitespace-nowrap">{t.close_time?.substring(0, 16) || <span className="text-neutral">Abierta</span>}</td>
                        <td className="font-num">{t.open_price}</td>
                        <td className="font-num">{t.close_price || '—'}</td>
                        <td className="font-num">{t.volume}</td>
                        <td className="font-num">{t.commission?.toFixed(2)}</td>
                        <td>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${t.status === 'closed' ? 'bg-bg-tertiary text-text-secondary' : 'bg-neutral/10 text-neutral'}`}>
                            {t.status === 'closed' ? 'Cerrada' : 'Abierta'}
                          </span>
                        </td>
                        <td className={`font-num font-semibold ${pnlClass(t.pnl)}`}>
                          {t.pnl !== null ? `${t.pnl >= 0 ? '+' : ''}${Number(t.pnl).toFixed(2)}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-3">
                  <button onClick={() => setPreviewPage(p => Math.max(0, p-1))} disabled={previewPage === 0}
                    className="btn-secondary py-1 px-2 text-xs disabled:opacity-40">←</button>
                  <span className="text-text-muted text-xs self-center">{previewPage + 1} / {totalPages}</span>
                  <button onClick={() => setPreviewPage(p => Math.min(totalPages-1, p+1))} disabled={previewPage === totalPages-1}
                    className="btn-secondary py-1 px-2 text-xs disabled:opacity-40">→</button>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 justify-end">
              <button onClick={reset} className="btn-secondary">← Cambiar archivo</button>
              <button onClick={handleImport} disabled={importing || parsed.trades.length === 0} className="btn-primary px-8">
                {importing ? (
                  <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Importando...</span>
                ) : (
                  `✓ Importar ${parsed.trades.length} operaciones`
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && result && (
          <div className="text-center py-16 space-y-6">
            <div className="text-8xl">🎉</div>
            <div>
              <h2 className="text-2xl font-bold text-text-primary">¡Importación completada!</h2>
              <p className="text-text-secondary mt-2">
                Se importaron <span className="text-profit font-bold font-num text-xl">{result.imported}</span> nuevas operaciones
              </p>
              {parsed.trades.length - result.imported > 0 && (
                <p className="text-text-muted text-sm mt-1">
                  {parsed.trades.length - result.imported} duplicadas omitidas
                </p>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={reset} className="btn-secondary">Importar otro archivo</button>
              <a href="#/dashboard" className="btn-primary">Ver Dashboard →</a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
