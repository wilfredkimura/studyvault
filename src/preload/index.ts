import { contextBridge, ipcRenderer } from 'electron';

export interface StudyVaultAPI {
  // Document Operations
  getDocuments: () => Promise<any[]>;
  addDocument: (doc: any) => Promise<any>;
  updateDocumentFolder: (id: string, folderName: string | null) => Promise<any>;
  updateDocumentName: (id: string, name: string) => Promise<any>;
  deleteDocument: (id: string) => Promise<any>;
  searchDocuments: (query: string) => Promise<any[]>;

  // Tag Operations
  getTags: () => Promise<any[]>;
  addTag: (tag: { id: string; name: string; color: string }) => Promise<any>;
  tagFile: (fileId: string, tagId: string) => Promise<any>;
  untagFile: (fileId: string, tagId: string) => Promise<any>;
  getFileTags: (fileId: string) => Promise<any[]>;

  // Annotations, notes & highlights
  getAnnotations: (fileId: string) => Promise<any[]>;
  addAnnotation: (anno: any) => Promise<any>;
  deleteAnnotation: (id: string) => Promise<any>;

  // Reading progress
  getProgress: (fileId: string) => Promise<any>;
  saveProgress: (progress: { file_id: string; last_page: number; scroll_position: number }) => Promise<any>;

  // Conversion History
  getHistory: () => Promise<any[]>;
  addHistory: (record: any) => Promise<any>;

  // AI Response Cache
  getAiCache: (hash: string) => Promise<any>;
  saveAiCache: (cache: { id: string; input_hash: string; response: string; model: string }) => Promise<any>;

  // Worker commands (OCR, Conversion, AI pipeline)
  runWorkerCommand: (command: string, args: any) => Promise<any>;

  // Shell & Dialog functions
  openFileDialog: () => Promise<{ path: string; name: string; size: number; type: string } | null>;
  openDirectoryDialog: () => Promise<{ folderName: string; files: any[] } | null>;

  // Window Controls
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  isWindowMaximized: () => Promise<boolean>;
}

const api: StudyVaultAPI = {
  // Documents
  getDocuments: () => ipcRenderer.invoke('db:get-documents'),
  addDocument: (doc) => ipcRenderer.invoke('db:add-document', doc),
  updateDocumentFolder: (id, folderName) => ipcRenderer.invoke('db:update-document-folder', id, folderName),
  updateDocumentName: (id, name) => ipcRenderer.invoke('db:update-document-name', id, name),
  deleteDocument: (id) => ipcRenderer.invoke('db:delete-document', id),
  searchDocuments: (query) => ipcRenderer.invoke('db:search-documents', query),

  // Tags
  getTags: () => ipcRenderer.invoke('db:get-tags'),
  addTag: (tag) => ipcRenderer.invoke('db:add-tag', tag),
  tagFile: (fileId, tagId) => ipcRenderer.invoke('db:tag-file', fileId, tagId),
  untagFile: (fileId, tagId) => ipcRenderer.invoke('db:untag-file', fileId, tagId),
  getFileTags: (fileId) => ipcRenderer.invoke('db:get-file-tags', fileId),

  // Annotations
  getAnnotations: (fileId) => ipcRenderer.invoke('db:get-annotations', fileId),
  addAnnotation: (anno) => ipcRenderer.invoke('db:add-annotation', anno),
  deleteAnnotation: (id) => ipcRenderer.invoke('db:delete-annotation', id),

  // Reading progress
  getProgress: (fileId) => ipcRenderer.invoke('db:get-progress', fileId),
  saveProgress: (progress) => ipcRenderer.invoke('db:save-progress', progress),

  // History
  getHistory: () => ipcRenderer.invoke('db:get-history'),
  addHistory: (record) => ipcRenderer.invoke('db:add-history', record),

  // AI Caching
  getAiCache: (hash) => ipcRenderer.invoke('db:get-ai-cache', hash),
  saveAiCache: (cache) => ipcRenderer.invoke('db:save-ai-cache', cache),

  // Python Worker
  runWorkerCommand: (command, args) => ipcRenderer.invoke('worker:run-command', command, args),

  // Dialog
  openFileDialog: () => ipcRenderer.invoke('dialog:open-file'),
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:open-directory'),

  // Window Controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isWindowMaximized: () => ipcRenderer.invoke('window:is-maximized'),
};

// Safe bridge exposure to window.api
contextBridge.exposeInMainWorld('api', api);
