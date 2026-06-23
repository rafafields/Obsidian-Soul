import { App, Modal } from 'obsidian';
import type MinimalAgentPlugin from '../main';
import type { VaultManager } from '../vault/VaultManager';
import { detectDefaultLanguage, t } from '../i18n';
import { SUGGESTED_TAGS, type WizardState, type WizardContext } from './WizardState';
import { renderStep1 } from './steps/Step1Welcome';
import { renderStep2 } from './steps/Step2ApiConfig';
import { renderStep3 } from './steps/Step3AboutYou';
import { renderStep4 } from './steps/Step4DefineAgent';
import { renderStep5 } from './steps/Step5Tags';
import { renderStep6 } from './steps/Step6Finish';

const TOTAL_STEPS = 5;

export class SetupWizard extends Modal {
	private step = 1;
	private state: WizardState;
	private ctx: WizardContext;

	constructor(app: App, private plugin: MinimalAgentPlugin, private vaultManager: VaultManager) {
		super(app);
		this.state = {
			apiKey: plugin.settings.apiKey,
			modelSlug: plugin.settings.modelSlug,
			language: plugin.settings.language || detectDefaultLanguage(),
			workStyle: '',
			commPreferences: '',
			interests: '',
			longTermGoals: '',
			personalContext: '',
			patternsToAvoid: '',
			soulFormState: { name: '', emoji: '🤖', corePurpose: '', coreValues: '', voiceTone: '', soulModelSlug: '' },
			soulSelection: { core: true, nemesis: false, custom: false },
			selectedTags: new Set(SUGGESTED_TAGS),
			finishState: 'loading',
			finishError: '',
			generationCost: null,
			loadingScreen: null,
		};
		this.ctx = {
			state: this.state,
			plugin,
			vaultManager,
			goTo: (step: number) => { this.step = step; this.render(); },
			close: () => this.close(),
		};
	}

	static isFirstRun(app: App): boolean {
		return app.vault.getAbstractFileByPath('_agent/souls') === null;
	}

	onOpen() {
		this.modalEl.addClass('agent-wizard-modal');
		this.render();
	}

	onClose() {
		this.contentEl.empty();
	}

	private render() {
		const { contentEl } = this;
		contentEl.empty();

		const isCentered = this.step === 1 || (this.step === 6 && this.state.finishState !== 'error');
		contentEl.toggleClass('agent-wizard-centered', isCentered);

		if (this.step <= TOTAL_STEPS) {
			contentEl.createEl('p', {
				text: t('wizard_step_of', this.state.language, { step: String(this.step), total: String(TOTAL_STEPS) }),
				cls: 'agent-wizard-progress',
			});
		}

		switch (this.step) {
			case 1: renderStep1(contentEl, this.ctx); break;
			case 2: renderStep2(contentEl, this.ctx); break;
			case 3: renderStep3(contentEl, this.ctx); break;
			case 4: renderStep4(contentEl, this.ctx); break;
			case 5: renderStep5(contentEl, this.ctx); break;
			case 6: renderStep6(contentEl, this.ctx); break;
		}
	}
}
