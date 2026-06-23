export class FinalizeBar {
	private finalizeBtn: HTMLButtonElement;
	private saveBtn: HTMLButtonElement;

	constructor(
		container: HTMLElement,
		finalizeLabel: string,
		saveLabel: string,
		onFinalize: () => void,
		onSave: () => void,
	) {
		this.finalizeBtn = container.createEl('button', {
			text: finalizeLabel,
			cls: 'agent-chat-finalize',
		});
		this.saveBtn = container.createEl('button', {
			text: saveLabel,
			cls: 'agent-chat-save',
		});
		this.finalizeBtn.addEventListener('click', onFinalize);
		this.saveBtn.addEventListener('click', onSave);
	}

	setDisabled(value: boolean): void {
		this.finalizeBtn.disabled = value;
		this.saveBtn.disabled = value;
	}
}
