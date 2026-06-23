import type { VaultManager } from '../vault/VaultManager';
import { wrapLink } from '../utils/links';
import { SoulManager } from '../souls/SoulManager';
import * as EN from './templates/en';
import * as ES from './templates/es';
import { BASE_FILES } from './templates/baseFiles';

export interface GeneratedSoul {
	name: string;
	emoji: string;
	body: string;
	phrases: string[];
	modelSlug?: string;
}

export interface WizardInitData {
	souls: GeneratedSoul[];
	userBody: string;
	selectedTags: Set<string>;
	apiKey: string;
	modelSlug: string;
	language: string;
}

function getTemplates(language: string) {
	return language === 'Español' ? ES : EN;
}

export async function initVault(data: WizardInitData, vaultManager: VaultManager): Promise<void> {
	const { souls, userBody, selectedTags } = data;

	const now = new Date();
	const date = now.toISOString().slice(0, 10);
	const datetime = now.toISOString().slice(0, 16);

	await vaultManager.ensurePath('_agent/souls');
	await vaultManager.ensurePath('_agent/memory/episodes');
	await vaultManager.ensurePath('_agent/memory/items');
	await vaultManager.ensurePath('_system/traces');
	await vaultManager.ensurePath('_system/memory_tiers');
	await vaultManager.ensurePath('_system/memory_kinds');
	await vaultManager.ensurePath('_system/states');
	await vaultManager.ensurePath('_system/origins');
	await vaultManager.ensurePath('_system/kinds');

	await refreshSystemDocs(vaultManager, data.language);
	await writeBaseFiles(vaultManager);

	for (const soul of souls) {
		const soulId = SoulManager.nameToId(soul.name);
		const soulFmLines = [
			'---',
			`name: "${soul.name}"`,
			`emoji: ${soul.emoji}`,
			`kind: "${wrapLink('agent_soul')}"`,
			`state: "${wrapLink('active')}"`,
			`created_at: ${date}`,
			`updated_at: ${date}`,
			`origin: "${wrapLink('hybrid')}"`,
		];
		if (soul.modelSlug) soulFmLines.push(`model_slug: ${soul.modelSlug}`);
		if (soul.phrases.length > 0) {
			soulFmLines.push(`loading_phrases: [${soul.phrases.map(p => `"${p.replace(/"/g, '\\"')}"`).join(', ')}]`);
		}
		soulFmLines.push('---', '', soul.body);
		await vaultManager.writeFile(`_agent/souls/${soulId}.md`, soulFmLines.join('\n'));
	}

	await vaultManager.writeFile('_agent/user.md', [
		'---',
		`kind: "${wrapLink('agent_user')}"`,
		`state: "${wrapLink('active')}"`,
		`created_at: ${date}`,
		`updated_at: ${date}`,
		`origin: "${wrapLink('hybrid')}"`,
		'---',
		'',
		userBody,
	].join('\n'));

	await vaultManager.writeFile('_agent/taxonomy.md', [
		'---',
		'kind: agent_taxonomy',
		`updated_at: ${date}`,
		'origin: human',
		'---',
		'',
		'## Active topics',
		'',
		[...selectedTags].join('\n'),
		'',
		'## Pending proposals',
	].join('\n'));

	await vaultManager.writeFile('_agent/memory/active.md', [
		'---',
		'kind: memory_active',
		'state: current',
		`created_at: ${date}`,
		`updated_at: ${datetime}`,
		'origin: hybrid',
		'---',
		'',
		'## Current focus',
		'',
		'## Recent decisions',
		'',
		'## Blockers',
		'',
		'none',
		'',
		'## Next step',
	].join('\n'));
}

export async function refreshSystemDocs(vaultManager: VaultManager, language: string): Promise<void> {
	await vaultManager.ensurePath('_system/memory_tiers');
	await vaultManager.ensurePath('_system/memory_kinds');
	await vaultManager.ensurePath('_system/states');
	await vaultManager.ensurePath('_system/origins');
	await vaultManager.ensurePath('_system/kinds');

	const tmpl = getTemplates(language);
	for (const [path, content] of tmpl.SYSTEM_NOTES) {
		await vaultManager.writeFile(path, content);
	}

	const gsPath = '_system/getting-started.md';
	if (!vaultManager.fileExists(gsPath)) {
		await vaultManager.writeFile(gsPath, tmpl.GETTING_STARTED);
	}

	await writeBaseFiles(vaultManager);
}

async function writeBaseFiles(vaultManager: VaultManager): Promise<void> {
	for (const [path, content] of BASE_FILES) {
		if (!vaultManager.fileExists(path)) {
			await vaultManager.writeFile(path, content);
		}
	}
}
