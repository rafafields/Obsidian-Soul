import { Notice } from 'obsidian';
import { OpenRouterClient } from '../llm/OpenRouterClient';
import {
	SOUL_GENERATION_PROMPT, SOUL_FALLBACK, USER_GENERATION_PROMPT, parseLoadingPhrases,
	hasUserContext, buildCoreSoulMessages, buildNemesisSoulMessages,
} from './soulInstructions';
import { calcCost } from '../utils/tokens';
import type { LLMUsage } from '../types';
import { SoulManager } from '../souls/SoulManager';
import { t } from '../i18n';
import { initVault, type GeneratedSoul } from './WizardVaultInit';
import type { WizardContext, WizardState } from './WizardState';

function makeClient(state: Pick<WizardState, 'apiKey' | 'modelSlug'>): OpenRouterClient {
	return new OpenRouterClient(state.apiKey, state.modelSlug || 'anthropic/claude-haiku-4.5');
}

async function generateSoul(ctx: WizardContext): Promise<{ body: string; usage: LLMUsage }> {
	const { state } = ctx;
	const s = state.soulFormState;
	const userMessage = [
		`Language: Write the entire document in ${state.language}.`,
		'',
		`Agent name: ${s.name || 'Agent'}`,
		`Core purpose: ${s.corePurpose || 'Not specified.'}`,
		`Core values: ${s.coreValues || 'Not specified.'}`,
		`Voice and tone: ${s.voiceTone || 'Not specified.'}`,
	].join('\n');

	const { content, usage } = await makeClient(state).chat([
		{ role: 'system', content: SOUL_GENERATION_PROMPT },
		{ role: 'user', content: userMessage },
	], { temperature: 0.7 });
	return { body: content, usage };
}

async function generateUser(ctx: WizardContext): Promise<{ body: string; usage: LLMUsage }> {
	const { state } = ctx;
	const userMessage = [
		`Language: Write the entire document in ${state.language}.`,
		'',
		`Work style: ${state.workStyle || 'Not provided.'}`,
		`Communication preferences: ${state.commPreferences || 'Not provided.'}`,
		`Current areas of focus: ${state.interests || 'Not provided.'}`,
		`Long-term goals: ${state.longTermGoals || 'Not provided.'}`,
		`Personal context: ${state.personalContext || 'Not provided.'}`,
		`Patterns to avoid: ${state.patternsToAvoid || 'Not provided.'}`,
	].join('\n');

	const { content, usage } = await makeClient(state).chat([
		{ role: 'system', content: USER_GENERATION_PROMPT },
		{ role: 'user', content: userMessage },
	], { temperature: 0.5 });
	return { body: content, usage };
}

function userFallback(state: WizardState): string {
	return [
		'## Work style', '', state.workStyle || 'To be defined.',
		'', '## Communication preferences', '', state.commPreferences || 'To be defined.',
		'', '## Long-term goals', '', state.longTermGoals || 'To be defined.',
		'', '## Current areas of focus', '', state.interests || 'To be defined.',
		'', '## Patterns to avoid', '', state.patternsToAvoid || 'To be defined.',
		'', '## Relevant personal context', '', state.personalContext || 'To be defined.',
	].join('\n');
}

