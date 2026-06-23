import { Setting } from 'obsidian';
import { SUGGESTED_TAGS } from '../WizardState';
import { t } from '../../i18n';
import type { WizardContext } from '../WizardState';
import { renderNav } from '../wizardHelpers';
import { runFinish } from '../WizardGeneration';

export function renderStep5(container: HTMLElement, ctx: WizardContext): void {
	const { state, goTo } = ctx;
	const L = state.language;

	container.createEl('h2', { text: t('wizard_tags_title', L) });
	container.createEl('p', { text: t('wizard_tags_desc', L), cls: 'agent-wizard-desc' });

	for (const tag of SUGGESTED_TAGS) {
		new Setting(container)
			.setName(tag)
			.addToggle(toggle => toggle
				.setValue(state.selectedTags.has(tag))
				.onChange(v => {
					if (v) state.selectedTags.add(tag);
					else state.selectedTags.delete(tag);
				}));
	}

	renderNav(
		container,
		L,
		() => goTo(4),
		() => {
			state.finishState = 'loading';
			goTo(6);
			void runFinish(ctx);
		},
		t('finish', L),
	);
}
