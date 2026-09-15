import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
mkdirSync(new URL('../public/', import.meta.url), { recursive: true });
copyFileSync(require.resolve('canvaskit-wasm/bin/full/canvaskit.wasm'), new URL('../public/canvaskit.wasm', import.meta.url));
