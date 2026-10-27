const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('orionDesktop', {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },

  /** Ouvre le site du logiciel pour s’y connecter (session isolée). */
  openSessionLogin: (input) => ipcRenderer.invoke('orion:session-login', input),

  /** Rouvre un logiciel déjà lié avec la même session. */
  openSessionApp: (input) => ipcRenderer.invoke('orion:session-open', input),

  /** Vérifie si des cookies de session existent pour ce logiciel. */
  inspectSession: (input) => ipcRenderer.invoke('orion:session-inspect', input),

  /** Efface la session locale (déconnexion desktop). */
  clearSession: (input) => ipcRenderer.invoke('orion:session-clear', input),

  /** OAuth catalogue : fenêtre dédiée puis retour vers Core. */
  openOAuthWindow: (input) => ipcRenderer.invoke('orion:oauth-window', input),
})
