import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
const appRoot=resolve(import.meta.dirname,'../..');
process.env.MULTIBROWSER_DATA=process.env.MULTIBROWSER_DATA||join(appRoot,'test-results','desktop-'+randomUUID());
await import('../../src/main.mjs');
