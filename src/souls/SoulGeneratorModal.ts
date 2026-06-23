import { App, Modal, Notice } from 'obsidian';
import type { VaultManager } from '../vault/VaultManager';
import type { FrontmatterParser } from '../vault/FrontmatterParser';
import { OpenRouterClient } from '../llm/OpenRouterClient';
import {
	SOUL_FALLBACK, parseLoadingPhrases,
	hasUserContext, buildCustomSoulMessages, buildCoreSoulMessages, buildNemesisSoulMessages,
} from '../wizard/soulInstructions';
import { createMascotImg } from '../ui/mascot';
import { LoadingScreen } from '../ui/LoadingScreen';
import { SoulForm, type SoulFormState } from '../ui/SoulForm';
import { SoulManager } from './SoulManager';
import { LANGUAGES, detectDefaultLanguage, t } from '../i18n';
import { wrapLink } from '../utils/links';
import { Setting } from 'obsidian';
import type { ChatMessage } from '../types';

type GenState = 'selection' | 'form' | 'generating' | 'done' | 'error';

interface SoulSelection {
	core: boolean;
	nemesis: boolean;
	custom: boolean;
}

export class SoulGeneratorModal extends Modal {
	private soulFormState: SoulFormState = { name: '', emoji: '🤖', corePurpose: '', coreValues: '', voiceTone: '', soulModelSlug: '' };
	private language = detectDefaultLanguage();
	private state: GenState = 'selection';
	private errorMsg = '';
	private errorFromState: GenState = 'selection';
	private generatedIds: string[] = [];
	private userMd = '';
	private selection: SoulSelection = { core: true, nemesis: true, custom: false };
	private loadingScreen: LoadingScreen | null = null;
	private fromSelection = false;

	constructor(
		app: App,
		private vaultManager: VaultManager,
		private parser: FrontmatterParser,
		private apiKey: string,
		private modelSlug: string,
		private onComplete: (id: string) => void,
		initialLanguage?: string,
	) {
		super(app);
		if (initialLanguage) this.language = initialLanguage;
	}

	onOpen() {
		this.modalEl.addClass('agent-soul-generator-modal');
		this.state = 'form';
		this.selection.custom = true;
		this.render();
		void this.loadUserMd();
	}

	onClose() {
		this.contentEl.empty();
	}

	private async loadUserMd(): Promise<void> {
		this.userMd = await this.vaultManager.readFile('_agent/user.md') ?? '';
	}

	private render() {
		const { contentEl } = this;
		contentEl.empty();

		switch (this.state) {
			case 'selection':  this.renderSelection(); break;
			case 'form':       this.renderForm(); break;
			case 'generating': this.renderGenerating(); break;
			case 'done':       this.renderDone(); break;
			case 'error':      this.renderError(); break;
		}
	}

	// — Selection —

