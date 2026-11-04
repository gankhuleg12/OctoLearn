// tsc does not copy non-TS files; migrations and seed data are read at runtime.
import { cpSync } from 'node:fs';

cpSync('src/db/migrations', 'dist/db/migrations', { recursive: true });
cpSync('src/db/seed-data', 'dist/db/seed-data', { recursive: true });
