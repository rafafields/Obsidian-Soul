import { Notice } from 'obsidian';
import type { VaultManager } from '../vault/VaultManager';
import type { FrontmatterParser } from '../vault/FrontmatterParser';
import type { TaxonomyManager } from '../vault/TaxonomyManager';
import { MemoryExtractor } from '../memory/MemoryExtractor';
import { EpisodeWriter } from './EpisodeWriter';
import { TraceWriter } from './TraceWriter';
import type { ChatMessage, MemoryItemCandidate, SoulMeta } from '../types';
import { t } from '../i18n';
import { wrapLink } from '../utils/links';
import { sanitizeFilename } from '../utils/filename';

export class SessionManager {
	private extractor = new MemoryExtractor();
	private episodeWriter: EpisodeWriter;
	private traceWriter: TraceWriter;

	constructor(
		private vaultManager: VaultManager,
		private parser: FrontmatterParser,
		private taxonomyManager: TaxonomyManager,
		private getApiKey: () => string,
		private getModelSlug: () => string,
		private getLanguage: () => string,
	) {
		this.episodeWriter = new EpisodeWriter(vaultManager, parser);
		this.traceWriter = new TraceWriter(vaultManager);
	}

	async finalizeSession(transcript: ChatMessage[], souls: SoulMeta[]): Promise<void> {
		if (transcript.length === 0) return;

		const now = new Date();
		const isoDatetime = now.toISOString().slice(0, 16); // 2024-01-15T14:30
		const filenameDatetime = isoDatetime.replace('T', '-').replace(':', '-'); // 2024-01-15-14-30
		const datetime = isoDatetime;
		const episodePath = `_agent/memory/episodes/${filenameDatetime}.md`;
		const sessionId = filenameDatetime;

		// Extract memory candidates
		const taxonomy = await this.taxonomyManager.getActiveTagsContent();
		let candidates: MemoryItemCandidate[] = [];
		try {
			candidates = await this.extractor.extract(
				transcript,
				taxonomy,
				this.getApiKey(),
				this.getModelSlug(),
				this.getLanguage(),
			);
		} catch {
			new Notice(t('session_extraction_failed', this.getLanguage()));
		}

		await this.episodeWriter.write(episodePath, sessionId, datetime, souls, transcript, candidates);

		for (const candidate of candidates) {
			await this.writePendingItem(candidate, sessionId, datetime, souls);
		}

		await this.traceWriter.write(sessionId, datetime, transcript, candidates);

		const important = candidates.filter(c => c.importance === 'high' || c.importance === 'critical');
		if (important.length > 0) {
			await this.updateActiveMdFromCandidates(important, datetime);
		}

		const lang = this.getLanguage();
		const savedNotice = candidates.length === 0
			? t('session_saved_zero', lang)
			: candidates.length === 1
				? t('session_saved_one', lang)
				: t('session_saved_many', lang, { n: String(candidates.length) });
		new Notice(savedNotice);
	}

	// — Memory items —

	private async writePendingItem(
		candidate: MemoryItemCandidate,
		sessionId: string,
		datetime: string,
		souls: SoulMeta[],
	): Promise<void> {
		const filename = sanitizeFilename(candidate.title);
		const path = `_agent/memory/items/${filename}.md`;

		const fm: Record<string, unknown> = {
			kind: wrapLink('memory_item'),
			state: wrapLink('pending'),
			created_at: datetime,
			updated_at: datetime,
			origin: wrapLink('agent'),
			memory_tier: wrapLink(candidate.memory_tier),
			memory_kind: wrapLink(candidate.memory_kind),
			importance: candidate.importance,
			confidence: candidate.confidence,
			tags: candidate.tags,
			proposed_tags: candidate.proposed_tags,
			related_to: [],
			expires_at: candidate.expires_at,
			session_id: sessionId,
			souls: souls.map(s => wrapLink(s.name)),
		};

		const body = [
			'## What happened / what was learned',
			'',
			candidate.what,
			'',
			'## Implication',
			'',
			candidate.implication,
			'',
			'## Origin context',
			'',
			`Extracted from session ${sessionId}.`,
		].join('\n');

		await this.vaultManager.writeFile(path, this.parser.serialize(fm, body));
	}

	// — active.md update (per-turn) —

	async updateActiveMdFromTurn(lastResponse: string): Promise<void> {
		const path = '_agent/memory/active.md';
		const content = await this.vaultManager.readFile(path);
		if (!content) return;

		const summary = this.extractSummary(lastResponse, 3);
		const now = new Date().toISOString().slice(0, 16);
		const { frontmatter, body } = this.parser.parse(content);
		const updatedBody = this.parser.updateSection(body, 'Current focus', summary);
		await this.vaultManager.writeFile(
			path,
			this.parser.serialize({ ...frontmatter, updated_at: now }, updatedBody),
		);
	}

	private extractSummary(text: string, maxSentences: number): string {
		const trimmed = text.trim();
		const sentenceEndRe = /[.!?]/g;
		let match: RegExpExecArray | null;
		let count = 0;
		let endIdx = trimmed.length;
		while ((match = sentenceEndRe.exec(trimmed)) !== null) {
			count++;
			if (count === maxSentences) {
				endIdx = match.index + 1;
				break;
			}
		}
		return trimmed.slice(0, endIdx);
	}

	// — active.md update (post-session) —

	private async updateActiveMdFromCandidates(
		candidates: MemoryItemCandidate[],
		datetime: string,
	): Promise<void> {
		const path = '_agent/memory/active.md';
		const content = await this.vaultManager.readFile(path);
		if (!content) return;

		const { frontmatter, body } = this.parser.parse(content);

		const decisionLines = candidates
			.map(c => `- [[memory/items/${sanitizeFilename(c.title)}]] — ${c.what.slice(0, 60)}`)
			.join('\n');

		const highestImportance = candidates.find(c => c.importance === 'critical') ?? candidates[0];
		const nextStep = highestImportance
			? `Review: [[memory/items/${sanitizeFilename(highestImportance.title)}]]`
			: '';

		let updatedBody = this.parser.updateSection(body, 'Recent decisions', decisionLines);
		if (nextStep) {
			updatedBody = this.parser.updateSection(updatedBody, 'Next step', nextStep);
		}

		const updatedFm = { ...frontmatter, updated_at: datetime };
		await this.vaultManager.writeFile(path, this.parser.serialize(updatedFm, updatedBody));
	}
}
