import { App, PluginSettingTab, Setting } from 'obsidian';
import type MinimalAgentPlugin from '../main';
import { countTokens } from '../utils/tokens';
import type { Importance } from '../types';
import type { CouncilResponseLength } from './types';
import { CURATED_MODELS, CUSTOM_MODEL_OPTION, findCuratedModel } from '../llm/curatedModels';
import { SoulGeneratorModal } from '../souls/SoulGeneratorModal';
import { LANGUAGES, t } from '../i18n';
import { FileSuggest } from './FileSuggest';

export class AgentSettingTab extends PluginSettingTab {
	plugin: MinimalAgentPlugin;
	private pinnedListEl: HTMLElement | null = null;
	private ctxInfoEl: HTMLElement | null = null;
	private currentLanguage = '';

	constructor(app: App, plugin: MinimalAgentPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		this.currentLanguage = this.plugin.settings.language;
		const L = this.currentLanguage;

		this.renderSoulsSection(containerEl, L);
		this.renderApiSection(containerEl, L);
		this.renderLanguageSection(containerEl, L);
		this.renderContextSection(containerEl, L);
		this.renderMemorySection(containerEl, L);
		this.renderSessionSection(containerEl, L);
		this.renderCouncilSection(containerEl, L);
	}

	// — Souls —

	private renderSoulsSection(container: HTMLElement, L: string): void {
		container.createEl('h3', { text: t('settings_souls_section', L) });

		let soulDropdown: HTMLSelectElement | null = null;

		const soulSetting = new Setting(container)
			.setName(t('settings_default_soul_name', L))
			.setDesc(t('settings_default_soul_desc', L))
			.addDropdown(drop => {
				soulDropdown = drop.selectEl;
				drop.addOption(this.plugin.settings.defaultSoul, t('settings_souls_loading', L, { id: this.plugin.settings.defaultSoul }));
				drop.setValue(this.plugin.settings.defaultSoul);
				drop.onChange(async (value) => {
					this.plugin.settings.defaultSoul = value;
					await this.plugin.saveSettings();
				});
			})
			.addButton(btn => {
				btn.setButtonText(t('settings_create_soul_btn', L)).onClick(() => {
					new SoulGeneratorModal(
						this.app,
						this.plugin.vaultManager,
						this.plugin.parser,
						this.plugin.settings.apiKey,
						this.plugin.settings.modelSlug,
						(id) => {
							void this.plugin.soulManager.listSouls().then(souls => {
								if (!soulDropdown) return;
								soulDropdown.empty();
								for (const s of souls) {
									const opt = soulDropdown.createEl('option', {
										text: `${s.emoji} ${s.name}`,
										value: s.id,
									});
									if (s.id === id) opt.selected = true;
								}
								this.plugin.settings.defaultSoul = id;
								void this.plugin.saveSettings();
							});
						},
						this.plugin.settings.language,
					).open();
				});
			});
		void soulSetting;

		void this.plugin.soulManager.listSouls().then(souls => {
			if (!soulDropdown) return;
			const currentValue = this.plugin.settings.defaultSoul;
			soulDropdown.empty();
			if (souls.length === 0) {
				soulDropdown.createEl('option', { text: t('settings_souls_none', L), value: '' });
				return;
			}
			for (const s of souls) {
				const opt = soulDropdown.createEl('option', {
					text: `${s.emoji} ${s.name}`,
					value: s.id,
				});
				if (s.id === currentValue) opt.selected = true;
			}
		});
	}

	// — API —

