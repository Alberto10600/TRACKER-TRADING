import React, { useState, useEffect, useRef, useCallback } from 'react'

// ─── Constants ───────────────────────────────────────────────────────────────
const INSTRUMENTS = [
  { value: 'XAUUSD', label: 'XAUUSD — Gold', color: 'text-yellow-400', badge: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' },
  { value: 'US100', label: 'US100 — NASDAQ', color: 'text-accent-cyan', badge: 'bg-accent-cyan/10 border-accent-cyan/30 text-accent-cyan' },
]

const SESSIONS = [
  { value: 'asian', label: 'Asiática (00–08 UTC)' },
  { value: 'london', label: 'Londres (07–11 UTC)' },
  { value: 'newyork', label: 'Nueva York (12–17 UTC)' },
  { value: 'overlap', label: 'Overlap LDN/NY' },
]

const HTF_BIASES = [
  { value: 'bullish', label: 'Alcista (Bullish)' },
  { value: 'bearish', label: 'Bajista (Bearish)' },
  { value: 'ranging', label: 'Lateral (Ranging)' },
]

const STRUCTURES = [
  { value: 'hh_hl', label: 'HH / HL — Tendencia alcista' },
  { value: 'lh_ll', label: 'LH / LL — Tendencia bajista' },
  { value: 'choch_bull', label: 'CHoCH alcista (Cambio de carácter)' },
  { value: 'choch_bear', label: 'CHoCH bajista (Cambio de carácter)' },
  { value: 'bos_bull', label: 'BOS alcista (Ruptura de estructura)' },
  { value: 'bos_bear', label: 'BOS bajista (Ruptura de estructura)' },
]

// ─── Markdown renderer (lightweight) ────────────────────────────────────────
function renderMarkdown(text) {
  const lines = text.split('\n')
  const result = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // H1
    if (line.startsWith('# ')) {
      result.push(<h1 key={i} className="text-lg font-bold text-text-primary mt-3 mb-1">{parseInline(line.slice(2))}</h1>)
    }
    // H2
    else if (line.startsWith('## ')) {
      result.push(<h2 key={i} className="text-base font-semibold text-accent-blue mt-3 mb-1 border-b border-border pb-1">{parseInline(line.slice(3))}</h2>)
    }
    // H3
    else if (line.startsWith('### ')) {
      result.push(<h3 key={i} className="text-sm font-semibold text-text-primary mt-2 mb-0.5">{parseInline(line.slice(4))}</h3>)
    }
    // Bullet list
    else if (line.match(/^[-*] /)) {
      result.push(
        <div key={i} className="flex gap-2 text-sm text-text-secondary my-0.5">
          <span className="text-accent-blue flex-shrink-0 mt-0.5">•</span>
          <span>{parseInline(line.slice(2))}</span>
        </div>
      )
    }
    // Numbered list
    else if (line.match(/^\d+\. /)) {
      const content = line.replace(/^\d+\. /, '')
      const num = line.match(/^(\d+)\./)[1]
      result.push(
        <div key={i} className="flex gap-2 text-sm text-text-secondary my-0.5">
          <span className="text-accent-blue flex-shrink-0 font-mono w-4">{num}.</span>
          <span>{parseInline(content)}</span>
        </div>
      )
    }
    // Horizontal rule
    else if (line === '---' || line === '***') {
      result.push(<hr key={i} className="border-border my-3" />)
    }
    // Empty line
    else if (line.trim() === '') {
      result.push(<div key={i} className="h-1.5" />)
    }
    // Regular paragraph
    else {
      result.push(<p key={i} className="text-sm text-text-secondary leading-relaxed">{parseInline(line)}</p>)
    }
    i++
  }

  return result
}

function parseInline(text) {
  // Parse **bold**, *italic*, `code`, and special bias keywords
  const parts = []
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g
  let last = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(colorizeText(text.slice(last, match.index)))
    }
    if (match[2]) {
      // Bold
      parts.push(<strong key={match.index} className="text-text-primary font-semibold">{match[2]}</strong>)
    } else if (match[3]) {
      // Italic
      parts.push(<em key={match.index} className="text-text-secondary italic">{match[3]}</em>)
    } else if (match[4]) {
      // Code
      parts.push(<code key={match.index} className="bg-bg-tertiary text-accent-cyan font-mono text-xs px-1.5 py-0.5 rounded">{match[4]}</code>)
    }
    last = match.index + match[0].length
  }

  if (last < text.length) {
    parts.push(colorizeText(text.slice(last)))
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts
}

