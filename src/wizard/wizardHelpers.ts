import { createMascotImg, type MascotState } from '../ui/mascot';
import { t } from '../i18n';

export function renderMascot(container: HTMLElement, state: MascotState): void {
	const wrapper = container.createDiv({ cls: 'agent-wizard-mascot' });
	createMascotImg(wrapper, state, 'agent-wizard-mascot-img');
}

export function renderNav(
	container: HTMLElement,
	language: string,
	onBack: (() => void) | null,
	onNext: (() => void) | null,
	nextLabel?: string,
): void {
	nextLabel ??= t('next', language);
	const hasBoth = !!onBack && !!onNext;
	const navEl = container.createDiv({
		cls: 'agent-wizard-nav' + (hasBoth ? ' agent-wizard-nav--split' : ''),
	});

	if (onBack) {
		const backBtn = navEl.createEl('button', { text: t('back', language) });
		backBtn.addEventListener('click', onBack);
	}

	if (onNext) {
		const nextBtn = navEl.createEl('button', { text: nextLabel, cls: 'mod-cta' });
		nextBtn.addEventListener('click', onNext);
	}
}