	private renderSelection() {
		const { contentEl } = this;
		const L = this.language;
		contentEl.createEl('h2', { text: t('soul_gen_selection_title', L) });
		const hasUser = hasUserContext(this.userMd);
		const desc = hasUser
			? t('soul_gen_selection_desc', L)
			: t('soul_gen_selection_no_user_desc', L);
		contentEl.createEl('p', { text: desc, cls: 'agent-wizard-desc' });

		const coreSetting = new Setting(contentEl)
			.setName(t('soul_gen_core_name', L))
			.setDesc(hasUser ? t('soul_gen_core_desc', L) : t('soul_gen_requires_user_md', L))
			.addToggle(toggle => {
				toggle.setValue(hasUser && this.selection.core).setDisabled(!hasUser)
					.onChange(v => { this.selection.core = v; });
			});
		if (!hasUser) coreSetting.settingEl.addClass('is-disabled');

		const nemesisSetting = new Setting(contentEl)
			.setName(t('soul_gen_nemesis_name', L))
			.setDesc(hasUser ? t('soul_gen_nemesis_desc', L) : t('soul_gen_requires_user_md', L))
			.addToggle(toggle => {
				toggle.setValue(hasUser && this.selection.nemesis).setDisabled(!hasUser)
					.onChange(v => { this.selection.nemesis = v; });
			});
		if (!hasUser) nemesisSetting.settingEl.addClass('is-disabled');

		new Setting(contentEl)
			.setName(t('soul_gen_custom_name', L))
			.setDesc(t('soul_gen_custom_desc', L))
			.addToggle(toggle => toggle.setValue(this.selection.custom).onChange(v => { this.selection.custom = v; }));

		new Setting(contentEl)
			.setName(t('language', L))
			.addDropdown(dd => {
				for (const lang of Object.keys(LANGUAGES)) dd.addOption(lang, lang);
				dd.setValue(this.language).onChange(v => { this.language = v; });
			});

		const navEl = contentEl.createDiv({ cls: 'agent-wizard-nav' });
		navEl.createEl('button', { text: t('cancel', L) })
			.addEventListener('click', () => { this.close(); });

		navEl.createEl('button', { text: t('soul_gen_generate_selected', L), cls: 'mod-cta' })
			.addEventListener('click', () => {
				const { core, nemesis, custom } = this.selection;
				if (!core && !nemesis && !custom) {
					new Notice(t('soul_gen_select_one', L));
					return;
				}
				if (custom) {
					this.fromSelection = true;
					this.state = 'form';
					this.render();
				} else {
					this.state = 'generating';
					this.render();
					void this.runAllGeneration();
				}
			});
	}

	// — Form (Custom soul) —

	private renderForm() {
		const { contentEl } = this;
		const L = this.language;
		contentEl.createEl('h2', { text: t('soul_gen_title', L) });
		contentEl.createEl('p', { text: t('soul_gen_desc', L), cls: 'agent-wizard-desc' });

		new SoulForm(contentEl, this.soulFormState, L, {
			name: t('soul_gen_name_name', L),
			desc: t('soul_gen_name_desc', L),
			placeholder: t('soul_gen_name_ph', L),
		}).render();

		if (!this.fromSelection) {
			new Setting(contentEl)
				.setName(t('language', L))
				.setDesc(t('soul_gen_language_desc', L))
				.addDropdown(dd => {
					for (const lang of Object.keys(LANGUAGES)) dd.addOption(lang, lang);
					dd.setValue(this.language).onChange(v => { this.language = v; });
				});
		}

		const navEl = contentEl.createDiv({ cls: 'agent-wizard-nav agent-wizard-nav--split' });

		if (this.fromSelection) {
			navEl.createEl('button', { text: t('back', L) })
				.addEventListener('click', () => { this.state = 'selection'; this.render(); });
		} else {
			navEl.createEl('button', { text: t('cancel', L) })
				.addEventListener('click', () => { this.close(); });
		}

		const label = this.fromSelection ? t('soul_gen_generate_selected', L) : t('generate', L);
		navEl.createEl('button', { text: label, cls: 'mod-cta' })
			.addEventListener('click', () => {
				if (!this.soulFormState.name) {
					new Notice(t('soul_gen_name_required', L));
					return;
				}
				this.state = 'generating';
				this.render();
				void this.runAllGeneration();
			});
	}

	// — Generating —

	private renderGenerating() {
		const L = this.language;
		this.loadingScreen = new LoadingScreen(this.contentEl, t('soul_gen_generating_title', L), t('starting', L));
	}

	private setStatus(text: string) {
		this.loadingScreen?.setStatus(text);
	}

	// — Done —

	private renderDone() {
		const { contentEl } = this;
		const L = this.language;
		createMascotImg(contentEl.createDiv({ cls: 'agent-wizard-mascot' }), 'inlove', 'agent-wizard-mascot-img');
		contentEl.createEl('h2', { text: t('soul_gen_done_title', L) });

		const paths = this.generatedIds.map(id => `_agent/souls/${id}.md`).join('\n');
		contentEl.createEl('p', { text: paths, cls: 'agent-wizard-desc' });

		contentEl.createDiv({ cls: 'agent-wizard-nav' })
			.createEl('button', { text: t('close', L), cls: 'mod-cta' })
			.addEventListener('click', () => { this.close(); });
	}

