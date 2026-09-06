import { createRequire } from 'node:module';

// Backward-compatible command name retained from the v1.0.0 Community Demo.
// v1.1.0 uses the stricter public-source verifier as the single truth gate.
const require = createRequire(import.meta.url);
require('./verify-public-release.js');
