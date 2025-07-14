# Migration Guide: Implementing electron-sudo

This guide walks through the process of migrating from the current native implementation to electron-sudo in the Local Domain Manager application.

## Prerequisites

1. Backup your current implementation
2. Test environment for all three platforms (Windows, macOS, Linux)
3. Understanding of the current elevation flow

## Step 1: Install electron-sudo

```bash
npm install electron-sudo
# or if using yarn
yarn add electron-sudo

# Alternative (maintained by VSCode team):
npm install sudo-prompt
```

## Step 2: TypeScript Types (if needed)

If TypeScript types are not included, create a type definition file:

```typescript
// types/electron-sudo.d.ts
declare module 'electron-sudo' {
  export interface SudoerOptions {
    name: string;
    icns?: string; // macOS icon path
  }

  export interface ExecOptions {
    env?: Record<string, string>;
  }

  export interface SpawnOptions extends ExecOptions {
    // Additional spawn options
  }

  export interface ChildProcess {
    output: {
      stdout: Buffer;
      stderr: Buffer;
    };
    on(event: 'close', listener: (code: number) => void): void;
    on(event: 'error', listener: (error: Error) => void): void;
    kill(): void;
  }

  export class Sudoer {
    constructor(options: SudoerOptions);
    exec(command: string, options?: ExecOptions): Promise<Buffer>;
    spawn(command: string, args: string[], options?: SpawnOptions): Promise<ChildProcess>;
  }

  export default Sudoer;
}
```

## Step 3: Create Migration Strategy

### Option A: Side-by-Side Implementation (Recommended)

Keep both implementations and use a feature flag:

```typescript
// electron/main/config.ts
export const config = {
  useElectronSudo: process.env.USE_ELECTRON_SUDO === 'true' || false
};

// In your main process
import { HostFileService } from './host-file.service';
import { HostFileElectronSudoService } from './host-file-electron-sudo.service';
import { config } from './config';

const hostService = config.useElectronSudo 
  ? HostFileElectronSudoService 
  : HostFileService;

// Use hostService throughout your application
```

### Option B: Gradual Migration

1. Start with less critical operations (DNS flush)
2. Move to host file reading
3. Finally migrate write operations

## Step 4: Update IPC Handlers

```typescript
// electron/main/index.ts
import { ipcMain } from 'electron';
import { config } from './config';
import { HostFileService } from './host-file.service';
import { HostFileElectronSudoService } from './host-file-electron-sudo.service';

const hostService = config.useElectronSudo 
  ? HostFileElectronSudoService 
  : HostFileService;

// Update all IPC handlers to use the selected service
ipcMain.handle('host-file:read', async () => {
  return await hostService.parseHostFile();
});

ipcMain.handle('host-file:add', async (_, ip: string, hostname: string) => {
  return await hostService.addHostEntry(ip, hostname);
});

ipcMain.handle('host-file:remove', async (_, hostname: string) => {
  return await hostService.removeHostEntry(hostname);
});

ipcMain.handle('host-file:update', async (_, oldHostname: string, newIp: string, newHostname: string) => {
  return await hostService.updateHostEntry(oldHostname, newIp, newHostname);
});

ipcMain.handle('dns:flush', async () => {
  return await hostService.flushDNSCache();
});
```

## Step 5: Testing Checklist

### macOS Testing
- [ ] Test adding a host entry
- [ ] Test removing a host entry
- [ ] Test updating a host entry
- [ ] Test cancelling the authentication dialog
- [ ] Test DNS cache flush
- [ ] Verify native dialog appears

### Windows Testing
- [ ] Test with UAC enabled
- [ ] Test with standard user account
- [ ] Test with administrator account
- [ ] Test UAC cancellation
- [ ] Verify proper error messages

### Linux Testing
- [ ] Test on Ubuntu/Debian (with pkexec)
- [ ] Test on older distros (with gksudo)
- [ ] Test on KDE systems (with kdesudo)
- [ ] Test without GUI elevation tools

## Step 6: Error Handling Updates

Update your error handling to work with electron-sudo errors:

```typescript
// renderer/src/composables/useHostFile.ts
const handleSudoError = (error: any) => {
  if (error.message?.includes('User did not grant permission')) {
    return 'Permission denied: Authentication was cancelled';
  } else if (error.message?.includes('cancelled')) {
    return 'Operation cancelled by user';
  } else if (error.message?.includes('not found')) {
    return 'Elevation utility not found. Please run as administrator.';
  }
  return error.message || 'Unknown error occurred';
};
```

## Step 7: Build Configuration

Update electron-builder config if needed:

```json
{
  "build": {
    "extraResources": [
      {
        "from": "node_modules/electron-sudo/bin",
        "to": "bin",
        "filter": ["**/*"]
      }
    ]
  }
}
```

## Step 8: Production Deployment

1. **Gradual Rollout**:
   - Deploy with feature flag disabled
   - Enable for internal testing
   - Enable for beta users
   - Full rollout

2. **Monitoring**:
   - Track elevation success/failure rates
   - Monitor user cancellation rates
   - Log any platform-specific issues

3. **Rollback Plan**:
   - Keep feature flag in production
   - Can disable remotely if issues arise
   - Maintain both implementations for 1-2 releases

## Step 9: Cleanup (After Successful Migration)

Once electron-sudo is proven stable:

1. Remove old implementation
2. Remove feature flag
3. Update documentation
4. Remove unnecessary platform-specific code

## Common Issues and Solutions

### Issue 1: Binary Trust Warnings
**Solution**: Build electron-sudo from source and include your own binaries

### Issue 2: Dialog Not Appearing
**Solution**: Ensure the Electron app has proper focus, use `app.focus()` before elevation

### Issue 3: Different Behavior Across Platforms
**Solution**: Test thoroughly on all platforms, adjust command syntax as needed

### Issue 4: Performance Degradation
**Solution**: Use batch operations where possible, cache Sudoer instance

## Migration Timeline

- **Week 1**: Setup and initial testing
- **Week 2**: Internal testing with feature flag
- **Week 3**: Beta user testing
- **Week 4**: Production rollout
- **Week 5**: Monitor and fix issues
- **Week 6**: Clean up old code

## Rollback Procedure

If issues arise:

1. Set `USE_ELECTRON_SUDO=false` in environment
2. Restart application
3. Investigate issues
4. Fix and redeploy

## Benefits After Migration

1. **Reduced Code**: ~50% less elevation-specific code
2. **Easier Maintenance**: Single API for all platforms
3. **Better Testing**: Simpler to mock and test
4. **Consistent Behavior**: Same API across platforms
5. **Community Support**: Widely used package

## Final Notes

- Keep both implementations during transition
- Test thoroughly on all platforms
- Have a clear rollback strategy
- Monitor user feedback closely
- Consider sudo-prompt as alternative if electron-sudo has issues