function colorizeText(text) {
  // Highlight bias keywords
  if (text.includes('BULLISH') || text.includes('Bullish') || text.includes('BUY')) {
    return <span className="text-profit font-medium">{text}</span>
  }
  if (text.includes('BEARISH') || text.includes('Bearish') || text.includes('SELL')) {
    return <span className="text-loss font-medium">{text}</span>
  }
  if (text.includes('NEUTRAL') || text.includes('Neutral')) {
    return <span className="text-yellow-400 font-medium">{text}</span>
  }
  return text
}

// ─── Message bubble ──────────────────────────────────────────────────────────
function MessageBubble({ message }) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%] bg-accent-blue/15 border border-accent-blue/25 rounded-xl rounded-tr-sm px-4 py-3">
          <p className="text-sm text-text-primary whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500/30 to-accent-cyan/30 border border-yellow-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <IconBrain className="w-4 h-4 text-yellow-400" />
      </div>
      <div className="flex-1 max-w-[92%] bg-bg-secondary border border-border rounded-xl rounded-tl-sm px-4 py-3 space-y-0.5">
        {message.isStreaming ? (
          <>
            {renderMarkdown(message.content)}
            <span className="inline-block w-1.5 h-4 bg-accent-blue/80 animate-pulse ml-0.5 rounded-sm" />
          </>
        ) : (
          renderMarkdown(message.content)
        )}
        {message.error && (
          <p className="text-loss text-xs mt-2 p-2 bg-loss/10 rounded border border-loss/20">{message.error}</p>
        )}
      </div>
    </div>
  )
}

