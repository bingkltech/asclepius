const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow;
let dashboardWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 250,
    height: 60,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('widget.html');
  // Optional: open devtools for debugging if needed
  // mainWindow.webContents.openDevTools({ mode: 'detach' });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

ipcMain.handle('get-status', () => {
  try {
    const statusPath = path.join(__dirname, '.hermes-status.json');
    if (fs.existsSync(statusPath)) {
      return JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
    }
    return { state: 'Offline', details: 'Waiting for Daemon...' };
  } catch (err) {
    return { state: 'Error', details: 'Unable to read status' };
  }
});

ipcMain.on('open-dashboard', () => {
  if (dashboardWindow) {
    dashboardWindow.show();
  } else {
    dashboardWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    const dashPath = path.join(__dirname, 'dist', 'index.html');
    dashboardWindow.loadURL('http://localhost:5173').catch(() => {
      // Fallback to built file if dev server is not running
      dashboardWindow.loadFile(dashPath);
    });

    dashboardWindow.on('close', (e) => {
      // Prevent actual close to keep it fast for next time, just hide
      e.preventDefault();
      dashboardWindow.hide();
      if (mainWindow) mainWindow.show();
    });
  }

  if (mainWindow) {
    mainWindow.hide();
  }
});
