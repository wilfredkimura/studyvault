import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { initDatabase, dbService } from './db';
import { pythonWorker } from './worker-manager';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: true, // Standard window controls, customized client side if needed
    titleBarStyle: 'hidden', // Make it modern: hidden native titlebar, custom HTML titlebar!
    backgroundColor: '#14121b', // Deep Obsidian color
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load React app
  // In development, load from Vite dev server. In production, load built index.html.
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialize database when app starts
app.whenReady().then(() => {
  initDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Terminate Python worker process when Electron app closes
  pythonWorker.kill();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Setup IPC database handlers
ipcMain.handle('db:get-documents', async () => dbService.getDocuments());
ipcMain.handle('db:add-document', async (_, doc) => dbService.addDocument(doc));
ipcMain.handle('db:delete-document', async (_, id) => dbService.deleteDocument(id));
ipcMain.handle('db:search-documents', async (_, query) => dbService.searchDocuments(query));

ipcMain.handle('db:get-tags', async () => dbService.getTags());
ipcMain.handle('db:add-tag', async (_, tag) => dbService.addTag(tag));
ipcMain.handle('db:tag-file', async (_, fileId, tagId) => dbService.tagFile(fileId, tagId));
ipcMain.handle('db:untag-file', async (_, fileId, tagId) => dbService.untagFile(fileId, tagId));
ipcMain.handle('db:get-file-tags', async (_, fileId) => dbService.getFileTags(fileId));

ipcMain.handle('db:get-annotations', async (_, fileId) => dbService.getAnnotations(fileId));
ipcMain.handle('db:add-annotation', async (_, anno) => dbService.addAnnotation(anno));
ipcMain.handle('db:delete-annotation', async (_, id) => dbService.deleteAnnotation(id));

ipcMain.handle('db:get-progress', async (_, fileId) => dbService.getProgress(fileId));
ipcMain.handle('db:save-progress', async (_, progress) => dbService.saveProgress(progress));

ipcMain.handle('db:get-history', async () => dbService.getHistory());
ipcMain.handle('db:add-history', async (_, record) => dbService.addHistoryRecord(record));

ipcMain.handle('db:get-ai-cache', async (_, hash) => dbService.getAiCache(hash));
ipcMain.handle('db:save-ai-cache', async (_, cache) => dbService.saveAiCache(cache));

// Setup IPC Python worker handler
ipcMain.handle('worker:run-command', async (_, command, args) => {
  return pythonWorker.sendCommand(command, args);
});

// Dialog picker for local file import
ipcMain.handle('dialog:open-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      {
        name: 'StudyVault Documents',
        extensions: ['pdf', 'docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls', 'txt', 'md'],
      },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  const filePath = result.filePaths[0];
  const stats = fs.statSync(filePath);
  return {
    path: filePath,
    name: path.basename(filePath),
    size: stats.size,
    type: path.extname(filePath).substring(1).toLowerCase(),
  };
});
