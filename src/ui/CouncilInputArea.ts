import type { CouncilSession, CouncilQuestionType, SoulMeta } from '../types';
import { LLMError } from '../types';
import { t } from '../i18n';

type InputState = 'A' | 'B' | 'C';

export class CouncilInputArea {
	private state: InputState = 'A';
	private isLoading = false;
	private lastError: string | null = null;
	private selectedSoulId: string;
	private selectedQuestionType: CouncilQuestionType = 'opinion';

	constructor(
		private container: HTMLElement,
		private session: CouncilSession,
		private sessionSouls: SoulMeta[],
		private lang: string,
		private onUserMessage: (content: string) => void,
		private onSoulInvoke: (soulId: string, questionType: CouncilQuestionType) => Promise<void>,
	) {
		const lastSoulMsg = [...session.messages].reverse().find(m => m.author !== 'user');
		this.selectedSoulId = lastSoulMsg?.author ?? sessionSouls[0]?.id ?? '';
		this.render();
	}

	private render(): void {
		this.container.empty();
		if (this.state === 'A') this.renderStateA();
		else if (this.state === 'B') this.renderStateB();
		else this.renderStateC();
	}

	private renderStateA(): void {
		const hasUserMsg = this.session.messages.some(m => m.author === 'user');

		if (this.isLoading) {
			this.container.createDiv({ cls: 'agent-council-loading', text: '●●●' });
		}

		const row = this.container.createDiv({ cls: 'agent-council-state-a' });

		const askBtn = row.createEl('button', {
			text: t('council_ask_soul', this.lang),
			cls: 'agent-council-btn',
		});
		askBtn.disabled = !hasUserMsg || this.isLoading;

		const writeBtn = row.createEl('button', {
			text: t('council_write_message', this.lang),
			cls: 'agent-council-btn',
		});
		writeBtn.disabled = this.isLoading;

		if (!hasUserMsg) {
			this.container.createDiv({
				cls: 'agent-council-hint',
				text: t('council_ask_soul_hint', this.lang),
			});
		}

		if (this.lastError) {
			const errEl = this.container.createDiv({ cls: 'agent-council-error' });
			errEl.createSpan({ text: this.lastError });
			const retryBtn = errEl.createEl('button', {
				text: t('council_retry', this.lang),
				cls: 'agent-council-btn',
			});
			retryBtn.addEventListener('click', () => { this.lastError = null; void this.invokeSoul(); });
		}

		askBtn.addEventListener('click', () => { this.state = 'B'; this.render(); });
		writeBtn.addEventListener('click', () => { this.state = 'C'; this.render(); });
	}

	private renderStateB(): void {
		const soulRow = this.container.createDiv({ cls: 'agent-council-selector-row agent-council-soul-selector' });
		for (const soul of this.sessionSouls) {
			const btn = soulRow.createEl('button', {
				cls: `agent-council-soul-card${soul.id === this.selectedSoulId ? ' is-selected' : ''}`,
			});
			btn.createSpan({ cls: 'agent-council-soul-emoji', text: soul.emoji });
			btn.createSpan({ cls: 'agent-council-soul-name', text: soul.name });
			btn.addEventListener('click', () => { this.selectedSoulId = soul.id; this.render(); });
		}

		const qRow = this.container.createDiv({ cls: 'agent-council-selector-row agent-council-question-selector' });
		const questionTypes: CouncilQuestionType[] = ['opinion', 'critique', 'propose'];
		const qLabels: Record<CouncilQuestionType, string> = {
			opinion:  t('council_question_type_opinion',  this.lang),
			critique: t('council_question_type_critique', this.lang),
			propose:  t('council_question_type_propose',  this.lang),
		};
		for (const qt of questionTypes) {
			const btn = qRow.createEl('button', {
				text: qLabels[qt],
				cls: `agent-council-chip-btn${qt === this.selectedQuestionType ? ' is-selected' : ''}`,
			});
			btn.addEventListener('click', () => { this.selectedQuestionType = qt; this.render(); });
		}

		const actions = this.container.createDiv({ cls: 'agent-council-actions' });
		const backBtn = actions.createEl('button', {
			text: t('council_wizard_back', this.lang),
			cls: 'agent-council-back',
		});
		backBtn.addEventListener('click', () => { this.state = 'A'; this.render(); });

		const submitBtn = actions.createEl('button', {
			text: t('council_submit_ask', this.lang),
			cls: 'mod-cta agent-council-btn',
		});
		submitBtn.disabled = !this.selectedSoulId;
		submitBtn.addEventListener('click', () => void this.invokeSoul());
	}

	private renderStateC(): void {
		const textarea = this.container.createEl('textarea', {
			cls: 'agent-council-textarea agent-council-textarea--compact',
			attr: { placeholder: t('council_write_placeholder', this.lang), rows: '3' },
		});

		const actions = this.container.createDiv({ cls: 'agent-council-actions' });
		const backBtn = actions.createEl('button', {
			text: t('council_wizard_back', this.lang),
			cls: 'agent-council-back',
		});
		backBtn.addEventListener('click', () => { this.state = 'A'; this.render(); });

		const sendBtn = actions.createEl('button', {
			text: t('council_send', this.lang),
			cls: 'mod-cta agent-council-btn',
		});
		sendBtn.disabled = true;

		textarea.addEventListener('input', () => {
			sendBtn.disabled = textarea.value.trim() === '';
		});

		const send = () => {
			const content = textarea.value.trim();
			if (!content) return;
			this.session.messages.push({ author: 'user', content, timestamp: Date.now() });
			this.onUserMessage(content);
			this.state = 'A';
			this.render();
		};

		sendBtn.addEventListener('click', send);
		textarea.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
		});
	}

	private async invokeSoul(): Promise<void> {
		if (!this.selectedSoulId) return;
		this.state = 'A';
		this.isLoading = true;
		this.lastError = null;
		this.render();
		try {
			await this.onSoulInvoke(this.selectedSoulId, this.selectedQuestionType);
		} catch (e) {
			this.lastError = e instanceof LLMError ? e.message : String(e);
		} finally {
			this.isLoading = false;
			this.render();
		}
	}
}
