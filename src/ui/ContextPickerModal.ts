import { App, Modal } from 'obsidian';
import type { SessionContextOverride } from '../context/ContextService';
import { FileSuggest } from '../settings/FileSuggest';
import { t } from '../i18n';

export class ContextPickerModal extends Modal {
	private override: SessionContextOverride;

	constructor(
		app: App,
		override: SessionContextOverride,
		private settingsPaths: string[],
		private lang: string,
		private onChange: (override: SessionContextOverride) => void,
	) {
		super(app);
		this.override = {
			extraPaths: [...(override.extraPaths ?? [])],
			removedPaths: [...(override.removedPaths ?? [])],
		};
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: t('ctx_picker_title', this.lang) });
		this.renderBody();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderBody(): void {
		const { contentEl } = this;
		const h2 = contentEl.querySelector('h2');
		while (h2?.nextSibling) h2.nextSibling.remove();

		if (this.settingsPaths.length > 0) {
			contentEl.createEl('h4', { text: t('ctx_picker_settings_heading', this.lang) });
			for (const p of this.settingsPaths) {
				const isRemoved = (this.override.removedPaths ?? []).includes(p);
				const row = contentEl.createDiv({ cls: 'ctx-picker-row' });
				row.createSpan({ text: p, cls: `ctx-picker-path${isRemoved ? ' ctx-picker-path--removed' : ''}` });
				const btn = row.createEl('button', {
					text: isRemoved ? t('ctx_picker_restore', this.lang) : '×',
					cls: 'ctx-picker-remove',
				});
				btn.addEventListener('click', () => {
					if (isRemoved) {
						this.override.removedPaths = (this.override.removedPaths ?? []).filter(x => x !== p);
					} else {
						this.override.removedPaths = [...(this.override.removedPaths ?? []), p];
					}
					this.onChange({ ...this.override });
					this.renderBody();
				});
			}
		}

		contentEl.createEl('h4', { text: t('ctx_picker_extra_heading', this.lang) });
		contentEl.createEl('p', { text: t('ctx_picker_extra_hint', this.lang), cls: 'ctx-picker-hint' });
		for (const p of this.override.extraPaths ?? []) {
			const row = contentEl.createDiv({ cls: 'ctx-picker-row' });
			row.createSpan({ text: p, cls: 'ctx-picker-path' });
			const btn = row.createEl('button', { text: '×', cls: 'ctx-picker-remove' });
			btn.addEventListener('click', () => {
				this.override.extraPaths = (this.override.extraPaths ?? []).filter(x => x !== p);
				this.onChange({ ...this.override });
				this.renderBody();
			});
		}

		const addRow = contentEl.createDiv({ cls: 'ctx-picker-add-row' });
		const input = addRow.createEl('input', {
			cls: 'ctx-picker-input',
			attr: { placeholder: t('ctx_picker_input_placeholder', this.lang) },
		});
		new FileSuggest(this.app, input);

		const addBtn = addRow.createEl('button', {
			text: t('ctx_picker_add_btn', this.lang),
			cls: 'mod-cta ctx-picker-add-btn',
		});

		const addPath = () => {
			const val = input.value.trim();
			if (!val || (this.override.extraPaths ?? []).includes(val)) return;
			this.override.extraPaths = [...(this.override.extraPaths ?? []), val];
			this.onChange({ ...this.override });
			input.value = '';
			this.renderBody();
		};

		addBtn.addEventListener('click', addPath);
		input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addPath(); } });
	}
}
