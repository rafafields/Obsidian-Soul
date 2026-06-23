import { Setting } from 'obsidian';
import { LANGUAGES, t } from '../../i18n';
import type { WizardContext } from '../WizardState';
import { renderMascot, renderNav } from '../wizardHelpers';

export function renderStep1(container: HTMLElement, ctx: WizardContext): void {
	const { state, plugin, goTo } = ctx;
	const L = state.language;

	renderMascot(container, 'inlove');
	container.createEl('h2', { text: t('wizard_welcome_title', L) });
	container.createEl('p', { text: t('wizard_welcome_desc1', L), cls: 'agent-wizard-desc' });
	container.createEl('p', { text: t('wizard_welcome_desc2', L), cls: 'agent-wizard-desc' });

	new Setting(container)
		.setName(t('language', L))
		.setDesc(t('wizard_welcome_language_desc', L))
		.addDropdown(dd => {
			for (const lang of Object.keys(LANGUAGES)) {
				dd.addOption(lang, lang);
			}
			dd.setValue(state.language).onChange(v => {
				state.language = v;
				plugin.settings.language = v;
				void plugin.saveSettings();
			});
		});

	renderNav(container, L, null, () => goTo(2), t('wizard_get_started', L));
}
