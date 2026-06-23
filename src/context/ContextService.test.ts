import { describe, it, expect } from 'vitest';
import { ContextService } from './ContextService';
import type { AgentSettings } from '../settings/types';

const baseSettings: AgentSettings = {
	defaultSoul: 'default',
	apiKey: 'key',
	modelSlug: 'model',
	language: 'es',
	contextTokenBudget: 8000,
	episodeDaysBack: 2,
	minImportanceForContext: 'medium',
	requireConfirmBeforeWrite: true,
	traceRetentionDays: 30,
	autoArchiveExpiredItems: true,
	idleTimeoutMinutes: 5,
	additionalContextPaths: ['_agent/extra.md'],
	skipCouncilIntro: false,
	councilResponseLength: 'short',
};

describe('ContextService.buildOptions', () => {
	it('maps settings fields to options', () => {
		const svc = new ContextService(baseSettings);
		const opts = svc.buildOptions('default');

		expect(opts.tokenBudget).toBe(8000);
		expect(opts.episodeDaysBack).toBe(2);
		expect(opts.minImportance).toBe('medium');
		expect(opts.soulId).toBe('default');
		expect(opts.additionalContextPaths).toEqual(['_agent/extra.md']);
	});

	it('appends extraPaths to settings additionalContextPaths', () => {
		const svc = new ContextService(baseSettings);
		const opts = svc.buildOptions('default', { extraPaths: ['notes/foo.md'] });

		expect(opts.additionalContextPaths).toEqual(['_agent/extra.md', 'notes/foo.md']);
	});

	it('excludes removedPaths from result', () => {
		const svc = new ContextService(baseSettings);
		const opts = svc.buildOptions('default', { removedPaths: ['_agent/extra.md'] });

		expect(opts.additionalContextPaths).toEqual([]);
	});

	it('overrides tokenBudget when provided', () => {
		const svc = new ContextService(baseSettings);
		const opts = svc.buildOptions('default', { tokenBudget: 4000 });

		expect(opts.tokenBudget).toBe(4000);
	});

	it('overrides minImportance when provided', () => {
		const svc = new ContextService(baseSettings);
		const opts = svc.buildOptions('default', { minImportance: 'low' });

		expect(opts.minImportance).toBe('low');
	});

	it('passes soulId through unchanged', () => {
		const svc = new ContextService(baseSettings);
		const opts = svc.buildOptions('my-soul');

		expect(opts.soulId).toBe('my-soul');
	});
});
