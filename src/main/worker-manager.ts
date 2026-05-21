import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import { app } from 'electron';

export class PythonWorkerManager {
  private workerProcess: ChildProcess | null = null;
  private pendingRequests: Map<string, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();
  private rl: readline.Interface | null = null;

  constructor() {
    this.startWorker();
  }

  private startWorker() {
    let workerPath: string;
    let workerArgs: string[] = [];

    if (app.isPackaged) {
      // In production (packaged), run the compiled standalone executable from resources
      const exeName = process.platform === 'win32' ? 'studyvault-worker.exe' : 'studyvault-worker';
      workerPath = path.join(process.resourcesPath, exeName);
    } else {
      // In development, run python worker.py script
      workerPath = 'python';
      const pythonScript = path.join(__dirname, '../../python_worker/worker.py');
      workerArgs = ['-u', pythonScript];
      
      if (!fs.existsSync(pythonScript)) {
        console.warn(`Python worker script not found at ${pythonScript}. Waiting for worker files...`);
        return;
      }
    }

    if (app.isPackaged && !fs.existsSync(workerPath)) {
      console.error(`Packaged python worker binary not found at ${workerPath}`);
      return;
    }

    console.log(`Spawning worker process: ${workerPath} ${workerArgs.join(' ')}`);

    // Spawn child process
    this.workerProcess = spawn(workerPath, workerArgs);

    if (!this.workerProcess) {
      console.error('Failed to spawn Python worker process.');
      return;
    }

    // Set up standard input / output readline interface
    this.rl = readline.createInterface({
      input: this.workerProcess.stdout!,
      output: this.workerProcess.stdin!,
      terminal: false
    });

    this.rl.on('line', (line) => {
      try {
        const response = JSON.parse(line);
        const { id, status, data, error } = response;
        
        const pending = this.pendingRequests.get(id);
        if (pending) {
          this.pendingRequests.delete(id);
          if (status === 'success') {
            pending.resolve(data);
          } else {
            pending.reject(new Error(error || 'Python worker execution failed'));
          }
        }
      } catch (err) {
        console.error('Failed to parse Python response line:', line, err);
      }
    });

    // Handle error outputs
    this.workerProcess.stderr!.on('data', (data) => {
      console.warn(`[Python Worker Stderr]: ${data.toString().trim()}`);
    });

    this.workerProcess.on('close', (code) => {
      console.log(`Python worker process exited with code ${code}`);
      this.workerProcess = null;
      this.rl = null;
      
      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests.entries()) {
        pending.reject(new Error('Python worker crashed or was closed'));
        this.pendingRequests.delete(id);
      }

      // Auto-restart after 5 seconds
      setTimeout(() => {
        console.log('Restarting Python worker...');
        this.startWorker();
      }, 5000);
    });
  }

  /**
   * Sends a request to the Python worker and returns a Promise resolving with the result
   */
  public sendCommand(command: string, args: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.workerProcess || !this.workerProcess.stdin) {
        return reject(new Error('Python worker process is not running.'));
      }

      const id = Math.random().toString(36).substring(2, 15);
      const requestPayload = { id, command, args };
      
      this.pendingRequests.set(id, { resolve, reject });
      
      try {
        this.workerProcess.stdin.write(JSON.stringify(requestPayload) + '\n');
      } catch (err) {
        this.pendingRequests.delete(id);
        reject(err);
      }
    });
  }

  public kill() {
    if (this.workerProcess) {
      this.workerProcess.kill();
    }
  }
}

// Export a singleton manager instance
export const pythonWorker = new PythonWorkerManager();
export default pythonWorker;
