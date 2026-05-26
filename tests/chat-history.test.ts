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

describe('Database Service delegation for AI Chat History', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delegate getAiChats to pythonWorker', async () => {
    await dbService.getAiChats('doc123');
    expect(pythonWorker.sendCommand).toHaveBeenCalledWith('db_get_ai_chats', { file_id: 'doc123' });
  });

  it('should delegate createAiChat to pythonWorker with correct args', async () => {
    await dbService.createAiChat('chat1', 'Quantum Lecture Discussion', 'doc123');
    expect(pythonWorker.sendCommand).toHaveBeenCalledWith('db_create_ai_chat', {
      chat_id: 'chat1',
      title: 'Quantum Lecture Discussion',
      file_id: 'doc123'
    });
  });

  it('should delegate deleteAiChat to pythonWorker with chat_id', async () => {
    await dbService.deleteAiChat('chat1');
    expect(pythonWorker.sendCommand).toHaveBeenCalledWith('db_delete_ai_chat', { chat_id: 'chat1' });
  });

  it('should delegate getAiMessages to pythonWorker with chat_id', async () => {
    await dbService.getAiMessages('chat1');
    expect(pythonWorker.sendCommand).toHaveBeenCalledWith('db_get_ai_messages', { chat_id: 'chat1' });
  });

  it('should delegate addAiMessage to pythonWorker with serialized details', async () => {
    const msg = { id: 'msg1', chat_id: 'chat1', role: 'user', content: 'What is planck constant?' };
    await dbService.addAiMessage(msg);
    expect(pythonWorker.sendCommand).toHaveBeenCalledWith('db_add_ai_message', {
      msg_id: 'msg1',
      chat_id: 'chat1',
      role: 'user',
      content: 'What is planck constant?'
    });
  });
});
