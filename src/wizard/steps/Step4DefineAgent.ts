import { Setting } from 'obsidian';
import { t } from '../../i18n';
import { SoulForm } from '../../ui/SoulForm';
import type { WizardContext } from '../WizardState';
import { renderNav } from '../wizardHelpers';

function wizardHasUserContext(state: WizardContext['state']): boolean {
	return !!(
		state.workStyle.trim() || state.commPreferences.trim() || state.interests.trim() ||
		state.longTermGoals.trim() || state.personalContext.trim() || state.patternsToAvoid.trim()
	);
}

export function renderStep4(container: HTMLElement, ctx: WizardContext): void {
	const { state, goTo } = ctx;
	const L = state.language;
	const sel = state.soulSelection;
	const hasContext = wizardHasUserContext(state);

	container.createEl('h2', { text: t('wizard_soul_step_title', L) });
	container.createEl('p', {
		text: hasContext ? t('wizard_soul_step_desc', L) : t('wizard_soul_step_no_user_desc', L),
		cls: 'agent-wizard-desc',
	});

	// Inline warning — shown when nothing is selected
	const warningEl = container.createDiv({ cls: 'agent-wizard-warning' });
	warningEl.setText(t('wizard_soul_none_warning', L));

	const updateWarning = () => {
		warningEl.style.display = (!sel.core && !sel.nemesis && !sel.custom) ? '' : 'none';
	};
	updateWarning();

	// Core toggle
	const coreSetting = new Setting(container)
		.setName(t('soul_gen_core_name', L))
		.setDesc(hasContext ? t('soul_gen_core_desc', L) : t('wizard_requires_about_you', L))
		.addToggle(toggle => {
			toggle.setValue(hasContext && sel.core).setDisabled(!hasContext)
				.onChange(v => { sel.core = v; updateWarning(); });
		});
	if (!hasContext) coreSetting.settingEl.addClass('is-disabled');

	// Nemesis toggle
	const nemesisSetting = new Setting(container)
		.setName(t('soul_gen_nemesis_name', L))
		.setDesc(hasContext ? t('soul_gen_nemesis_desc', L) : t('wizard_requires_about_you', L))
		.addToggle(toggle => {
			toggle.setValue(hasContext && sel.nemesis).setDisabled(!hasContext)
				.onChange(v => { sel.nemesis = v; updateWarning(); });
		});
	if (!hasContext) nemesisSetting.settingEl.addClass('is-disabled');

	// Custom toggle + SoulForm (always rendered, shown/hidden)
	const formEl = container.createDiv({ cls: 'agent-soul-custom-section' });
	const updateFormVisibility = () => {
		formEl.style.display = sel.custom ? '' : 'none';
	};

	new Setting(container)
		.setName(t('soul_gen_custom_name', L))
		.setDesc(t('soul_gen_custom_desc', L))
		.addToggle(toggle => {
			toggle.setValue(sel.custom).onChange(v => {
				sel.custom = v;
				updateFormVisibility();
				updateWarning();
			});
		});

	container.appendChild(formEl);

	new SoulForm(formEl, state.soulFormState, L, {
		name: t('wizard_agent_name_name', L),
		desc: t('wizard_agent_name_desc', L),
		placeholder: 'Agent',
	}).render();

	updateFormVisibility();

	renderNav(container, L, () => goTo(3), () => {
		if (!sel.core && !sel.nemesis && !sel.custom) return; // blocked by inline warning
		if (sel.custom && !state.soulFormState.name.trim()) {
			const nameInput = container.querySelector<HTMLInputElement>('.agent-soul-custom-section input[type="text"]');
			nameInput?.focus();
			return;
		}
		goTo(5);
	});
}
