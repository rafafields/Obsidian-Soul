import type { VaultManager } from '../vault/VaultManager';
import type { FrontmatterParser } from '../vault/FrontmatterParser';
import type { ChatMessage, MemoryItemCandidate, SoulMeta } from '../types';
import { countTokens } from '../utils/tokens';
import { wrapLink } from '../utils/links';

export class EpisodeWriter {
	constructor(
		private vaultManager: VaultManager,
		private parser: FrontmatterParser,
	) {}

	async write(
		episodePath: string,
		sessionId: string,
		datetime: string,
		souls: SoulMeta[],
		transcript: ChatMessage[],
		candidates: MemoryItemCandidate[],
	): Promise<void> {
		const tokenCost = transcript.reduce((s, m) => s + countTokens(m.content), 0);
		const firstUserMsg = transcript.find(m => m.role === 'user')?.content ?? '';
		const intention = firstUserMsg.slice(0, 120) + (firstUserMsg.length > 120 ? '…' : '');

		const decisions = candidates.filter(c => c.memory_kind === 'decision');
		const risks = candidates.filter(c => c.memory_kind === 'risk');

		const decisionLines = decisions.length > 0
			? decisions.map(c => `- ${c.title}: ${c.what.slice(0, 80)}`).join('\n')
			: 'none';

		const riskLines = risks.length > 0
			? risks.map(c => `- ${c.title}`).join('\n')
			: 'none';

		const sessionBlock = [
			`## Session ${datetime.replace('T', ' ')}`,
			'',
			'### What was attempted',
			'',
			intention,
			'',
			'### What was produced',
			'',
			`- ${Math.floor(transcript.length / 2)} exchanges`,
			`- ${candidates.length} memory candidates extracted`,
			'',
			'### Decisions made',
			'',
			decisionLines,
			'',
			'### Open questions',
			'',
			riskLines,
		].join('\n');

		const fm = {
			kind: wrapLink('memory_episode'),
			state: wrapLink('confirmed'),
			created_at: datetime,
			updated_at: datetime,
			origin: souls.map(s => s.name).join(', '),
			session_id: sessionId,
			souls: souls.map(s => wrapLink(s.name)),
			token_cost: tokenCost,
		};
		await this.vaultManager.writeFile(episodePath, this.parser.serialize(fm, sessionBlock));
	}
}
