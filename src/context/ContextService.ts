import type { AssemblyResult, ContextAssemblerOptions, Importance } from '../types';
import type { AgentSettings } from '../settings/types';
import type { ContextAssembler } from './ContextAssembler';

export interface SessionContextOverride {
	extraPaths?: string[];
	removedPaths?: string[];
	tokenBudget?: number;
	minImportance?: Importance;
}

export class ContextService {
	constructor(
		private settings: AgentSettings,
		private assembler?: ContextAssembler,
	) {}

	buildOptions(soulId: string, override?: SessionContextOverride): ContextAssemblerOptions {
		const base = this.settings.additionalContextPaths ?? [];

		const paths = [
			...base,
			...(override?.extraPaths ?? []),
		].filter(p => !(override?.removedPaths ?? []).includes(p));

		return {
			tokenBudget: override?.tokenBudget ?? this.settings.contextTokenBudget,
			episodeDaysBack: this.settings.episodeDaysBack,
			minImportance: override?.minImportance ?? this.settings.minImportanceForContext,
			soulId,
			additionalContextPaths: paths,
		};
	}

	assemble(soulId: string, override?: SessionContextOverride): Promise<AssemblyResult> {
		if (!this.assembler) throw new Error('ContextService: assembler not provided');
		return this.assembler.assemble(this.buildOptions(soulId, override));
	}
}
