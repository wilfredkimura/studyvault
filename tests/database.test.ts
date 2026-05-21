import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dbService } from '../src/main/db';
import { pythonWorker } from '../src/main/worker-manager';

// Mock the pythonWorker to track function calls
vi.mock('../src/main/worker-manager', () => {
  return {
    pythonWorker: {
      sendCommand: vi.fn().mockImplementation(() => Promise.resolve({ success: true }))
    }
  };
});

describe('Database Service Delegation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delegate getDocuments to pythonWorker', async () => {
    await dbService.getDocuments();
    expect(pythonWorker.sendCommand).toHaveBeenCalledWith('db_get_documents', {});
  });

  it('should delegate addDocument to pythonWorker with doc args', async () => {
    const doc = { id: '1', name: 'Test.pdf', type: 'pdf', path: '/test.pdf', size: 100, hash: 'h1' };
    await dbService.addDocument(doc);
    expect(pythonWorker.sendCommand).toHaveBeenCalledWith('db_add_document', { doc });
  });

  it('should delegate deleteDocument to pythonWorker with id args', async () => {
    await dbService.deleteDocument('123');
    expect(pythonWorker.sendCommand).toHaveBeenCalledWith('db_delete_document', { id: '123' });
  });

  it('should delegate searchDocuments to pythonWorker with query args', async () => {
    await dbService.searchDocuments('quantum');
    expect(pythonWorker.sendCommand).toHaveBeenCalledWith('db_search_documents', { query: 'quantum' });
  });

  it('should delegate annotations calls to pythonWorker', async () => {
    const anno = { id: 'a1', file_id: 'doc1', type: 'highlight' };
    await dbService.addAnnotation(anno);
    expect(pythonWorker.sendCommand).toHaveBeenCalledWith('db_add_annotation', { anno });

    await dbService.getAnnotations('doc1');
    expect(pythonWorker.sendCommand).toHaveBeenCalledWith('db_get_annotations', { file_id: 'doc1' });

    await dbService.deleteAnnotation('a1');
    expect(pythonWorker.sendCommand).toHaveBeenCalledWith('db_delete_annotation', { id: 'a1' });
  });

  it('should delegate getAllProgress to pythonWorker', async () => {
    await dbService.getAllProgress();
    expect(pythonWorker.sendCommand).toHaveBeenCalledWith('db_get_all_progress', {});
  });
});
