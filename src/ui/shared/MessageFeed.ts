import { App, Component } from 'obsidian';
import { MessageRenderer } from '../MessageRenderer';

export class MessageFeed {
	readonly el: HTMLElement;
	private renderer: MessageRenderer;

	constructor(container: HTMLElement, app: App, component: Component) {
		this.el = container.createDiv({ cls: 'agent-chat-messages' });
		this.renderer = new MessageRenderer(app, this.el, component);
	}

	append(role: 'user' | 'agent', content: string, emoji?: string, highlighted = false): void {
		this.renderer.append(role, content, emoji, highlighted);
	}

	showLoading(text: string): void {
		this.renderer.showLoading(text);
	}

	removeLoading(): void {
		this.renderer.removeLoading();
	}

	empty(): void {
		this.el.empty();
		this.renderer.removeLoading();
	}
}
