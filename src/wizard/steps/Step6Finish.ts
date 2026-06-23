import { LoadingScreen } from '../../ui/LoadingScreen';
import { formatCost } from '../../utils/tokens';
import { t } from '../../i18n';
import type { WizardContext } from '../WizardState';
import { renderMascot, renderNav } from '../wizardHelpers';
import { runFinish } from '../WizardGeneration';

export function renderStep6(container: HTMLElement, ctx: WizardContext): void {
	const { state, plugin, goTo, close } = ctx;
	const L = state.language;

	if (state.finishState === 'loading') {
		state.loadingScreen = new LoadingScreen(container, t('wizard_loading_title', L), t('starting', L));
	} else if (state.finishState === 'done') {
		renderMascot(container, 'inlove');
		container.createEl('h2', { text: t('wizard_done_title', L) });

		const soulNames: string[] = [];
		if (state.soulSelection.core) soulNames.push('Core');
		if (state.soulSelection.nemesis) soulNames.push('Nemesis');
		if (state.soulSelection.custom) soulNames.push(state.soulFormState.name || 'Agent');
		if (soulNames.length === 0) soulNames.push(state.soulFormState.name || 'Agent');

		container.createEl('p', {
			text: t('wizard_done_desc', L, { name: soulNames[0] ?? 'Agent', tags: String(state.selectedTags.size) }),
			cls: 'agent-wizard-desc',
		});
		if (soulNames.length > 1) {
			container.createEl('p', {
				text: t('wizard_done_souls', L, { souls: soulNames.join(', ') }),
				cls: 'agent-wizard-desc',
			});
		}
		if (state.generationCost !== null) {
			container.createEl('p', {
				text: t('wizard_done_cost', L, { cost: formatCost(state.generationCost) }),
				cls: 'agent-wizard-desc agent-wizard-cost',
			});
		}
		container.createEl('p', { text: t('wizard_done_open_desc', L), cls: 'agent-wizard-desc' });

		const navEl = container.createDiv({ cls: 'agent-wizard-nav agent-wizard-nav--center' });
		const openBtn = navEl.createEl('button', { text: t('wizard_open_chat', L), cls: 'mod-cta' });
		openBtn.addEventListener('click', () => {
			close();
			plugin.openChatView();
		});
	} else {
		container.createEl('h2', { text: t('wizard_error_title', L) });
		container.createEl('p', {
			text: state.finishError || t('error_unexpected', L),
			cls: 'agent-wizard-desc',
		});

		renderNav(
			container,
			L,
			() => goTo(5),
			() => {
				state.finishState = 'loading';
				goTo(6);
				void runFinish(ctx);
			},
			t('try_again', L),
		);
	}
}