	private renderApiSection(container: HTMLElement, L: string): void {
		container.createEl('h3', { text: t('settings_api_section', L) });

		new Setting(container)
			.setName(t('settings_api_key_name', L))
			.setDesc(this.plugin.settings.apiKey
				? t('settings_api_key_configured', L)
				: t('settings_api_key_missing', L))
			.addText(text => {
				text.inputEl.type = 'password';
				text
					.setPlaceholder('sk-or-...')
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value.trim();
						await this.plugin.saveSettings();
					});
			});

		const isCustom = !findCuratedModel(this.plugin.settings.modelSlug);
		const dropdownValue = isCustom ? CUSTOM_MODEL_OPTION : this.plugin.settings.modelSlug;

		const modelInfoEl = container.createDiv({ cls: 'agent-model-info' });
		const customFieldEl = container.createDiv({ cls: 'agent-model-custom' });
		customFieldEl.style.display = isCustom ? '' : 'none';

		const renderModelInfo = (slug: string) => {
			modelInfoEl.empty();
			const model = findCuratedModel(slug);
			if (!model) return;
			const priceEl = modelInfoEl.createDiv({ cls: 'agent-model-info__price' });
			priceEl.createSpan({ text: `Input: $${model.inputPricePerM.toFixed(2)} / 1M · Output: $${model.outputPricePerM.toFixed(2)} / 1M` });
			modelInfoEl.createDiv({ text: model.description, cls: 'agent-model-info__desc' });
		};

		new Setting(container)
			.setName(t('model', L))
			.setDesc(this.buildZdrDesc(t('settings_model_desc', L)))
			.addDropdown(drop => {
				for (const m of CURATED_MODELS) {
					drop.addOption(m.slug, `${m.displayName} (${m.provider})`);
				}
				drop.addOption(CUSTOM_MODEL_OPTION, 'Custom…');
				drop.setValue(dropdownValue);
				drop.onChange(async (value) => {
					if (value === CUSTOM_MODEL_OPTION) {
						customFieldEl.style.display = '';
						modelInfoEl.empty();
					} else {
						customFieldEl.style.display = 'none';
						this.plugin.settings.modelSlug = value;
						await this.plugin.saveSettings();
						renderModelInfo(value);
					}
				});
			});

		container.appendChild(modelInfoEl);
		container.appendChild(customFieldEl);

		new Setting(customFieldEl)
			.setName(t('custom_model_slug', L))
			.setDesc(t('settings_model_custom_desc', L))
			.addText(text => {
				text
					.setPlaceholder(t('settings_model_custom_ph', L))
					.setValue(isCustom ? this.plugin.settings.modelSlug : '')
					.onChange(async (value) => {
						this.plugin.settings.modelSlug = value.trim();
						await this.plugin.saveSettings();
					});
			});

		if (!isCustom) renderModelInfo(this.plugin.settings.modelSlug);
	}

	// — Language —

	private renderLanguageSection(container: HTMLElement, L: string): void {
		container.createEl('h3', { text: t('settings_language_section', L) });

		new Setting(container)
			.setName(t('settings_language_name', L))
			.setDesc(t('settings_language_desc', L))
			.addDropdown(drop => {
				for (const lang of Object.keys(LANGUAGES)) {
					drop.addOption(lang, lang);
				}
				drop.setValue(this.plugin.settings.language);
				drop.onChange(async (value) => {
					this.plugin.settings.language = value;
					await this.plugin.saveSettings();
				});
			});
	}

	// — Context —

	private renderContextSection(container: HTMLElement, L: string): void {
		container.createEl('h3', { text: t('settings_context_section', L) });

		new Setting(container)
			.setName(t('settings_token_budget_name', L))
			.setDesc(t('settings_token_budget_desc', L))
			.addText(text => text
				.setValue(String(this.plugin.settings.contextTokenBudget))
				.onChange(async (value) => {
					const parsed = parseInt(value, 10);
					if (!isNaN(parsed) && parsed > 0) {
						this.plugin.settings.contextTokenBudget = parsed;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(container)
			.setName(t('settings_pinned_name', L))
			.setDesc(t('settings_pinned_desc', L));

		const pinnedEl = container.createDiv({ cls: 'agent-pinned-section' });
		const pinnedInputRow = pinnedEl.createDiv({ cls: 'agent-pinned-input-row' });
		const pinnedSearchInput = pinnedInputRow.createEl('input', {
			type: 'text',
			placeholder: t('settings_pinned_add_ph', L),
			cls: 'agent-pinned-input',
		});
		new FileSuggest(this.app, pinnedSearchInput);
		const pinnedAddBtn = pinnedInputRow.createEl('button', {
			text: t('settings_pinned_add_btn', L),
			cls: 'mod-cta agent-pinned-add-btn',
		});

		this.pinnedListEl = pinnedEl.createDiv({ cls: 'agent-pinned-list' });
		this.ctxInfoEl = container.createDiv({ cls: 'agent-ctx-info' });
		this.ctxInfoEl.createSpan({ text: t('settings_ctx_calculating', L), cls: 'agent-ctx-info__text' });

		this.renderPinnedList(L);
		this.refreshCtxInfo(L);

		pinnedAddBtn.addEventListener('click', async () => {
			const path = pinnedSearchInput.value.trim();
			if (!path) return;
			if (!this.plugin.settings.additionalContextPaths.includes(path)) {
				this.plugin.settings.additionalContextPaths = [
					...this.plugin.settings.additionalContextPaths,
					path,
				];
				await this.plugin.saveSettings();
				this.renderPinnedList(L);
				this.refreshCtxInfo(L);
			}
			pinnedSearchInput.value = '';
		});

		pinnedSearchInput.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				pinnedAddBtn.click();
			}
		});

		new Setting(container)
			.setName(t('settings_episode_days_name', L))
			.setDesc(t('settings_episode_days_desc', L))
			.addText(text => text
				.setValue(String(this.plugin.settings.episodeDaysBack))
				.onChange(async (value) => {
					const parsed = parseInt(value, 10);
					if (!isNaN(parsed) && parsed >= 0) {
						this.plugin.settings.episodeDaysBack = parsed;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(container)
			.setName(t('settings_min_importance_name', L))
			.setDesc(t('settings_min_importance_desc', L))
			.addDropdown(drop => drop
				.addOption('low', t('settings_importance_low', L))
				.addOption('medium', t('settings_importance_medium', L))
				.addOption('high', t('settings_importance_high', L))
				.addOption('critical', t('settings_importance_critical', L))
				.setValue(this.plugin.settings.minImportanceForContext)
				.onChange(async (value) => {
					this.plugin.settings.minImportanceForContext = value as Importance;
					await this.plugin.saveSettings();
				}));
	}

	// — Memory —

	private renderMemorySection(container: HTMLElement, L: string): void {
		container.createEl('h3', { text: t('settings_memory_section', L) });

		new Setting(container)
			.setName(t('settings_require_confirm_name', L))
			.setDesc(t('settings_require_confirm_desc', L))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.requireConfirmBeforeWrite)
				.onChange(async (value) => {
					this.plugin.settings.requireConfirmBeforeWrite = value;
					await this.plugin.saveSettings();
				}));

		new Setting(container)
			.setName(t('settings_auto_archive_name', L))
			.setDesc(t('settings_auto_archive_desc', L))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoArchiveExpiredItems)
				.onChange(async (value) => {
					this.plugin.settings.autoArchiveExpiredItems = value;
					await this.plugin.saveSettings();
				}));

		new Setting(container)
			.setName(t('settings_trace_retention_name', L))
			.setDesc(t('settings_trace_retention_desc', L))
			.addText(text => text
				.setValue(String(this.plugin.settings.traceRetentionDays))
				.onChange(async (value) => {
					const parsed = parseInt(value, 10);
					if (!isNaN(parsed) && parsed > 0) {
						this.plugin.settings.traceRetentionDays = parsed;
						await this.plugin.saveSettings();
					}
				}));
	}

	// — Session —

	private renderSessionSection(container: HTMLElement, L: string): void {
		container.createEl('h3', { text: t('settings_session_section', L) });

		new Setting(container)
			.setName(t('settings_idle_timeout_name', L))
			.setDesc(t('settings_idle_timeout_desc', L))
			.addText(text => text
				.setValue(String(this.plugin.settings.idleTimeoutMinutes))
				.onChange(async (value) => {
					const parsed = parseInt(value, 10);
					if (!isNaN(parsed) && parsed >= 0) {
						this.plugin.settings.idleTimeoutMinutes = parsed;
						await this.plugin.saveSettings();
					}
				}));
	}

	// — Council —

	private renderCouncilSection(container: HTMLElement, L: string): void {
		container.createEl('h3', { text: t('council_settings_section', L) });

		new Setting(container)
			.setName(t('council_settings_length_label', L))
			.setDesc(t('council_settings_length_desc', L))
			.addDropdown(drop => drop
				.addOption('short',  t('council_length_option_short',  L))
				.addOption('medium', t('council_length_option_medium', L))
				.addOption('long',   t('council_length_option_long',   L))
				.setValue(this.plugin.settings.councilResponseLength)
				.onChange(async (value) => {
					this.plugin.settings.councilResponseLength = value as CouncilResponseLength;
					await this.plugin.saveSettings();
				}));
	}

	// — Helpers —

	private buildZdrDesc(template: string): DocumentFragment {
		const [before, after] = template.split('{zdr}');
		const frag = document.createDocumentFragment();
		frag.append(before ?? '');
		const link = document.createElement('a');
		link.textContent = 'ZDR ✓';
		link.className = 'agent-wizard-zdr-link';
		link.addEventListener('click', (e) => {
			e.preventDefault();
			window.open('https://openrouter.ai/docs/guides/features/zdr', '_blank');
		});
		frag.appendChild(link);
		frag.append(after ?? '');
		return frag;
	}

	private renderPinnedList(L: string): void {
		if (!this.pinnedListEl) return;
		this.pinnedListEl.empty();
		const paths = this.plugin.settings.additionalContextPaths;
		if (paths.length === 0) {
			this.pinnedListEl.createEl('p', {
				text: t('settings_pinned_empty', L),
				cls: 'agent-pinned-empty',
			});
			return;
		}
		for (const path of paths) {
			const itemEl = this.pinnedListEl.createDiv({ cls: 'agent-pinned-item' });
			itemEl.createSpan({ text: path, cls: 'agent-pinned-item__path' });
			const tokSpan = itemEl.createSpan({ text: '…', cls: 'agent-pinned-item__tokens' });
			const removeBtn = itemEl.createEl('button', { text: '×', cls: 'agent-pinned-item__remove' });
			removeBtn.addEventListener('click', async () => {
				this.plugin.settings.additionalContextPaths =
					this.plugin.settings.additionalContextPaths.filter(p => p !== path);
				await this.plugin.saveSettings();
				this.renderPinnedList(L);
				this.refreshCtxInfo(L);
			});
			void this.plugin.vaultManager.readFile(path).then(content => {
				if (!content) {
					tokSpan.setText(t('settings_pinned_not_found', L));
					tokSpan.addClass('agent-pinned-item__missing');
					return;
				}
				tokSpan.setText(t('settings_pinned_tokens', L, { tokens: countTokens(content).toLocaleString() }));
			});
		}
	}

	private refreshCtxInfo(L: string): void {
		if (!this.ctxInfoEl) return;
		this.ctxInfoEl.empty();
		this.ctxInfoEl.createSpan({ text: t('settings_ctx_calculating', L), cls: 'agent-ctx-info__text' });

		void this.plugin.contextAssembler.assemble({
			tokenBudget: this.plugin.settings.contextTokenBudget,
			episodeDaysBack: this.plugin.settings.episodeDaysBack,
			minImportance: this.plugin.settings.minImportanceForContext,
			soulId: this.plugin.settings.defaultSoul || 'default',
			additionalContextPaths: this.plugin.settings.additionalContextPaths,
		}).then(result => {
			if (!this.ctxInfoEl) return;
			const budget = this.plugin.settings.contextTokenBudget;
			const used = result.totalTokens;
			const pct = Math.round((used / budget) * 100);
			const droppedStr = result.droppedItems > 0
				? t('settings_ctx_dropped', L, { n: String(result.droppedItems), s: result.droppedItems !== 1 ? 's' : '' })
				: '';
			const label = t('settings_ctx_usage', L, {
				used: used.toLocaleString(),
				budget: budget.toLocaleString(),
				pct: String(pct),
				dropped: droppedStr,
			});

			this.ctxInfoEl.empty();
			const span = this.ctxInfoEl.createSpan({ text: label, cls: 'agent-ctx-info__text' });
			span.addClass(pct >= 100 ? 'agent-ctx-info--over' : pct >= 80 ? 'agent-ctx-info--warn' : 'agent-ctx-info--ok');

			if (pct >= 80) {
				const cheapModels = CURATED_MODELS
					.filter(m => m.tier === 'cheap' && m.slug !== this.plugin.settings.modelSlug)
					.map(m => m.displayName);
				if (cheapModels.length > 0) {
					this.ctxInfoEl.createDiv({
						text: t('settings_ctx_budget_warn', L, { models: cheapModels.join(', ') }),
						cls: 'agent-ctx-info__text agent-ctx-info--warn',
					});
				}
			}
		}).catch(() => {
			if (!this.ctxInfoEl) return;
			this.ctxInfoEl.empty();
			this.ctxInfoEl.createSpan({ text: t('settings_ctx_error', L), cls: 'agent-ctx-info__text agent-ctx-info--muted' });
		});
	}
}
