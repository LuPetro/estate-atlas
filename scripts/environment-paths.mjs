import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
export const operationsRoot = path.resolve(process.env.EA_OPERATIONS_ROOT || sourceRoot);
export const environment = process.env.EA_ENVIRONMENT || 'local';
if (!['local', 'development', 'production'].includes(environment))
  throw new Error('EA_ENVIRONMENT must be local, development or production.');
export const stateRoot =
  environment === 'local'
    ? path.join(operationsRoot, '.local')
    : path.join(operationsRoot, '.local/environments', environment);
export const configuration = path.join(stateRoot, 'docker');
export const backups = path.join(stateRoot, 'backups/automatic');
