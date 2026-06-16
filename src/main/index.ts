import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
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
ipcMain.handle('db:update-document-folder', async (_, id, folderName) => dbService.updateDocumentFolder(id, folderName));
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
ipcMain.handle('db:get-all-progress', async () => dbService.getAllProgress());

ipcMain.handle('db:get-history', async () => dbService.getHistory());
ipcMain.handle('db:add-history', async (_, record) => dbService.addHistoryRecord(record));

ipcMain.handle('db:get-ai-cache', async (_, hash) => dbService.getAiCache(hash));
ipcMain.handle('db:save-ai-cache', async (_, cache) => dbService.saveAiCache(cache));
ipcMain.handle('db:update-document-name', async (_, id, name) => dbService.updateDocumentName(id, name));
ipcMain.handle('db:get-provider-models', async (_, provider, apiKey) => dbService.getProviderModels(provider, apiKey));
ipcMain.handle('db:refresh-provider-models', async (_, provider, apiKey) => dbService.refreshProviderModels(provider, apiKey));
ipcMain.handle('db:update-document-content', async (_, id, content) => dbService.updateDocumentContent(id, content));

ipcMain.handle('db:get-ai-chats', async (_, fileId) => dbService.getAiChats(fileId));
ipcMain.handle('db:create-ai-chat', async (_, chatId, title, fileId) => dbService.createAiChat(chatId, title, fileId));
ipcMain.handle('db:delete-ai-chat', async (_, chatId) => dbService.deleteAiChat(chatId));
ipcMain.handle('db:get-ai-messages', async (_, chatId) => dbService.getAiMessages(chatId));
ipcMain.handle('db:add-ai-message', async (_, msg) => dbService.addAiMessage(msg));

// File Export/Sharing Handler
ipcMain.handle('files:share-export', async (_, filePaths: string[], destDir: string) => {
  try {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    for (const filePath of filePaths) {
      if (fs.existsSync(filePath)) {
        const destPath = path.join(destDir, path.basename(filePath));
        fs.copyFileSync(filePath, destPath);
      }
    }
    return true;
  } catch (err) {
    console.error('Failed to export files:', err);
    throw err;
  }
});

// Windows Explorer Native Drag-and-Drop Sharing Handler
ipcMain.handle('files:share-native', async (_, filePaths: string[]) => {
  try {
    const userDataPath = app.getPath('userData');
    const sharedDir = path.join(userDataPath, 'SharedDocs');
    if (!fs.existsSync(sharedDir)) {
      fs.mkdirSync(sharedDir, { recursive: true });
    }

    // Clear out old files first
    const existingFiles = fs.readdirSync(sharedDir);
    for (const f of existingFiles) {
      try {
        fs.unlinkSync(path.join(sharedDir, f));
      } catch (e) {
        // ignore if locked
      }
    }

    const copiedFiles: string[] = [];
    for (const filePath of filePaths) {
      if (fs.existsSync(filePath)) {
        const destPath = path.join(sharedDir, path.basename(filePath));
        fs.copyFileSync(filePath, destPath);
        copiedFiles.push(destPath);
      }
    }

    if (copiedFiles.length > 0) {
      // Highlight the first copied file in Windows Explorer
      shell.showItemInFolder(copiedFiles[0]);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Failed native share folder opening:', err);
    throw err;
  }
});

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

function scanDirectory(dirPath: string, fileList: any[] = []) {
  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        scanDirectory(filePath, fileList);
      } else {
        const ext = path.extname(file).substring(1).toLowerCase();
        const supportedExtensions = ['pdf', 'docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls', 'txt', 'md'];
        if (supportedExtensions.includes(ext)) {
          fileList.push({
            path: filePath,
            name: file,
            size: stats.size,
            type: ext,
          });
        }
      }
    }
  } catch (err) {
    console.error('Error scanning directory:', err);
  }
  return fileList;
}

ipcMain.handle('dialog:open-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  const dirPath = result.filePaths[0];
  const folderName = path.basename(dirPath);
  const files = scanDirectory(dirPath);
  return {
    folderName,
    files,
  };
});

ipcMain.handle('window:minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window:close', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.handle('window:is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});
