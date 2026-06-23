import { App, Component, MarkdownRenderer } from 'obsidian';

export class MessageRenderer {
	private loadingEl: HTMLElement | null = null;

	constructor(
		private app: App,
		private container: HTMLElement,
		private component: Component,
	) {}

	append(role: 'user' | 'agent', content: string, emoji?: string, highlighted = false): void {
		const cls = `agent-message agent-message--${role}${highlighted ? ' agent-message--highlighted' : ''}`;
		const msgEl = this.container.createDiv({ cls });
		if (emoji) msgEl.createSpan({ cls: 'agent-message-author', text: emoji });
		const contentEl = msgEl.createDiv({ cls: 'agent-message-content' });
		if (role === 'agent') {
			void MarkdownRenderer.render(this.app, content, contentEl, '', this.component);
		} else {
			contentEl.setText(content);
		}
		this.container.scrollTop = this.container.scrollHeight;
	}

	showLoading(text: string): void {
		this.loadingEl = this.container.createDiv({ cls: 'agent-message agent-message--agent' });
		const contentEl = this.loadingEl.createDiv({ cls: 'agent-message-content agent-message-loading' });
		contentEl.setText(text);
		this.container.scrollTop = this.container.scrollHeight;
	}

	removeLoading(): void {
		if (this.loadingEl) {
			this.loadingEl.remove();
			this.loadingEl = null;
		}
	}
}