// ─── Context form ────────────────────────────────────────────────────────────
function ContextPanel({ instrument, ctx, setCtx, onAnalyze, loading }) {
  const inst = INSTRUMENTS.find(i => i.value === instrument)

  function buildPrompt() {
    const lines = [`Analiza ${instrument} y dame el bias + setup de entrada.`]
    if (ctx.currentPrice) lines.push(`Precio actual: ${ctx.currentPrice}`)
    if (ctx.session) {
      const s = SESSIONS.find(s => s.value === ctx.session)
      if (s) lines.push(`Sesión: ${s.label}`)
    }
    if (ctx.htfBias) {
      const h = HTF_BIASES.find(h => h.value === ctx.htfBias)
      if (h) lines.push(`Bias HTF (diario/semanal): ${h.label}`)
    }
    if (ctx.structure) {
      const s = STRUCTURES.find(s => s.value === ctx.structure)
      if (s) lines.push(`Estructura actual: ${s.label}`)
    }
    if (ctx.keyLevels) lines.push(`Niveles clave que observo:\n${ctx.keyLevels}`)
    if (ctx.notes) lines.push(`Notas adicionales:\n${ctx.notes}`)
    return lines.join('\n')
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-text-muted text-xs block mb-1">Precio Actual</label>
        <input
          type="number"
          step="any"
          placeholder={instrument === 'XAUUSD' ? '2380.00' : '18500.0'}
          className="input w-full font-mono text-sm"
          value={ctx.currentPrice}
          onChange={e => setCtx(p => ({ ...p, currentPrice: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-text-muted text-xs block mb-1">Sesión</label>
          <select className="input w-full text-sm" value={ctx.session} onChange={e => setCtx(p => ({ ...p, session: e.target.value }))}>
            <option value="">— Selecciona —</option>
            {SESSIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-text-muted text-xs block mb-1">Bias HTF</label>
          <select className="input w-full text-sm" value={ctx.htfBias} onChange={e => setCtx(p => ({ ...p, htfBias: e.target.value }))}>
            <option value="">— Selecciona —</option>
            {HTF_BIASES.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-text-muted text-xs block mb-1">Estructura de mercado</label>
        <select className="input w-full text-sm" value={ctx.structure} onChange={e => setCtx(p => ({ ...p, structure: e.target.value }))}>
          <option value="">— Selecciona —</option>
          {STRUCTURES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div>
        <label className="text-text-muted text-xs block mb-1">Niveles clave (OBs, FVGs, S/R)</label>
        <textarea
          rows={3}
          placeholder={`Ej:\nResistencia: ${instrument === 'XAUUSD' ? '2395' : '18650'}\nSoporte OB: ${instrument === 'XAUUSD' ? '2355-2358' : '18200-18220'}\nFVG: ${instrument === 'XAUUSD' ? '2362-2368' : '18350-18380'}`}
          className="input w-full text-sm resize-none font-mono"
          value={ctx.keyLevels}
          onChange={e => setCtx(p => ({ ...p, keyLevels: e.target.value }))}
        />
      </div>

      <div>
        <label className="text-text-muted text-xs block mb-1">Notas adicionales</label>
        <textarea
          rows={2}
          placeholder="Noticias pendientes, contexto macro, observaciones..."
          className="input w-full text-sm resize-none"
          value={ctx.notes}
          onChange={e => setCtx(p => ({ ...p, notes: e.target.value }))}
        />
      </div>

      <button
        onClick={() => onAnalyze(buildPrompt())}
        disabled={loading}
        className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Analizando...
          </>
        ) : (
          <>
            <IconBrain className="w-4 h-4" />
            Analizar con IA
          </>
        )}
      </button>
    </div>
  )
}

// ─── API Key setup panel ─────────────────────────────────────────────────────
function ApiKeySetup({ onSave }) {
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!key.trim()) return
    setSaving(true)
    await window.api?.claude?.saveKey(key.trim())
    onSave(key.trim())
    setSaving(false)
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-accent-cyan/20 border border-yellow-500/20 flex items-center justify-center mx-auto mb-4">
            <IconBrain className="w-8 h-8 text-yellow-400" />
          </div>
          <h2 className="text-xl font-bold text-text-primary">Analista de Trading con IA</h2>
          <p className="text-text-secondary text-sm mt-2">
            Especializado en <span className="text-yellow-400 font-medium">XAUUSD (Gold)</span> y <span className="text-accent-cyan font-medium">US100 (NASDAQ)</span>
          </p>
          <p className="text-text-muted text-xs mt-1">
            Powered by Claude con metodología ICT / Smart Money Concepts
          </p>
        </div>

        <div className="card space-y-4">
          <div>
            <label className="text-text-muted text-xs block mb-1.5">API Key de Anthropic</label>
            <input
              type="password"
              placeholder="sk-ant-api03-..."
              className="input w-full font-mono text-sm"
              value={key}
              onChange={e => setKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
            <p className="text-text-muted text-xs mt-1.5">
              Obtén tu API key en{' '}
              <button
                onClick={() => window.api?.shell?.openExternal('https://console.anthropic.com/account/keys')}
                className="text-accent-blue hover:underline"
              >
                console.anthropic.com
              </button>
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={!key.trim() || saving}
            className="btn-primary w-full py-2.5 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar y continuar'}
          </button>
        </div>

        <div className="card space-y-2 border-border/50">
          <p className="text-text-muted text-xs font-medium uppercase tracking-wider">Capacidades del analista</p>
          <Feature text="Bias de mercado (Bullish/Bearish) con razonamiento ICT" />
          <Feature text="Order Blocks, FVGs y zonas de liquidez" />
          <Feature text="Zonas de entrada óptimas (OTE, Breaker Blocks)" />
          <Feature text="Stop Loss y Take Profit con R:R" />
          <Feature text="Análisis por sesión (London, NY, Asian)" />
          <Feature text="Chat interactivo para seguimiento en tiempo real" />
        </div>
      </div>
    </div>
  )
}

function Feature({ text }) {
  return (
    <div className="flex items-start gap-2 text-xs text-text-secondary">
      <span className="text-profit mt-0.5 flex-shrink-0">✓</span>
      <span>{text}</span>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function TradingAnalyst() {
  const [apiKey, setApiKey] = useState(null)
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false)
  const [instrument, setInstrument] = useState('XAUUSD')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showContext, setShowContext] = useState(true)
  const [ctx, setCtx] = useState({
    currentPrice: '',
    session: '',
    htfBias: '',
    structure: '',
    keyLevels: '',
    notes: '',
  })

  const chatEndRef = useRef(null)
  const inputRef = useRef(null)
  const streamingIdRef = useRef(null)

  // Load API key on mount
  useEffect(() => {
    window.api?.claude?.getKey().then(key => {
      setApiKey(key || null)
      setApiKeyLoaded(true)
    }) ?? setApiKeyLoaded(true)
  }, [])

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Clean up IPC listeners on unmount
  useEffect(() => {
    return () => window.api?.claude?.removeChunkListeners()
  }, [])

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || loading || !apiKey) return

    const userMsg = { role: 'user', content: text.trim(), id: Date.now() }
    const assistantId = Date.now() + 1
    streamingIdRef.current = assistantId

    setMessages(prev => [...prev, userMsg, {
      role: 'assistant', content: '', id: assistantId, isStreaming: true
    }])
    setInput('')
    setLoading(true)

    // Remove old listeners and add new one
    window.api?.claude?.removeChunkListeners()
    window.api?.claude?.onChunk(({ type, content, message }) => {
      if (type === 'text') {
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: m.content + content } : m
        ))
      } else if (type === 'done') {
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, isStreaming: false } : m
        ))
        setLoading(false)
      } else if (type === 'error') {
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, isStreaming: false, error: message || 'Error desconocido' } : m
        ))
        setLoading(false)
      }
    })

    // Build conversation history for API (exclude streaming placeholder)
    const history = messages
      .filter(m => !m.isStreaming)
      .map(m => ({ role: m.role, content: m.content }))
    history.push({ role: 'user', content: text.trim() })

    await window.api?.claude?.analyze({
      apiKey,
      instrument,
      messages: history,
    })
  }, [loading, apiKey, messages, instrument])

  function handleInstrumentChange(val) {
    setInstrument(val)
    setCtx({ currentPrice: '', session: '', htfBias: '', structure: '', keyLevels: '', notes: '' })
  }

  function clearChat() {
    setMessages([])
    window.api?.claude?.removeChunkListeners()
    setLoading(false)
  }

  // Show loading state while key loads
  if (!apiKeyLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
      </div>
    )
  }

  // Show setup if no key
  if (!apiKey) {
    return <ApiKeySetup onSave={(key) => setApiKey(key)} />
  }

  const currentInst = INSTRUMENTS.find(i => i.value === instrument)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-bg-secondary flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500/20 to-accent-cyan/20 border border-yellow-500/20 flex items-center justify-center">
            <IconBrain className="w-4 h-4 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-text-primary font-semibold text-sm">Analista de Trading IA</h1>
            <p className="text-text-muted text-xs">ICT / Smart Money Concepts</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Instrument selector */}
          <div className="flex gap-1 bg-bg-tertiary border border-border rounded-lg p-0.5">
            {INSTRUMENTS.map(inst => (
              <button
                key={inst.value}
                onClick={() => handleInstrumentChange(inst.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  instrument === inst.value
                    ? `${inst.badge} border`
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {inst.value}
              </button>
            ))}
          </div>

          {/* Toggle context panel */}
          <button
            onClick={() => setShowContext(p => !p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${
              showContext
                ? 'bg-accent-blue/10 border-accent-blue/30 text-accent-blue'
                : 'border-border text-text-muted hover:text-text-secondary'
            }`}
          >
            <IconForm className="w-3.5 h-3.5" />
            Contexto
          </button>

          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border text-text-muted hover:text-loss hover:border-loss/30 transition-all"
            >
              <IconTrash className="w-3.5 h-3.5" />
              Limpiar
            </button>
          )}

          <button
            onClick={() => setApiKey(null)}
            className="px-2 py-1.5 rounded-lg text-xs border border-border text-text-muted hover:text-text-secondary transition-all"
            title="Cambiar API key"
          >
            <IconKey className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Context panel */}
        {showContext && (
          <div className="w-72 flex-shrink-0 border-r border-border bg-bg-secondary overflow-y-auto">
            <div className="p-4 space-y-4">
              <div>
                <p className="text-text-muted text-xs uppercase tracking-wider font-medium mb-3">
                  Contexto del mercado
                </p>
                <ContextPanel
                  instrument={instrument}
                  ctx={ctx}
                  setCtx={setCtx}
                  onAnalyze={sendMessage}
                  loading={loading}
                />
              </div>

              <div className="pt-3 border-t border-border">
                <p className="text-text-muted text-xs uppercase tracking-wider font-medium mb-2">
                  Guía rápida
                </p>
                <div className="space-y-1.5 text-xs text-text-muted">
                  <p><span className="text-accent-blue">OB</span> — Order Block: última vela antes de un movimiento impulsivo</p>
                  <p><span className="text-accent-blue">FVG</span> — Fair Value Gap: imbalance entre 3 velas</p>
                  <p><span className="text-accent-blue">CHoCH</span> — Cambio de carácter (posible reversión)</p>
                  <p><span className="text-accent-blue">BOS</span> — Break of Structure (continuación)</p>
                  <p><span className="text-accent-blue">OTE</span> — Entrada óptima: 61.8–79% Fibonacci</p>
                  <p><span className="text-accent-blue">Liquidez</span> — Máximos/mínimos iguales, stops acumulados</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chat area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5">
            {messages.length === 0 ? (
              <EmptyState instrument={instrument} currentInst={currentInst} onSend={sendMessage} loading={loading} />
            ) : (
              <>
                {messages.map(msg => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                <div ref={chatEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border p-4 bg-bg-secondary flex-shrink-0">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                rows={2}
                placeholder={`Pregunta sobre ${instrument}... (Ej: "¿Hay un order block en 2350?", "¿Cuál es el setup para la sesión de NY?")`}
                className="input flex-1 text-sm resize-none"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage(input)
                  }
                }}
                disabled={loading}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                className="btn-primary px-4 self-end rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <IconSend className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-text-muted text-xs mt-1.5">
              Enter para enviar · Shift+Enter para nueva línea ·{' '}
              <span className={currentInst.color}>{instrument}</span> activo
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyState({ instrument, currentInst, onSend, loading }) {
  const suggestions = instrument === 'XAUUSD'
    ? [
        'Dame el bias de Gold para hoy y el mejor setup de entrada',
        '¿Hay algún order block relevante en Gold en este momento?',
        'Analiza la estructura de mercado de XAUUSD en H4',
        '¿Qué esperar de Gold en la sesión de Nueva York?',
      ]
    : [
        'Dame el bias de US100 para hoy y el mejor setup de entrada',
        '¿Cuál es la estructura de mercado actual del NASDAQ?',
        'Identifica los niveles de liquidez clave en US100',
        '¿Hay algún FVG relevante en US100 que deba tener en cuenta?',
      ]

  return (
    <div className="flex flex-col items-center justify-center h-full py-10 space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500/10 to-accent-cyan/10 border border-yellow-500/20 flex items-center justify-center mx-auto mb-4">
          <IconBrain className="w-8 h-8 text-yellow-400" />
        </div>
        <h3 className="text-text-primary font-semibold">Analista listo</h3>
        <p className="text-text-muted text-sm mt-1">
          Rellena el contexto del mercado o pregunta directamente
        </p>
      </div>

      <div className="w-full max-w-xl space-y-2">
        <p className="text-text-muted text-xs uppercase tracking-wider text-center mb-3">Sugerencias para {instrument}</p>
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => onSend(s)}
            disabled={loading}
            className="w-full text-left px-4 py-2.5 rounded-lg border border-border bg-bg-secondary hover:border-accent-blue/30 hover:bg-accent-blue/5 transition-all text-sm text-text-secondary hover:text-text-primary disabled:opacity-50"
          >
            "{s}"
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Icons ───────────────────────────────────────────────────────────────────
function IconBrain({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
    </svg>
  )
}

function IconSend({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
    </svg>
  )
}

function IconTrash({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  )
}

function IconKey({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 0 1 21.75 8.25Z" />
    </svg>
  )
}

function IconForm({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  )
}
