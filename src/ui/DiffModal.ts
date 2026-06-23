import { App, Modal } from 'obsidian';
import type { DiffLine } from '../context/FileEditParser';
import { t } from '../i18n';

export class DiffModal extends Modal {
	constructor(
		app: App,
		private filePath: string,
		private diff: DiffLine[],
		private lang: string,
		private onConfirm: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('diff-modal');

		contentEl.createEl('h2', { text: t('diff_modal_title', this.lang, { path: this.filePath }) });

		const diffEl = contentEl.createDiv({ cls: 'diff-modal-body' });

		for (const line of this.diff) {
			const lineEl = diffEl.createDiv({ cls: `diff-line diff-line--${line.kind}` });
			const prefix = line.kind === 'add' ? '+' : line.kind === 'remove' ? '-' : ' ';
			lineEl.createSpan({ cls: 'diff-line-prefix', text: prefix });
			lineEl.createSpan({ cls: 'diff-line-text', text: line.text });
		}

		const navEl = contentEl.createDiv({ cls: 'diff-modal-nav' });
		const discardBtn = navEl.createEl('button', { text: t('diff_modal_discard', this.lang) });
		discardBtn.addEventListener('click', () => { this.close(); });

		const confirmBtn = navEl.createEl('button', {
			text: t('diff_modal_confirm', this.lang),
			cls: 'mod-cta',
		});
		confirmBtn.addEventListener('click', () => {
			this.close();
			this.onConfirm();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
