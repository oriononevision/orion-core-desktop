const { app, BrowserWindow, shell, ipcMain } = require('electron')
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const {
  openSessionLogin,
  openSessionApp,
  inspectSession,
  clearSession,
  openOAuthWindow,
} = require('./sessionLogin.cjs')

/** Port fixe = mêmes origines Google / Supabase qu’en dev. */
const DESKTOP_PORT = 5175
const DEV_URL = `http://127.0.0.1:${DESKTOP_PORT}`

let mainWindow = null
let staticServer = null

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
}

function distDir() {
  return path.join(__dirname, '..', 'dist')
}

function startStaticServer() {
  const root = distDir()
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url || '/', `http://127.0.0.1:${DESKTOP_PORT}`)
        let rel = decodeURIComponent(url.pathname)
        if (rel === '/') rel = '/index.html'
        let filePath = path.normalize(path.join(root, rel))
        if (!filePath.startsWith(root)) {
          res.writeHead(403)
          res.end()
          return
        }
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          filePath = path.join(root, 'index.html')
        }
        const ext = path.extname(filePath).toLowerCase()
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
        fs.createReadStream(filePath).pipe(res)
      } catch (err) {
        res.writeHead(500)
        res.end(String(err))
      }
    })

    server.once('error', reject)
    server.listen(DESKTOP_PORT, '127.0.0.1', () => {
      staticServer = server
      resolve(`http://127.0.0.1:${DESKTOP_PORT}`)
    })
  })
}

async function resolveAppUrl() {
  if (app.isPackaged || process.env.ORION_DESKTOP_USE_DIST === '1') {
    return startStaticServer()
  }
  return DEV_URL
}

function appIconPath() {
  const ico = path.join(__dirname, '..', 'build', 'icon.ico')
  const png = path.join(__dirname, '..', 'build', 'icon.png')
  if (fs.existsSync(ico)) return ico
  if (fs.existsSync(png)) return png
  return undefined
}

function createWindow(appUrl) {
  const icon = appIconPath()
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'ORION Core',
    backgroundColor: '#07080c',
    show: false,
    autoHideMenuBar: true,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Liens OAuth / externes : navigateur système sauf localhost Core
    if (url.startsWith('http://127.0.0.1:') || url.startsWith('http://localhost:')) {
      return { action: 'allow' }
    }
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.loadURL(appUrl)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function registerIpc() {
  ipcMain.handle('orion:session-login', async (_e, input) => {
    return openSessionLogin(input || {}, mainWindow)
  })
  ipcMain.handle('orion:session-open', async (_e, input) => {
    return openSessionApp(input || {}, mainWindow)
  })
  ipcMain.handle('orion:session-inspect', async (_e, input) => {
    return inspectSession(input || {})
  })
  ipcMain.handle('orion:session-clear', async (_e, input) => {
    return clearSession(input || {})
  })
  ipcMain.handle('orion:oauth-window', async (_e, input) => {
    return openOAuthWindow(input || {}, mainWindow)
  })
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.orion.core.desktop')
  }
  registerIpc()
  const appUrl = await resolveAppUrl()
  createWindow(appUrl)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(appUrl)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  if (staticServer) {
    staticServer.close()
    staticServer = null
  }
})

app.commandLine.appendSwitch('disable-features', 'OutdatedNoneFieldRejection')
