import type { VaultManager } from '../vault/VaultManager';
import type { ChatMessage, MemoryItemCandidate } from '../types';

export class TraceWriter {
	constructor(private vaultManager: VaultManager) {}

	async write(
		sessionId: string,
		datetime: string,
		transcript: ChatMessage[],
		candidates: MemoryItemCandidate[],
	): Promise<void> {
		const filename = datetime.replace(':', '-') + `-${sessionId}-finalize.md`;
		const path = `_system/traces/${filename}`;

		const transcriptLines = transcript.map(m =>
			`### ${m.role === 'user' ? 'User' : 'Agent'}\n\n${m.content}`,
		).join('\n\n---\n\n');

		const content = [
			`# Trace: ${sessionId}`,
			'',
			`date: ${datetime}`,
			`turns: ${transcript.length}`,
			`candidates: ${candidates.length}`,
			'',
			'## Transcript',
			'',
			transcriptLines,
			'',
			'## Memory candidates',
			'',
			'```json',
			JSON.stringify(candidates, null, 2),
			'```',
		].join('\n');
		await this.vaultManager.writeFile(path, content);
	}
}
