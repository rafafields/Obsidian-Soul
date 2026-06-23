import { describe, it, expect } from 'vitest';
import { parseEditBlocks, stripEditBlocks, computeDiff } from './FileEditParser';

describe('parseEditBlocks', () => {
	it('returns empty array when no edit blocks present', () => {
		expect(parseEditBlocks('just a normal response')).toEqual([]);
	});

	it('extracts a single edit block with path and content', () => {
		const response = [
			'Here is the updated file.',
			'',
			'```edit:_agent/user.md',
			'# User',
			'Some content.',
			'```',
		].join('\n');

		const blocks = parseEditBlocks(response);
		expect(blocks).toHaveLength(1);
		expect(blocks[0]?.path).toBe('_agent/user.md');
		expect(blocks[0]?.content).toBe('# User\nSome content.');
	});

	it('extracts multiple edit blocks', () => {
		const response = [
			'```edit:file-a.md',
			'Content A',
			'```',
			'',
			'```edit:file-b.md',
			'Content B',
			'```',
		].join('\n');

		const blocks = parseEditBlocks(response);
		expect(blocks).toHaveLength(2);
		expect(blocks[0]?.path).toBe('file-a.md');
		expect(blocks[1]?.path).toBe('file-b.md');
	});

	it('ignores regular code fences', () => {
		const response = '```typescript\nconst x = 1;\n```';
		expect(parseEditBlocks(response)).toEqual([]);
	});
});

describe('stripEditBlocks', () => {
	it('removes edit fences from response text', () => {
		const response = [
			'Here is the update.',
			'',
			'```edit:_agent/user.md',
			'# Content',
			'```',
			'',
			'Done.',
		].join('\n');

		const stripped = stripEditBlocks(response);
		expect(stripped).toContain('Here is the update.');
		expect(stripped).toContain('Done.');
		expect(stripped).not.toContain('```edit:');
		expect(stripped).not.toContain('# Content');
	});

	it('returns original text unchanged when no edit blocks', () => {
		const text = 'No edits here.';
		expect(stripEditBlocks(text)).toBe(text);
	});
});

describe('computeDiff', () => {
	it('returns equal lines when content is identical', () => {
		const lines = computeDiff('a\nb\nc', 'a\nb\nc');
		expect(lines.every(l => l.kind === 'equal')).toBe(true);
	});

	it('marks added lines', () => {
		const diff = computeDiff('a\nb', 'a\nb\nc');
		expect(diff.some(l => l.kind === 'add' && l.text === 'c')).toBe(true);
	});

	it('marks removed lines', () => {
		const diff = computeDiff('a\nb\nc', 'a\nb');
		expect(diff.some(l => l.kind === 'remove' && l.text === 'c')).toBe(true);
	});

	it('marks changed lines as remove + add', () => {
		const diff = computeDiff('hello', 'world');
		expect(diff.some(l => l.kind === 'remove' && l.text === 'hello')).toBe(true);
		expect(diff.some(l => l.kind === 'add' && l.text === 'world')).toBe(true);
	});
});
