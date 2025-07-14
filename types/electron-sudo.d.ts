declare module 'electron-sudo' {
  export interface SudoerOptions {
    name: string;
    icns?: string; // macOS icon path
    process?: {
      options?: {
        env?: Record<string, string>;
        cwd?: string;
        [key: string]: any;
      };
      on?: (ps: any) => void;
    };
  }

  export interface ExecOptions {
    env?: Record<string, string>;
    cwd?: string;
    [key: string]: any;
  }

  export interface SpawnOptions extends ExecOptions {
    // Additional spawn options
  }

  export interface ChildProcess {
    output: {
      stdout: Buffer;
      stderr: Buffer;
    };
    stdout: NodeJS.ReadableStream;
    stderr: NodeJS.ReadableStream;
    on(event: 'close', listener: (code: number) => void): void;
    on(event: 'error', listener: (error: Error) => void): void;
    kill(): void;
  }

  export class Sudoer {
    constructor(options: SudoerOptions);
    exec(command: string, options?: ExecOptions): Promise<Buffer>;
    exec(command: string, options: ExecOptions, callback: (error: Error | null, stdout?: Buffer, stderr?: Buffer) => void): void;
    spawn(command: string, args: string[], options?: SpawnOptions): Promise<ChildProcess>;
  }

  export default Sudoer;
}