import path from 'path';
import { app } from 'electron';
import { pythonWorker } from './worker-manager';

export function initDatabase() {
  let dbPath: string;
  try {
    const userDataPath = app.getPath('userData');
    dbPath = path.join(userDataPath, 'studyvault.db');
  } catch (e) {
    dbPath = path.join(__dirname, '../../database/studyvault.db');
  }

  // Delegate database initialization to the Python worker
  pythonWorker.sendCommand('db_init', { db_path: dbPath })
    .then(() => console.log(`Database initialized via Python worker at: ${dbPath}`))
    .catch((err) => console.error('Failed to initialize database in Python worker:', err));
}

// IPC database service layer - proxying calls to the Python worker
export const dbService = {
  getDocuments: () => {
    return pythonWorker.sendCommand('db_get_documents', {});
  },

  addDocument: (doc: any) => {
    return pythonWorker.sendCommand('db_add_document', { doc });
  },

  deleteDocument: (id: string) => {
    return pythonWorker.sendCommand('db_delete_document', { id });
  },

  searchDocuments: (query: string) => {
    return pythonWorker.sendCommand('db_search_documents', { query });
  },

  getTags: () => {
    return pythonWorker.sendCommand('db_get_tags', {});
  },

  addTag: (tag: { id: string; name: string; color: string }) => {
    return pythonWorker.sendCommand('db_add_tag', { tag });
  },

  tagFile: (fileId: string, tagId: string) => {
    return pythonWorker.sendCommand('db_tag_file', { file_id: fileId, tag_id: tagId });
  },

  untagFile: (fileId: string, tagId: string) => {
    return pythonWorker.sendCommand('db_untag_file', { file_id: fileId, tag_id: tagId });
  },

  getFileTags: (fileId: string) => {
    return pythonWorker.sendCommand('db_get_file_tags', { file_id: fileId });
  },

  getAnnotations: (fileId: string) => {
    return pythonWorker.sendCommand('db_get_annotations', { file_id: fileId });
  },

  addAnnotation: (anno: any) => {
    return pythonWorker.sendCommand('db_add_annotation', { anno });
  },

  deleteAnnotation: (id: string) => {
    return pythonWorker.sendCommand('db_delete_annotation', { id });
  },

  getProgress: (fileId: string) => {
    return pythonWorker.sendCommand('db_get_progress', { file_id: fileId });
  },

  saveProgress: (progress: { file_id: string; last_page: number; scroll_position: number }) => {
    return pythonWorker.sendCommand('db_save_progress', { progress });
  },

  getHistory: () => {
    return pythonWorker.sendCommand('db_get_history', {});
  },

  addHistoryRecord: (record: any) => {
    return pythonWorker.sendCommand('db_add_history', { record });
  },

  getAiCache: (hash: string) => {
    return pythonWorker.sendCommand('db_get_ai_cache', { hash });
  },

  saveAiCache: (cache: { id: string; input_hash: string; response: string; model: string }) => {
    return pythonWorker.sendCommand('db_save_ai_cache', { cache });
  }
};
export default dbService;
