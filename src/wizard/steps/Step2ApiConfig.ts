import { Notice } from 'obsidian';
import { CURATED_MODELS, CUSTOM_MODEL_OPTION, findCuratedModel } from '../../llm/curatedModels';
import { t } from '../../i18n';
import type { WizardContext } from '../WizardState';
import { renderNav } from '../wizardHelpers';

export function renderStep2(container: HTMLElement, ctx: WizardContext): void {
	const { state, goTo } = ctx;
	const L = state.language;

	container.createEl('h2', { text: t('wizard_api_title', L) });
	container.createEl('p', { text: t('wizard_api_desc', L), cls: 'agent-wizard-desc' });

	const apiFieldEl = container.createDiv({ cls: 'agent-wizard-field' });
	apiFieldEl.createEl('label', { text: t('wizard_api_key_name', L), cls: 'agent-wizard-field__label' });
	const apiInput = apiFieldEl.createEl('input', {
		cls: 'agent-wizard-field__input',
		attr: { type: 'password', placeholder: 'sk-or-...' },
	});
	apiInput.value = state.apiKey;
	apiInput.addEventListener('input', () => { state.apiKey = apiInput.value.trim(); });

	const signupEl = container.createDiv({ cls: 'agent-wizard-link-hint' });
	signupEl.createSpan({ text: t('openrouter_no_account', L) + ' ' });
	const signupLink = signupEl.createEl('a', { text: t('openrouter_signup_link', L) });
	signupLink.addEventListener('click', (e) => {
		e.preventDefault();
		window.open('https://openrouter.ai/', '_blank');
	});

	container.createEl('hr', { cls: 'agent-wizard-separator' });
	container.createEl('h3', { text: t('model', L), cls: 'agent-wizard-section-title' });

	const modelDescEl = container.createDiv({ cls: 'agent-wizard-desc' });
	const [descBefore, descAfter] = t('wizard_model_desc', L).split('{zdr}');
	modelDescEl.createSpan({ text: descBefore ?? '' });
	const zdrDescLink = modelDescEl.createEl('a', { text: 'ZDR ✓', cls: 'agent-wizard-zdr-link' });
	zdrDescLink.addEventListener('click', (e) => {
		e.preventDefault();
		window.open('https://openrouter.ai/docs/guides/features/zdr', '_blank');
	});
	modelDescEl.createSpan({ text: descAfter ?? '' });

	const isCustomSlug = !findCuratedModel(state.modelSlug);
	const modelFieldEl = container.createDiv({ cls: 'agent-wizard-field' });
	const modelSelect = modelFieldEl.createEl('select', { cls: 'agent-wizard-field__select dropdown' });
	for (const m of CURATED_MODELS) {
		modelSelect.createEl('option', { text: `${m.displayName} (${m.provider})`, value: m.slug });
	}
	modelSelect.createEl('option', { text: 'Custom…', value: CUSTOM_MODEL_OPTION });
	modelSelect.value = isCustomSlug ? CUSTOM_MODEL_OPTION : state.modelSlug;

	const customFieldEl = container.createDiv({ cls: 'agent-wizard-field' });
	customFieldEl.style.display = isCustomSlug ? '' : 'none';
	customFieldEl.createEl('label', { text: t('custom_model_slug', L), cls: 'agent-wizard-field__label' });
	const customInput = customFieldEl.createEl('input', {
		cls: 'agent-wizard-field__input',
		attr: { type: 'text', placeholder: 'provider/model-name' },
	});
	customInput.value = isCustomSlug ? state.modelSlug : '';
	customInput.addEventListener('input', () => { state.modelSlug = customInput.value.trim(); });

	const modelCardEl = container.createDiv({ cls: 'agent-wizard-model-card' });
	modelCardEl.style.display = isCustomSlug ? 'none' : '';

	const refreshModelCard = (slug: string) => {
		modelCardEl.empty();
		const model = findCuratedModel(slug);
		if (!model) { modelCardEl.style.display = 'none'; return; }
		modelCardEl.style.display = '';
		if (model.zdr) {
			modelCardEl.createSpan({ text: 'ZDR', cls: 'agent-wizard-model-card__zdr' });
		}
		const headerEl = modelCardEl.createDiv({ cls: 'agent-wizard-model-card__header' });
		headerEl.createSpan({ text: `${model.displayName} · ${model.provider}`, cls: 'agent-wizard-model-card__name' });
		modelCardEl.createDiv({
			text: `Input: $${model.inputPricePerM.toFixed(2)} / 1M · Output: $${model.outputPricePerM.toFixed(2)} / 1M`,
			cls: 'agent-wizard-model-card__price',
		});
		modelCardEl.createDiv({ text: model.description, cls: 'agent-wizard-model-card__desc' });
	};

	modelSelect.addEventListener('change', () => {
		const v = modelSelect.value;
		if (v === CUSTOM_MODEL_OPTION) {
			customFieldEl.style.display = '';
			modelCardEl.style.display = 'none';
			modelCardEl.empty();
		} else {
			state.modelSlug = v;
			customFieldEl.style.display = 'none';
			refreshModelCard(v);
		}
	});

	if (!isCustomSlug) refreshModelCard(state.modelSlug);

	renderNav(
		container,
		L,
		() => goTo(1),
		() => {
			if (!state.apiKey) {
				new Notice(t('wizard_api_key_required', L));
				return;
			}
			goTo(3);
		},
	);
}
