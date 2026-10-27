const { BrowserWindow, session } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

function appIconPath() {
  const ico = path.join(__dirname, '..', 'build', 'icon.ico')
  const png = path.join(__dirname, '..', 'build', 'icon.png')
  if (fs.existsSync(ico)) return ico
  if (fs.existsSync(png)) return png
  return undefined
}

/** @type {Map<string, BrowserWindow>} */
const openBySlug = new Map()

function partitionFor(slug) {
  const safe = String(slug || 'app')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .slice(0, 64)
  return `persist:orion-conn-${safe || 'app'}`
}

function normalizeUrl(raw) {
  const s = String(raw || '').trim()
  if (!s) throw new Error('URL manquante')
  try {
    return new URL(s.includes('://') ? s : `https://${s}`).toString()
  } catch {
    throw new Error('URL invalide')
  }
}

function hostnameOf(raw) {
  try {
    return new URL(normalizeUrl(raw)).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * Ouvre une fenêtre de connexion isolée (cookies persistants par logiciel).
 * L’utilisateur se connecte sur le site réel ; Orion conserve la session.
 */
function openSessionLogin({ slug, url, name }, parent) {
  const target = normalizeUrl(url)
  const id = String(slug || hostnameOf(target) || 'app')
  const existing = openBySlug.get(id)
  if (existing && !existing.isDestroyed()) {
    existing.focus()
    existing.loadURL(target)
    return { ok: true, slug: id, reused: true }
  }

  const icon = appIconPath()
  const win = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 720,
    minHeight: 520,
    parent: parent && !parent.isDestroyed() ? parent : undefined,
    modal: false,
    title: name ? `Connexion · ${name}` : 'Connexion Orion',
    backgroundColor: '#0b0d12',
    autoHideMenuBar: true,
    ...(icon ? { icon } : {}),
    webPreferences: {
      partition: partitionFor(id),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  openBySlug.set(id, win)
  win.on('closed', () => {
    if (openBySlug.get(id) === win) openBySlug.delete(id)
  })

  win.loadURL(target)
  return { ok: true, slug: id, reused: false, url: target }
}

function openSessionApp({ slug, url, name }, parent) {
  return openSessionLogin({ slug, url, name }, parent)
}

async function inspectSession({ slug, url }) {
  const id = String(slug || '').trim()
  if (!id) throw new Error('slug manquant')
  const host = hostnameOf(url)
  const ses = session.fromPartition(partitionFor(id))
  const cookies = await ses.cookies.get({})
  const relevant = host
    ? cookies.filter((c) => {
        const domain = (c.domain || '').replace(/^\./, '')
        return domain === host || domain.endsWith(`.${host}`) || host.endsWith(`.${domain}`)
      })
    : cookies

  const authish = relevant.filter((c) => {
    const n = (c.name || '').toLowerCase()
    return (
      n.includes('session') ||
      n.includes('token') ||
      n.includes('auth') ||
      n.includes('sid') ||
      n.includes('jwt') ||
      n.includes('login') ||
      n.includes('csrf') ||
      n.length > 8
    )
  })

  return {
    ok: true,
    slug: id,
    host,
    cookieCount: relevant.length,
    likelySignedIn: authish.length > 0 || relevant.length >= 2,
  }
}

async function clearSession({ slug }) {
  const id = String(slug || '').trim()
  if (!id) throw new Error('slug manquant')
  const existing = openBySlug.get(id)
  if (existing && !existing.isDestroyed()) existing.close()
  const ses = session.fromPartition(partitionFor(id))
  await ses.clearStorageData()
  return { ok: true, slug: id }
}

/**
 * Fenêtre OAuth : reste ouverte jusqu’au retour sur redirectPrefix (Core local).
 */
function openOAuthWindow({ authorizeUrl, redirectPrefix }, parent) {
  const authUrl = String(authorizeUrl || '')
  const prefix = String(redirectPrefix || 'http://127.0.0.1:5175')
  if (!authUrl) return Promise.reject(new Error('authorizeUrl manquant'))

  return new Promise((resolve, reject) => {
    const icon = appIconPath()
    const win = new BrowserWindow({
      width: 980,
      height: 720,
      parent: parent && !parent.isDestroyed() ? parent : undefined,
      modal: false,
      title: 'Autorisation Orion',
      autoHideMenuBar: true,
      ...(icon ? { icon } : {}),
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })

    let settled = false
    const finish = (payload) => {
      if (settled) return
      settled = true
      if (!win.isDestroyed()) win.close()
      resolve(payload)
    }

    win.webContents.on('will-redirect', (_e, url) => {
      if (url.startsWith(prefix)) finish({ ok: true, url })
    })
    win.webContents.on('did-navigate', (_e, url) => {
      if (url.startsWith(prefix)) finish({ ok: true, url })
    })
    win.on('closed', () => {
      if (!settled) reject(new Error('Fenêtre OAuth fermée'))
    })

    win.loadURL(authUrl)
  })
}

module.exports = {
  openSessionLogin,
  openSessionApp,
  inspectSession,
  clearSession,
  openOAuthWindow,
  partitionFor,
}