	// — Error —

	private renderError() {
		const { contentEl } = this;
		const L = this.language;
		contentEl.createEl('h2', { text: t('soul_gen_error_title', L) });
		contentEl.createEl('p', { text: this.errorMsg || t('error_unexpected', L), cls: 'agent-wizard-desc' });

		const navEl = contentEl.createDiv({ cls: 'agent-wizard-nav agent-wizard-nav--split' });
		navEl.createEl('button', { text: t('back', L) })
			.addEventListener('click', () => { this.state = this.errorFromState; this.render(); });

		navEl.createEl('button', { text: t('try_again', L), cls: 'mod-cta' })
			.addEventListener('click', () => {
				this.state = 'generating';
				this.render();
				void this.runAllGeneration();
			});
	}

	// — Generation —

	private async generateOneSoul(
		messages: ChatMessage[],
		name: string,
		emoji: string,
		soulModelSlug: string,
	): Promise<string> {
		const client = new OpenRouterClient(this.apiKey, soulModelSlug || this.modelSlug || 'anthropic/claude-haiku-4.5');

		let body: string;
		let loadingPhrases: string[] = [];
		try {
			const { content } = await client.chat(messages, { temperature: 0.7 });
			const parsed = parseLoadingPhrases(content);
			body = parsed.cleanBody;
			loadingPhrases = parsed.phrases;
		} catch {
			body = SOUL_FALLBACK;
		}

		this.setStatus(t('soul_gen_generating_file', this.language));

		const id = SoulManager.nameToId(name);
		const now = new Date();
		const date = now.toISOString().slice(0, 10);

		const fm: Record<string, unknown> = {
			name,
			emoji,
			kind: wrapLink('agent_soul'),
			state: wrapLink('active'),
			created_at: date,
			updated_at: date,
			origin: wrapLink('hybrid'),
		};
		if (soulModelSlug) fm['model_slug'] = soulModelSlug;
		if (loadingPhrases.length > 0) fm['loading_phrases'] = loadingPhrases;

		await this.vaultManager.writeFile(`_agent/souls/${id}.md`, this.parser.serialize(fm, body));
		return id;
	}

	private async runAllGeneration(): Promise<void> {
		this.generatedIds = [];
		this.errorFromState = this.fromSelection ? 'form' : 'selection';
		const L = this.language;

		try {
			if (this.selection.core) {
				this.setStatus(t('soul_gen_generating_core', L));
				const id = await this.generateOneSoul(
					buildCoreSoulMessages(this.userMd, L),
					'Core', '🤖', '',
				);
				this.generatedIds.push(id);
			}

			if (this.selection.nemesis) {
				this.setStatus(t('soul_gen_generating_nemesis', L));
				const id = await this.generateOneSoul(
					buildNemesisSoulMessages(this.userMd, L),
					'Nemesis', '😈', '',
				);
				this.generatedIds.push(id);
			}

			if (this.selection.custom) {
				this.setStatus(t('soul_gen_generating_soul', L));
				const s = this.soulFormState;
				const msgs = buildCustomSoulMessages(s, L);
				const id = await this.generateOneSoul(msgs, s.name || 'Agent', s.emoji, s.soulModelSlug);
				this.generatedIds.push(id);
			}

			const lastId = this.generatedIds.at(-1);
			if (!lastId) throw new Error('No souls were generated.');

			this.state = 'done';
			this.render();
			this.onComplete(lastId);
		} catch (e) {
			this.errorMsg = e instanceof Error ? e.message : String(e);
			this.state = 'error';
			this.render();
		}
	}
}
