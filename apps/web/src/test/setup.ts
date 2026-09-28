import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// vitest の globals を使わないため、描画した要素はテストごとに明示的に片付ける
afterEach(() => cleanup());
