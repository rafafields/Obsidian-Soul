import type { SoulFormState } from '../ui/SoulForm';
import type { LoadingScreen } from '../ui/LoadingScreen';
import type MinimalAgentPlugin from '../main';
import type { VaultManager } from '../vault/VaultManager';

export type FinishState = 'loading' | 'done' | 'error';

export const SUGGESTED_TAGS = [
	'#topic/work',
	'#topic/personal',
	'#topic/learning',
	'#topic/projects',
	'#topic/health',
	'#topic/finance',
	'#topic/relationships',
	'#topic/creativity',
];

export interface SoulSelection {
	core: boolean;
	nemesis: boolean;
	custom: boolean;
}

export interface WizardState {
	apiKey: string;
	modelSlug: string;
	language: string;
	workStyle: string;
	commPreferences: string;
	interests: string;
	longTermGoals: string;
	personalContext: string;
	patternsToAvoid: string;
	soulFormState: SoulFormState;
	soulSelection: SoulSelection;
	selectedTags: Set<string>;
	finishState: FinishState;
	finishError: string;
	generationCost: number | null;
	loadingScreen: LoadingScreen | null;
}

export interface WizardContext {
	state: WizardState;
	plugin: MinimalAgentPlugin;
	vaultManager: VaultManager;
	goTo: (step: number) => void;
	close: () => void;
}
