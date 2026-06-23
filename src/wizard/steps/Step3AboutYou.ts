import { Setting } from 'obsidian';
import { t } from '../../i18n';
import type { WizardContext } from '../WizardState';
import { renderNav } from '../wizardHelpers';

export function renderStep3(container: HTMLElement, ctx: WizardContext): void {
	const { state, goTo } = ctx;
	const L = state.language;

	container.createEl('h2', { text: t('wizard_about_you_title', L) });
	container.createEl('p', { text: t('wizard_about_you_desc', L), cls: 'agent-wizard-desc' });

	new Setting(container)
		.setName(t('wizard_work_style_name', L))
		.setDesc(t('wizard_work_style_desc', L))
		.addTextArea(ta => {
			ta.setValue(state.workStyle).setPlaceholder(t('wizard_work_style_ph', L)).onChange(v => { state.workStyle = v; });
			ta.inputEl.rows = 3;
		});

	new Setting(container)
		.setName(t('wizard_comm_prefs_name', L))
		.setDesc(t('wizard_comm_prefs_desc', L))
		.addTextArea(ta => {
			ta.setValue(state.commPreferences).setPlaceholder(t('wizard_comm_prefs_ph', L)).onChange(v => { state.commPreferences = v; });
			ta.inputEl.rows = 3;
		});

	new Setting(container)
		.setName(t('wizard_focus_name', L))
		.setDesc(t('wizard_focus_desc', L))
		.addTextArea(ta => {
			ta.setValue(state.interests).setPlaceholder(t('wizard_focus_ph', L)).onChange(v => { state.interests = v; });
			ta.inputEl.rows = 3;
		});

	new Setting(container)
		.setName(t('wizard_long_term_goals_name', L))
		.setDesc(t('wizard_long_term_goals_desc', L))
		.addTextArea(ta => {
			ta.setValue(state.longTermGoals).setPlaceholder(t('wizard_long_term_goals_ph', L)).onChange(v => { state.longTermGoals = v; });
			ta.inputEl.rows = 3;
		});

	new Setting(container)
		.setName(t('wizard_personal_context_name', L))
		.setDesc(t('wizard_personal_context_desc', L))
		.addTextArea(ta => {
			ta.setValue(state.personalContext).setPlaceholder(t('wizard_personal_context_ph', L)).onChange(v => { state.personalContext = v; });
			ta.inputEl.rows = 3;
		});

	new Setting(container)
		.setName(t('wizard_patterns_to_avoid_name', L))
		.setDesc(t('wizard_patterns_to_avoid_desc', L))
		.addTextArea(ta => {
			ta.setValue(state.patternsToAvoid).setPlaceholder(t('wizard_patterns_to_avoid_ph', L)).onChange(v => { state.patternsToAvoid = v; });
			ta.inputEl.rows = 3;
		});

	renderNav(container, L, () => goTo(2), () => goTo(4));
}
