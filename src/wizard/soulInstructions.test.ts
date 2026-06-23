import { describe, it, expect } from 'vitest';
import {
	hasUserContext,
	buildCustomSoulMessages,
	buildCoreSoulMessages,
	buildNemesisSoulMessages,
	SOUL_GENERATION_PROMPT,
} from './soulInstructions';
import type { SoulFormState } from '../ui/SoulForm';

const baseForm: SoulFormState = {
	name: 'Atlas',
	emoji: '🤖',
	corePurpose: 'Help me think clearly',
	coreValues: 'Honesty, clarity',
	voiceTone: 'Direct and calm',
	soulModelSlug: '',
};

const userMd = `## Work style
I work in deep focus sessions of 2-3 hours. I prefer structured thinking over brainstorming.

## Patterns to avoid
Avoid vague encouragement. Do not repeat what I just said back to me.`;

// — hasUserContext —

describe('hasUserContext', () => {
	it('returns false for empty string', () => {
		expect(hasUserContext('')).toBe(false);
	});

	it('returns false for whitespace-only string', () => {
		expect(hasUserContext('   \n  \t  ')).toBe(false);
	});

	it('returns true when user.md has content', () => {
		expect(hasUserContext(userMd)).toBe(true);
	});
});

// — buildCustomSoulMessages —

describe('buildCustomSoulMessages', () => {
	it('uses SOUL_GENERATION_PROMPT as system message', () => {
		const msgs = buildCustomSoulMessages(baseForm, 'English');
		expect(msgs[0]?.role).toBe('system');
		expect(msgs[0]?.content).toBe(SOUL_GENERATION_PROMPT);
	});

	it('includes form fields and language in user message', () => {
		const msgs = buildCustomSoulMessages(baseForm, 'Spanish');
		const user = msgs[1]?.content ?? '';
		expect(user).toContain('Atlas');
		expect(user).toContain('Help me think clearly');
		expect(user).toContain('Honesty, clarity');
		expect(user).toContain('Direct and calm');
		expect(user).toContain('Spanish');
	});
});

// — buildCoreSoulMessages —

describe('buildCoreSoulMessages', () => {
	it('injects user.md content into system message', () => {
		const msgs = buildCoreSoulMessages(userMd, 'English');
		expect(msgs[0]?.content).toContain(userMd);
	});

	it('frames generation around amplifying preferences and strengths', () => {
		const msgs = buildCoreSoulMessages(userMd, 'English');
		const system = msgs[0]?.content ?? '';
		expect(system.toLowerCase()).toMatch(/preference|strength|amplif|support/);
	});

	it('includes language in user message', () => {
		const msgs = buildCoreSoulMessages(userMd, 'French');
		const user = msgs[1]?.content ?? '';
		expect(user).toContain('French');
	});
});

// — buildNemesisSoulMessages —

describe('buildNemesisSoulMessages', () => {
	it('injects user.md content into system message', () => {
		const msgs = buildNemesisSoulMessages(userMd, 'English');
		expect(msgs[0]?.content).toContain(userMd);
	});

	it('frames generation around challenging weaknesses and blind spots', () => {
		const msgs = buildNemesisSoulMessages(userMd, 'English');
		const system = msgs[0]?.content ?? '';
		expect(system.toLowerCase()).toMatch(/weakness|blind.?spot|challeng|friction/);
	});

	it('includes language in user message', () => {
		const msgs = buildNemesisSoulMessages(userMd, 'Italian');
		const user = msgs[1]?.content ?? '';
		expect(user).toContain('Italian');
	});
});
