import type { Importance } from '../types';
import { detectDefaultLanguage } from '../i18n';

export type CouncilResponseLength = 'short' | 'medium' | 'long';

export interface AgentSettings {
	defaultSoul: string;
	apiKey: string;
	modelSlug: string;
	language: string;
	contextTokenBudget: number;
	episodeDaysBack: number;
	minImportanceForContext: Importance;
	requireConfirmBeforeWrite: boolean;
	traceRetentionDays: number;
	autoArchiveExpiredItems: boolean;
	idleTimeoutMinutes: number;
	additionalContextPaths: string[];
	skipCouncilIntro: boolean;
	councilResponseLength: CouncilResponseLength;
}

export const DEFAULT_SETTINGS: AgentSettings = {
	defaultSoul: 'default',
	apiKey: '',
	modelSlug: 'anthropic/claude-haiku-4.5',
	language: detectDefaultLanguage(),
	contextTokenBudget: 8000,
	episodeDaysBack: 2,
	minImportanceForContext: 'medium',
	requireConfirmBeforeWrite: true,
	traceRetentionDays: 30,
	autoArchiveExpiredItems: true,
	idleTimeoutMinutes: 10,
	additionalContextPaths: [],
	skipCouncilIntro: false,
	councilResponseLength: 'short',
};
