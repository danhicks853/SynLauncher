const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const functions = require('./functions');
const constants = require('./constants');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false, // Remove OS window frame
    titleBarStyle: 'hidden', // Hide default title bar
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  mainWindow.setMenuBarVisibility(false); // Hide menu bar
  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  functions.ensureConfigDir();
  createWindow();
});

ipcMain.handle('close-window', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.close();
});

ipcMain.handle('check-config', () => {
  return functions.configExists();
});

ipcMain.handle('save-config', (event, config) => {
  functions.saveConfig(config);
  return true;
});

ipcMain.handle('get-constants', () => {
  return constants;
});

ipcMain.handle('load-config', () => {
  return functions.loadConfig();
});

// Download logic (webtorrent) handled in renderer for simplicity

const { getPatchDownloadLink } = require('./patch_scraper');
const { extractClient } = require('./functions');
const fs = require('fs');

const { spawn } = require('child_process');
ipcMain.handle('launch-wowext', async (event, clientDir) => {
  const path = require('path');
  const fs = require('fs');
  const exePath = path.join(clientDir, 'wowext.exe');
  if (!fs.existsSync(exePath)) {
    return { success: false, message: 'wowext.exe not found in ' + clientDir };
  }
  try {
    spawn(exePath, [], {
      cwd: clientDir,
      detached: true,
      stdio: 'ignore'
    }).unref();
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('download-and-install-patch', async (event, clientDir) => {
  const { BrowserWindow } = require('electron');
  const path = require('path');
  let patchWin = null;
  try {
    const patchUrl = await getPatchDownloadLink();
    if (!patchUrl || typeof patchUrl !== 'string' || !patchUrl.startsWith('http')) {
      console.error('Invalid patch URL:', patchUrl);
      return { success: false, message: 'Failed to find a valid patch download link.' };
    }
    console.log('Patch download URL:', patchUrl);
    patchWin = new BrowserWindow({
      width: 900,
      height: 700,
      modal: true,
      parent: BrowserWindow.getFocusedWindow(),
      webPreferences: { nodeIntegration: false }
    });
    patchWin.setMenuBarVisibility(false);
    patchWin.loadURL(patchUrl);
    return await new Promise((resolve) => {
      patchWin.webContents.session.on('will-download', (event, item) => {
        const fileName = item.getFilename();
        const savePath = path.join(clientDir, fileName);
        item.setSavePath(savePath);
        item.once('done', async (e, state) => {
          if (state === 'completed') {
            try {
              await extractClient(savePath, clientDir);
              // Save patch version to config
              const { extractPatchVersion } = require('./functions');
              const config = functions.loadConfig() || {};
              const patchVersion = extractPatchVersion(savePath);
              if (patchVersion) {
                config.patchVersion = patchVersion;
                functions.saveConfig(config);
              }
              fs.unlinkSync(savePath);
              resolve({ success: true, message: 'Patch installed! Ready to launch Synastria.' });
            } catch (err) {
              resolve({ success: false, message: 'Patch extraction failed: ' + err.message });
            }
          } else {
            resolve({ success: false, message: 'Patch download failed.' });
          }
          if (patchWin) {
            patchWin.close();
            patchWin = null;
          }
        });
      });
    });
  } catch (err) {
    if (patchWin) {
      patchWin.close();
      patchWin = null;
    }
    return { success: false, message: 'Error downloading patch: ' + err.message };
  }
});

ipcMain.handle('validate-wow-dir', (event, dir) => {
  return functions.isValidWoWDir(dir);
});

ipcMain.handle('select-directory', async (event) => {
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory']
  });
  return result.filePaths;
});
