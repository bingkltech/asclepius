/**
 * widget-electron.js — Asclepius Global Desktop Widget
 *
 * Creates a frameless, always-on-top, click-through-background Electron window
 * that sits over all other applications. Loads widget.html from the running
 * Vite dev server (localhost:5174) so it reads live localStorage state.
 *
 * LAUNCH: npx electron widget-electron.js
 * REQUIRES: Asclepius dev server running (npm run dev)
 */

const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────
const WIDGET_WIDTH  = 320;
const WIDGET_HEIGHT = 480;
const MARGIN        = 20;          // Distance from screen edge
const CORNER        = 'top-right'; // 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
const DEV_SERVER    = 'http://localhost:5174/widget.html';

// ── Globals ───────────────────────────────────────────────────────
let win   = null;
let tray  = null;
let isDragging = false;

// ── Position helper ────────────────────────────────────────────────
function getWidgetPosition() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const corners = {
    'top-right':    { x: sw - WIDGET_WIDTH - MARGIN,  y: MARGIN },
    'top-left':     { x: MARGIN,                       y: MARGIN },
    'bottom-right': { x: sw - WIDGET_WIDTH - MARGIN,  y: sh - WIDGET_HEIGHT - MARGIN },
    'bottom-left':  { x: MARGIN,                       y: sh - WIDGET_HEIGHT - MARGIN },
  };
  return corners[CORNER] || corners['top-right'];
}

// ── Create window ──────────────────────────────────────────────────
function createWidget() {
  const pos = getWidgetPosition();

  win = new BrowserWindow({
    width:           WIDGET_WIDTH,
    height:          WIDGET_HEIGHT,
    x:               pos.x,
    y:               pos.y,
    frame:           false,        // No title bar / chrome
    transparent:     true,         // Allow rounded corners to show desktop
    alwaysOnTop:     true,         // Float above all windows
    skipTaskbar:     true,         // Don't appear in taskbar
    resizable:       false,
    hasShadow:       false,
    type:            'toolbar',    // Windows: stays above other apps
    focusable:       true,         // Allow click-to-interact
    webPreferences: {
      nodeIntegration:     false,
      contextIsolation:    true,
      preload:             path.join(__dirname, 'widget-preload.cjs'),
    },
  });

  // Set always-on-top level — 'screen-saver' is the highest level on Windows
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Load the widget UI from the running dev server
  win.loadURL(DEV_SERVER).catch(() => {
    // Fallback: load local file if server isn't running
    win.loadFile(path.join(__dirname, 'widget.html'));
  });

  // Allow dragging by holding Alt + drag (since frame is hidden)
  win.on('closed', () => { win = null; });

  // Dev tools — remove in production
  // win.webContents.openDevTools({ mode: 'detach' });
}

// ── Tray icon (system tray for show/hide/quit) ─────────────────────
function createTray() {
  // Inline 16x16 purple zap icon as base64 PNG
  const iconBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlz' +
    'AAALEwAACxMBAJqcGAAAAVlJREFUOI2lkz1LA0EQhp/duyQXSCBgJYKFoI2FhY2FjYWFYGFh' +
    'YWFhIVhYiIWFhYWFhYUQMJADI4IQIQkhJLl8bHZn9seLuSMhSSAfsMww8+47+84KIQRCCDzP' +
    'w/d9lFJorTHGYK1FKYVSCq01xhiMMVhrsdainEMphXMO5xzOOZxzOOdwzuGcwzmHcw7nHM45' +
    'nHM453DO4ZzDOYdzDuccxhiMMTjnUEqhtcYYg7UWpRRKKbTWGGOMtRZjDNZarLVYa7HWYq3F' +
    'Wou1Fmst1lqstVhrstZircVai7UWay3WWqy1WGux1mKtxVqLtRZrLdZarLVYa7HWYq3FWou1' +
    'Fmst1lqstVhrsRZrLdZarLVYa7HWYq3FWou1Fmst1lqstVhrsRZrLdZarLVYa7HW+gd+AAAA' +
    '//8DAFBLAwQUAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

  try {
    const img = nativeImage.createFromDataURL('data:image/png;base64,' + iconBase64);
    tray = new Tray(img.resize({ width: 16, height: 16 }));
  } catch {
    tray = new Tray(nativeImage.createEmpty());
  }

  tray.setToolTip('Asclepius Widget');

  const menu = Menu.buildFromTemplate([
    {
      label: 'Asclepius · God-Agent v3',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Show Widget',
      click: () => win && win.show(),
    },
    {
      label: 'Hide Widget',
      click: () => win && win.hide(),
    },
    { type: 'separator' },
    {
      label: 'Move to Top-Right',
      click: () => moveWidget('top-right'),
    },
    {
      label: 'Move to Top-Left',
      click: () => moveWidget('top-left'),
    },
    {
      label: 'Move to Bottom-Right',
      click: () => moveWidget('bottom-right'),
    },
    {
      label: 'Move to Bottom-Left',
      click: () => moveWidget('bottom-left'),
    },
    { type: 'separator' },
    {
      label: 'Open Full Dashboard',
      click: () => require('electron').shell.openExternal('http://localhost:5174/'),
    },
    { type: 'separator' },
    {
      label: 'Quit Widget',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(menu);
  tray.on('double-click', () => win && (win.isVisible() ? win.hide() : win.show()));
}

function moveWidget(corner) {
  if (!win) return;
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const positions = {
    'top-right':    { x: sw - WIDGET_WIDTH - MARGIN,  y: MARGIN },
    'top-left':     { x: MARGIN,                       y: MARGIN },
    'bottom-right': { x: sw - WIDGET_WIDTH - MARGIN,  y: sh - WIDGET_HEIGHT - MARGIN },
    'bottom-left':  { x: MARGIN,                       y: sh - WIDGET_HEIGHT - MARGIN },
  };
  const pos = positions[corner] || positions['top-right'];
  win.setPosition(pos.x, pos.y, true);
}

// ── App lifecycle ──────────────────────────────────────────────────
app.whenReady().then(() => {
  // Hide from dock (macOS) / prevent showing empty taskbar button
  if (app.dock) app.dock.hide();

  createWidget();
  createTray();
});

app.on('window-all-closed', () => {
  // Don't quit when all windows close — tray keeps it alive
  // User must explicitly quit via tray menu
});

app.on('activate', () => {
  if (!win) createWidget();
});

// ── IPC: handle close button click from widget UI ──────────────────
ipcMain.on('widget-close', () => win && win.hide());
ipcMain.on('widget-drag', (_e, { x, y }) => win && win.setPosition(x, y));
