import { describe, it, expect } from 'vitest';
import { BASE_FILES } from './baseFiles';

const paths = BASE_FILES.map(([p]) => p);
const contentOf = (path: string) => BASE_FILES.find(([p]) => p === path)?.[1] ?? '';

describe('BASE_FILES — system term-note directories', () => {
	const systemDirs = [
		'_system/states',
		'_system/memory_kinds',
		'_system/memory_tiers',
		'_system/origins',
		'_system/kinds',
	];

	it.each(systemDirs)('includes a .base file for %s', (dir) => {
		expect(paths.some(p => p.startsWith(dir + '/') && p.endsWith('.base'))).toBe(true);
	});
});

describe('BASE_FILES — states base content', () => {
	const path = '_system/states/_states.base';

	it('queries memory items folder', () => {
		expect(contentOf(path)).toContain('_agent/memory/items');
	});

	it('orders by state field', () => {
		expect(contentOf(path)).toContain('state');
	});
});

describe('BASE_FILES — memory_kinds base content', () => {
	const path = '_system/memory_kinds/_memory-kinds.base';

	it('queries memory items folder', () => {
		expect(contentOf(path)).toContain('_agent/memory/items');
	});

	it('orders by memory_kind field', () => {
		expect(contentOf(path)).toContain('memory_kind');
	});
});

describe('BASE_FILES — memory_tiers base content', () => {
	const path = '_system/memory_tiers/_memory-tiers.base';

	it('queries memory items folder', () => {
		expect(contentOf(path)).toContain('_agent/memory/items');
	});

	it('orders by memory_tier field', () => {
		expect(contentOf(path)).toContain('memory_tier');
	});
});

describe('BASE_FILES — origins base content', () => {
	const path = '_system/origins/_origins.base';

	it('queries agent folder', () => {
		expect(contentOf(path)).toContain('_agent');
	});

	it('orders by origin field', () => {
		expect(contentOf(path)).toContain('origin');
	});
});

describe('BASE_FILES — kinds base content', () => {
	const path = '_system/kinds/_kinds.base';

	it('queries agent folder', () => {
		expect(contentOf(path)).toContain('_agent');
	});

	it('orders by kind field', () => {
		expect(contentOf(path)).toContain('kind');
	});
});
