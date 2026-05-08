/**
 * widget-preload.js — Electron preload for Asclepius Widget
 *
 * Exposes only the minimum IPC surface needed by widget.html.
 * Keeps contextIsolation: true for security.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronWidget', {
  /** Tell Electron to hide the widget window */
  close: () => ipcRenderer.send('widget-close'),

  /** Tell Electron to move the window (for drag support) */
  drag: (x, y) => ipcRenderer.send('widget-drag', { x, y }),

  /** Detect that we're running inside Electron (not browser) */
  isElectron: true,
});