export async function runFinish(ctx: WizardContext): Promise<void> {
	const { state, plugin, vaultManager } = ctx;
	const s = state.soulFormState;
	const sel = state.soulSelection;
	const L = state.language;

	const userFormHasContent = !!(
		state.workStyle.trim() || state.commPreferences.trim() || state.interests.trim() ||
		state.longTermGoals.trim() || state.personalContext.trim() || state.patternsToAvoid.trim()
	);

	const pricingPromise = plugin.getModelPricing().catch(() => null);
	const totalUsages: LLMUsage[] = [];

	// 1. Generate user.md content
	state.loadingScreen?.setStatus(t('wizard_loading_user', L));
	let userBody: string;
	try {
		const result = userFormHasContent ? await generateUser(ctx) : null;
		userBody = result?.body ?? userFallback(state);
		if (result?.usage) totalUsages.push(result.usage);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		new Notice(t('wizard_user_gen_failed', L, { msg }));
		userBody = userFallback(state);
	}

	const contextAvailable = hasUserContext(userBody);
	const souls: GeneratedSoul[] = [];

	// 2. Generate Core soul
	if (sel.core && contextAvailable) {
		state.loadingScreen?.setStatus(t('soul_gen_generating_core', L));
		try {
			const { content, usage } = await makeClient(state).chat(
				buildCoreSoulMessages(userBody, L), { temperature: 0.7 },
			);
			const { cleanBody, phrases } = parseLoadingPhrases(content);
			totalUsages.push(usage);
			souls.push({ name: 'Core', emoji: '🤖', body: cleanBody, phrases });
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			new Notice(t('wizard_soul_gen_failed', L, { msg }));
		}
	}

	// 3. Generate Nemesis soul
	if (sel.nemesis && contextAvailable) {
		state.loadingScreen?.setStatus(t('soul_gen_generating_nemesis', L));
		try {
			const { content, usage } = await makeClient(state).chat(
				buildNemesisSoulMessages(userBody, L), { temperature: 0.7 },
			);
			const { cleanBody, phrases } = parseLoadingPhrases(content);
			totalUsages.push(usage);
			souls.push({ name: 'Nemesis', emoji: '😈', body: cleanBody, phrases });
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			new Notice(t('wizard_soul_gen_failed', L, { msg }));
		}
	}

	// 4. Generate Custom soul
	if (sel.custom) {
		state.loadingScreen?.setStatus(t('wizard_loading_soul', L));
		const customFormHasContent = !!(s.corePurpose.trim() || s.coreValues.trim() || s.voiceTone.trim());
		try {
			const result = customFormHasContent ? await generateSoul(ctx) : null;
			const rawBody = result?.body ?? SOUL_FALLBACK;
			const { cleanBody, phrases } = parseLoadingPhrases(rawBody);
			if (result?.usage) totalUsages.push(result.usage);
			souls.push({
				name: s.name || 'Agent',
				emoji: s.emoji,
				body: cleanBody,
				phrases,
				modelSlug: s.soulModelSlug || undefined,
			});
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			new Notice(t('wizard_soul_gen_failed', L, { msg }));
			const { cleanBody, phrases } = parseLoadingPhrases(SOUL_FALLBACK);
			souls.push({ name: s.name || 'Agent', emoji: s.emoji, body: cleanBody, phrases });
		}
	}

	// Fallback: ensure at least one soul exists
	if (souls.length === 0) {
		const { cleanBody, phrases } = parseLoadingPhrases(SOUL_FALLBACK);
		souls.push({ name: s.name || 'Agent', emoji: s.emoji, body: cleanBody, phrases });
	}

	// 5. Compute cost
	state.loadingScreen?.setStatus(t('wizard_loading_files', L));
	const pricing = await Promise.race([
		pricingPromise,
		new Promise<null>(resolve => window.setTimeout(() => resolve(null), 3000)),
	]);
	if (pricing && totalUsages.length > 0) {
		state.generationCost = totalUsages.reduce((sum, u) =>
			sum + calcCost(u.promptTokens, u.completionTokens, pricing.promptPerToken, pricing.completionPerToken), 0);
	}

	// 6. Write vault
	try {
		const defaultSoulId = SoulManager.nameToId(souls[0]!.name);
		plugin.settings.apiKey = state.apiKey;
		plugin.settings.modelSlug = state.modelSlug || 'anthropic/claude-haiku-4.5';
		plugin.settings.defaultSoul = defaultSoulId;
		await plugin.saveSettings();

		await initVault({
			souls,
			userBody,
			selectedTags: state.selectedTags,
			apiKey: state.apiKey,
			modelSlug: state.modelSlug,
			language: state.language,
		}, vaultManager);

		state.finishState = 'done';
		plugin.openGettingStarted();
		ctx.goTo(6);
	} catch (e) {
		state.finishError = e instanceof Error ? e.message : String(e);
		state.finishState = 'error';
		ctx.goTo(6);
	}
}
