import { describe, it, expect, vi, beforeAll } from 'vitest';

// Track registered channels
const registeredChannels = new Set<string>();

// Mock electron modules
vi.mock('electron', () => {
  return {
    app: {
      getPath: vi.fn().mockReturnValue('./mockUserData'),
      isPackaged: false,
      whenReady: () => Promise.resolve(),
      on: vi.fn(),
    },
    ipcMain: {
      handle: vi.fn().mockImplementation((channel, handler) => {
        registeredChannels.add(channel);
      }),
    },
    dialog: {
      showOpenDialog: vi.fn(),
    },
    BrowserWindow: class {
      loadURL() {}
      loadFile() {}
      on() {}
      webContents = {
        openDevTools() {}
      };
    }
  };
});

// Mock worker-manager to prevent background spawn
vi.mock('../src/main/worker-manager', () => {
  return {
    pythonWorker: {
      sendCommand: vi.fn().mockResolvedValue({}),
      kill: vi.fn(),
    }
  };
});

describe('Electron IPC Handler Registration', () => {
  beforeAll(async () => {
    // Load the main process file via dynamic import to trigger registration
    await import('../src/main/index');
  });

  it('should register document database handlers', () => {
    expect(registeredChannels.has('db:get-documents')).toBe(true);
    expect(registeredChannels.has('db:add-document')).toBe(true);
    expect(registeredChannels.has('db:delete-document')).toBe(true);
    expect(registeredChannels.has('db:search-documents')).toBe(true);
  });

  it('should register tags and tagging database handlers', () => {
    expect(registeredChannels.has('db:get-tags')).toBe(true);
    expect(registeredChannels.has('db:add-tag')).toBe(true);
    expect(registeredChannels.has('db:tag-file')).toBe(true);
    expect(registeredChannels.has('db:untag-file')).toBe(true);
    expect(registeredChannels.has('db:get-file-tags')).toBe(true);
  });

  it('should register annotations and notes handlers', () => {
    expect(registeredChannels.has('db:get-annotations')).toBe(true);
    expect(registeredChannels.has('db:add-annotation')).toBe(true);
    expect(registeredChannels.has('db:delete-annotation')).toBe(true);
  });

  it('should register reading progress and history handlers', () => {
    expect(registeredChannels.has('db:get-progress')).toBe(true);
    expect(registeredChannels.has('db:save-progress')).toBe(true);
    expect(registeredChannels.has('db:get-history')).toBe(true);
    expect(registeredChannels.has('db:add-history')).toBe(true);
  });

  it('should register python worker command runner and dialog pickers', () => {
    expect(registeredChannels.has('worker:run-command')).toBe(true);
    expect(registeredChannels.has('dialog:open-file')).toBe(true);
  });
});
