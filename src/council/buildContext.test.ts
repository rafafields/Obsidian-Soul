import { describe, it, expect } from 'vitest';
import { buildContext } from './buildContext';
import { t } from '../i18n';
import type { CouncilSession } from '../types';

const makeSession = (overrides: Partial<CouncilSession> = {}): CouncilSession => ({
	sessionId: 'test-session',
	title: 'Test council',
	createdAt: 0,
	tokenCount: 0,
	estimatedCost: 0,
	threads: {
		'soul-a': { soulId: 'soul-a', emoji: '🔴', systemPrompt: 'You are Soul A.' },
		'soul-b': { soulId: 'soul-b', emoji: '🔵', systemPrompt: 'You are Soul B.' },
	},
	messages: [],
	...overrides,
});

describe('buildContext', () => {
	it('maps own-soul messages to assistant role', () => {
		const session = makeSession({
			messages: [{ author: 'soul-a', content: 'My thought.', timestamp: 1 }],
		});
		const { messages } = buildContext('soul-a', session, 'opinion', 'English');
		expect(messages[0]).toEqual({ role: 'assistant', content: 'My thought.' });
	});

	it('passes user messages through as user role verbatim', () => {
		const session = makeSession({
			messages: [{ author: 'user', content: 'What do you think?', timestamp: 1 }],
		});
		const { messages } = buildContext('soul-a', session, 'opinion', 'English');
		expect(messages[0]).toEqual({ role: 'user', content: 'What do you think?' });
	});

	it('prefixes other-soul messages with [soulId]: and sets user role', () => {
		const session = makeSession({
			messages: [{ author: 'soul-b', content: 'I disagree.', timestamp: 1 }],
		});
		const { messages } = buildContext('soul-a', session, 'opinion', 'English');
		expect(messages[0]).toEqual({ role: 'user', content: '[soul-b]: I disagree.' });
	});

	it('appends question instruction to the soul system prompt', () => {
		const session = makeSession();
		const { system } = buildContext('soul-a', session, 'opinion', 'English');
		expect(system).toContain(t('council_question_opinion', 'English'));
		expect(system).toContain(t('council_format_instruction', 'English'));
	});

	it('appends critique instruction', () => {
		const session = makeSession();
		const { system } = buildContext('soul-a', session, 'critique', 'English');
		expect(system).toContain(t('council_question_critique', 'English'));
	});

	it('appends propose instruction', () => {
		const session = makeSession();
		const { system } = buildContext('soul-a', session, 'propose', 'English');
		expect(system).toContain(t('council_question_propose', 'English'));
	});

	it('uses translated instruction when lang is Español', () => {
		const session = makeSession();
		const { system } = buildContext('soul-a', session, 'opinion', 'Español');
		expect(system).toContain(t('council_question_opinion', 'Español'));
	});

	it('handles mixed message sequence correctly', () => {
		const session = makeSession({
			messages: [
				{ author: 'user',   content: 'Question.',    timestamp: 1 },
				{ author: 'soul-a', content: 'My answer.',   timestamp: 2 },
				{ author: 'soul-b', content: 'Other view.',  timestamp: 3 },
			],
		});
		const { messages } = buildContext('soul-a', session, 'opinion', 'English');
		expect(messages[0]).toEqual({ role: 'user',      content: 'Question.' });
		expect(messages[1]).toEqual({ role: 'assistant', content: 'My answer.' });
		expect(messages[2]).toEqual({ role: 'user',      content: '[soul-b]: Other view.' });
	});

	it('throws if soulId not found in session threads', () => {
		const session = makeSession();
		expect(() => buildContext('soul-z', session, 'opinion', 'English')).toThrow('"soul-z"');
	});
});
