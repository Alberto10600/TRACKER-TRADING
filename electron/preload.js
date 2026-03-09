const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Trades
  trades: {
    getAll: (filters) => ipcRenderer.invoke('trades:getAll', filters),
    getById: (id) => ipcRenderer.invoke('trades:getById', id),
    create: (data) => ipcRenderer.invoke('trades:create', data),
    update: (data) => ipcRenderer.invoke('trades:update', data),
    delete: (id) => ipcRenderer.invoke('trades:delete', id),
    bulkImport: (trades) => ipcRenderer.invoke('trades:bulkImport', trades),
  },
  // Images
  images: {
    save: (data) => ipcRenderer.invoke('images:save', data),
    delete: (id) => ipcRenderer.invoke('images:delete', id),
    getPath: (filename) => ipcRenderer.invoke('images:getPath', filename),
  },
  // Stats
  stats: {
    getSummary: (filters) => ipcRenderer.invoke('stats:getSummary', filters),
    getEmotionAnalysis: (filters) => ipcRenderer.invoke('stats:getEmotionAnalysis', filters),
    getDailyLoss: () => ipcRenderer.invoke('stats:getDailyLoss'),
  },
  // Account
  account: {
    get: () => ipcRenderer.invoke('account:get'),
    update: (data) => ipcRenderer.invoke('account:update', data),
  },
  // Setups
  setups: {
    getAll: () => ipcRenderer.invoke('setups:getAll'),
    create: (data) => ipcRenderer.invoke('setups:create', data),
  },
  // Daily Notes
  dailyNotes: {
    get: (date) => ipcRenderer.invoke('dailyNotes:get', date),
    save: (data) => ipcRenderer.invoke('dailyNotes:save', data),
  },
  // Goals
  goals: {
    get: () => ipcRenderer.invoke('goals:get'),
    update: (data) => ipcRenderer.invoke('goals:update', data),
    save: (data) => ipcRenderer.invoke('goals:save', data),
  },
  // Export
  export: {
    csv: (filters) => ipcRenderer.invoke('export:csv', filters),
  },
  // Daily stats
  stats_extra: {
    getDailyPnl: (date) => ipcRenderer.invoke('stats:getDailyPnl', date),
  },
  // Dialogs
  dialog: {
    openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
    openImage: () => ipcRenderer.invoke('dialog:openImage'),
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
  },
  claude: {
    getKey: () => ipcRenderer.invoke('claude:getKey'),
    saveKey: (key) => ipcRenderer.invoke('claude:saveKey', key),
    analyze: (payload) => ipcRenderer.invoke('claude:analyze', payload),
    onChunk: (callback) => ipcRenderer.on('claude:chunk', (_, data) => callback(data)),
    removeChunkListeners: () => ipcRenderer.removeAllListeners('claude:chunk'),
  },
})
