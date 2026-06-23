import { ItemView, Notice, WorkspaceLeaf } from 'obsidian';
import type MinimalAgentPlugin from '../main';
import { OpenRouterClient } from '../llm/OpenRouterClient';
import { LLMError, type ChatMessage, type SoulMeta } from '../types';
import { calcCost, countTokens } from '../utils/tokens';
import { createMascotImg, type MascotState } from './mascot';
import { SoulGeneratorModal } from '../souls/SoulGeneratorModal';
import { ContextPickerModal } from './ContextPickerModal';
import { DiffModal } from './DiffModal';
import type { SessionContextOverride } from '../context/ContextService';
import { parseEditBlocks, stripEditBlocks, computeDiff } from '../context/FileEditParser';
import { t } from '../i18n';
import { LoadingScreen } from './LoadingScreen';
import { LOADING_PHRASES } from './loadingPhrases';
import { IdleTimer } from './IdleTimer';
import { MessageFeed } from './shared/MessageFeed';
import { SessionStatsBar } from './shared/SessionStatsBar';
import { FinalizeBar } from './shared/FinalizeBar';

export const CHAT_VIEW_TYPE = 'agent-chat';

export class ChatView extends ItemView {
	private transcript: ChatMessage[] = [];
	private sessionOverride: SessionContextOverride = {};
	private activeSoulId: string;
	private soulDisplayName = 'Agent';
	private soulsCache: SoulMeta[] = [];
	private headerNameEl!: HTMLElement;
	private idleTimer = new IdleTimer(() => void this.finalizeSession());

	private isProcessing = false;
	private finalizationInProgress = false;

	private chatEl!: HTMLElement;
	private finalizingEl!: HTMLElement;
	private finalizingScreen!: LoadingScreen;
	private messageFeed!: MessageFeed;
	private statsBar!: SessionStatsBar;
	private finalizeBar!: FinalizeBar;
	private textareaEl!: HTMLTextAreaElement;
	private sendBtn!: HTMLButtonElement;
	private ctxBtnLabelEl!: HTMLSpanElement;
	private soulDropdownEl: HTMLElement | null = null;
	private setMascotState!: (state: MascotState) => void;
	private setMascotEmoji!: (emoji: string) => void;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: MinimalAgentPlugin,
	) {
		super(leaf);
		this.activeSoulId = plugin.settings.defaultSoul || 'default';
	}

	getViewType(): string { return CHAT_VIEW_TYPE; }
	getDisplayText(): string { return this.soulDisplayName; }
	getIcon(): string { return 'message-square'; }

	async onOpen(): Promise<void> {
		const root = this.containerEl.children[1] as HTMLElement;
		root.empty();
		root.addClass('agent-chat-container');

		// — Finalizing loading screen (hidden by default) —
		this.finalizingEl = root.createDiv({ cls: 'agent-finalizing' });
		this.finalizingEl.hide();
		const uiLang = this.plugin.settings.language;
		this.finalizingScreen = new LoadingScreen(
			this.finalizingEl,
			t('chat_saving_session', uiLang),
			t('chat_extracting_memories', uiLang),
		);

		// — Main chat wrapper —
		this.chatEl = root.createDiv({ cls: 'agent-chat-body' });

		// — Mascot header —
		const headerEl = this.chatEl.createDiv({ cls: 'agent-chat-header' });
		const { setState, setEmoji } = createMascotImg(headerEl, 'idle');
		this.setMascotState = setState;
		this.setMascotEmoji = setEmoji;
		this.headerNameEl = headerEl.createDiv({ cls: 'agent-chat-header-name', text: this.soulDisplayName });

		// Soul selector
		const soulWrapEl = headerEl.createDiv({ cls: 'agent-soul-selector-wrap' });
		const lang = this.plugin.settings.language;

		const switchSoulBtn = soulWrapEl.createEl('button', {
			text: '▾',
			cls: 'agent-soul-switch-btn',
			attr: { title: t('chat_switch_soul_title', lang) },
		});
		switchSoulBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.toggleSoulDropdown(switchSoulBtn);
		});

		const soulAddBtn = soulWrapEl.createEl('button', { text: '+', cls: 'agent-soul-add-btn', attr: { title: t('chat_create_soul_title', lang) } });
		soulAddBtn.addEventListener('click', () => {
			new SoulGeneratorModal(
				this.app,
				this.plugin.vaultManager,
				this.plugin.parser,
				this.plugin.settings.apiKey,
				this.plugin.settings.modelSlug,
				(id) => { void this.refreshSoulSelector(id); },
				lang,
			).open();
		});

		void this.refreshSoulSelector(null);

		this.statsBar = new SessionStatsBar(headerEl);
		this.messageFeed = new MessageFeed(this.chatEl, this.app, this);

		const footerEl = this.chatEl.createDiv({ cls: 'agent-chat-footer' });

		const composerEl = footerEl.createDiv({ cls: 'agent-chat-composer' });
		this.textareaEl = composerEl.createEl('textarea', {
			cls: 'agent-chat-input',
			attr: { placeholder: t('chat_input_placeholder', lang), rows: '3' },
		});
		this.sendBtn = composerEl.createEl('button', {
			cls: 'agent-chat-send',
			attr: { title: t('chat_context_btn_title', lang), 'aria-label': t('chat_context_btn_title', lang) },
		});
		this.sendBtn.createEl('span', { text: '+', cls: 'agent-chat-send-icon' });
		this.ctxBtnLabelEl = this.sendBtn.createEl('span', { text: '0', cls: 'agent-chat-send-label' });

		const actionsEl = footerEl.createDiv({ cls: 'agent-chat-actions' });
		this.finalizeBar = new FinalizeBar(
			actionsEl,
			t('chat_finalize', lang),
			t('chat_save', lang),
			() => { void this.finalizeSession(); },
			() => { void this.saveChat(); },
		);

		this.sendBtn.addEventListener('click', () => { this.openContextPicker(this.sendBtn); });
		this.textareaEl.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
				e.preventDefault();
				void this.handleSend();
			}
		});
	}

	async onClose(): Promise<void> {
		this.idleTimer.clear();
		this.sessionOverride.extraPaths = [];
	}

	// — Soul selector —

	private async refreshSoulSelector(selectId: string | null): Promise<void> {
		const souls = await this.plugin.soulManager.listSouls();
		this.soulsCache = souls;
		if (souls.length === 0) return;

		const target = selectId ?? this.activeSoulId;
		const exists = souls.some(s => s.id === target);
		this.activeSoulId = exists ? target : (souls[0]?.id ?? 'default');

		const activeSoul = souls.find(s => s.id === this.activeSoulId);
		if (activeSoul) {
			this.soulDisplayName = activeSoul.name;
			this.headerNameEl.setText(activeSoul.name);
			this.setMascotEmoji(activeSoul.emoji);
		}

		void this.refreshContextPreview();
	}

	private toggleSoulDropdown(anchorEl: HTMLElement): void {
		if (this.soulDropdownEl) {
			this.soulDropdownEl.remove();
			this.soulDropdownEl = null;
			return;
		}
		if (this.soulsCache.length === 0) return;

		const dropdown = document.body.createDiv({ cls: 'agent-soul-dropdown' });
		this.soulDropdownEl = dropdown;

		for (const soul of this.soulsCache) {
			const item = dropdown.createDiv({
				cls: `agent-soul-dropdown-item${soul.id === this.activeSoulId ? ' is-active' : ''}`,
				text: `${soul.emoji} ${soul.name}`,
			});
			item.addEventListener('click', () => {
				this.activeSoulId = soul.id;
				this.soulDisplayName = soul.name;
				this.headerNameEl.setText(soul.name);
				this.setMascotEmoji(soul.emoji);
				dropdown.remove();
				this.soulDropdownEl = null;
			});
		}

		const rect = anchorEl.getBoundingClientRect();
		dropdown.style.top = `${rect.bottom + 4}px`;
		dropdown.style.left = `${rect.left}px`;

		const close = (e: MouseEvent) => {
			if (!dropdown.contains(e.target as Node)) {
				dropdown.remove();
				this.soulDropdownEl = null;
				document.removeEventListener('click', close);
			}
		};
		setTimeout(() => document.addEventListener('click', close), 0);
	}

	// — Send flow —

	private async handleSend(): Promise<void> {
		const text = this.textareaEl.value.trim();
		if (!text || this.isProcessing) return;
		this.textareaEl.value = '';
		await this.sendMessage(text);
	}

	private async sendMessage(userText: string): Promise<void> {
		this.setProcessing(true);
		this.messageFeed.append('user', userText);
		this.transcript.push({ role: 'user', content: userText });
		this.messageFeed.showLoading(t('chat_thinking', this.plugin.settings.language, { name: this.soulDisplayName }));

		try {
			const result = await this.plugin.contextService.assemble(this.activeSoulId, this.sessionOverride);

			const language = this.plugin.settings.language;
			const systemPrompt = this.buildSystemPrompt(result.blocks, language);

			const messages: ChatMessage[] = [
				{ role: 'system', content: systemPrompt },
				...this.transcript,
			];

			const contextTokens = result.totalTokens;
			const transcriptTokens = this.transcript.reduce((s, m) => s + countTokens(m.content), 0);
			const extraCount = (this.sessionOverride.extraPaths?.length ?? 0) + (this.sessionOverride.removedPaths?.length ?? 0);
			this.statsBar.update({ contextTokens, transcriptTokens, droppedItems: result.droppedItems, extraCount });

			const activeSoul = this.soulsCache.find(s => s.id === this.activeSoulId);
			const modelSlug = activeSoul?.model_slug || this.plugin.settings.modelSlug;
			const client = new OpenRouterClient(
				this.plugin.settings.apiKey,
				modelSlug,
			);
			const { content: response, usage } = await client.chat(messages);

			this.messageFeed.removeLoading();

			const editBlocks = parseEditBlocks(response);
			const displayResponse = editBlocks.length > 0 ? stripEditBlocks(response) : response;
			this.transcript.push({ role: 'assistant', content: response });
			this.messageFeed.append('agent', displayResponse);

			if (editBlocks.length > 0) {
				void this.handleEditBlocks(editBlocks, result.blocks.map(b => b.filePath));
			}

			await this.plugin.sessionManager.updateActiveMdFromTurn(response);
			this.idleTimer.reset(this.plugin.settings.idleTimeoutMinutes);

			// Append cost estimate to status line once pricing resolves (usually cached)
			void this.plugin.getModelPricing().then(pricing => {
				if (!pricing) return;
				const cost = calcCost(usage.promptTokens, usage.completionTokens, pricing.promptPerToken, pricing.completionPerToken);
				this.statsBar.update({ contextTokens, transcriptTokens, droppedItems: result.droppedItems, extraCount, cost });
			});

		} catch (e) {
			this.messageFeed.removeLoading();
			const msg = e instanceof LLMError ? e.message : String(e);
			new Notice(t('chat_agent_error', this.plugin.settings.language, { msg }));
			this.transcript.pop(); // remove failed user turn
		} finally {
			this.setProcessing(false);
		}
	}

	// — DOM helpers —

	private setProcessing(value: boolean): void {
		this.isProcessing = value;
		this.textareaEl.disabled = value;
		this.finalizeBar.setDisabled(value);
		this.setMascotState(value ? 'thinking' : (this.transcript.length > 0 ? 'blink' : 'idle'));
	}

	private updateCtxBtnLabel(): void {
		const count = this.sessionOverride.extraPaths?.length ?? 0;
		this.ctxBtnLabelEl.setText(String(count));
	}

	// — Save conversation —

	private async saveChat(): Promise<void> {
		if (this.transcript.length === 0) return;

		const now = new Date();
		const date = now.toISOString().slice(0, 10);
		const timeParts = now.toISOString().slice(11, 16); // HH:MM
		const fileTime = timeParts.replace(':', '-');       // HH-MM (safe for filenames)
		const displayTime = timeParts;                      // HH:MM (for display)

		const lines: string[] = [
			`# Chat · ${date} ${displayTime}`,
			'',
		];

		for (const msg of this.transcript) {
			const speaker = msg.role === 'user' ? 'You' : this.soulDisplayName;
			lines.push(`**${speaker}**`, '', msg.content.trim(), '', '---', '');
		}

		// Remove the trailing separator
		while (lines.length > 0 && (lines[lines.length - 1] === '' || lines[lines.length - 1] === '---')) {
			lines.pop();
		}

		const path = `chats/${date} ${fileTime}.md`;
		await this.plugin.vaultManager.writeFile(path, lines.join('\n'));
		new Notice(t('chat_saved_notice', this.plugin.settings.language, { path }));
	}

	// — System prompt —

	private buildSystemPrompt(blocks: import('../types').ContextBlock[], language: string): string {
		const coreBlocks = blocks.filter(b => b.layer !== 'pinned');
		const pinnedBlocks = blocks.filter(b => b.layer === 'pinned');

		const coreSection = coreBlocks
			.map(b => `<!-- ${b.filePath} -->\n${b.content}`)
			.join('\n\n---\n\n');

		const pinnedSection = pinnedBlocks.length > 0
			? '\n\n---\n\n# Attached files (user-provided for this session)\n\n'
				+ pinnedBlocks.map(b => `<!-- ${b.filePath} -->\n${b.content}`).join('\n\n---\n\n')
			: '';

		const editInstruction = [
			'',
			'---',
			'',
			'When the user asks you to modify a file that is in your context above, propose the full updated content using this exact format:',
			'',
			'```edit:path/to/file.md',
			'[complete updated file content]',
			'```',
			'',
			'If the user asks to modify a file that is NOT in your context, ask them to attach it using the ⊕ button.',
			'',
			`Always respond in ${language}.`,
		].join('\n');

		return coreSection + pinnedSection + editInstruction;
	}

	// — File edit handling —

	private async handleEditBlocks(
		blocks: import('../context/FileEditParser').EditBlock[],
		contextPaths: string[],
	): Promise<void> {
		const lang = this.plugin.settings.language;
		for (const block of blocks) {
			const original = await this.plugin.vaultManager.readFile(block.path);
			if (original === null) continue;

			const diff = computeDiff(original, block.content);
			const hasChanges = diff.some(l => l.kind !== 'equal');
			if (!hasChanges) continue;

			void contextPaths; // available if future validation needed
			new DiffModal(this.app, block.path, diff, lang, async () => {
				await this.plugin.vaultManager.writeFile(block.path, block.content);
				new Notice(t('diff_applied_notice', lang, { path: block.path }));
			}).open();
		}
	}

	// — Context status helpers —

	private async refreshContextPreview(): Promise<void> {
		if (this.isProcessing) return;
		try {
			const result = await this.plugin.contextService.assemble(this.activeSoulId, this.sessionOverride);
			if (this.isProcessing) return;
			const transcriptTokens = this.transcript.reduce((s, m) => s + countTokens(m.content), 0);
			const extraCount = (this.sessionOverride.extraPaths?.length ?? 0) + (this.sessionOverride.removedPaths?.length ?? 0);
			this.statsBar.update({ contextTokens: result.totalTokens, transcriptTokens, droppedItems: result.droppedItems, extraCount });
		} catch {
			// preview is best-effort
		}
	}

	// — Session context picker —

	private openContextPicker(_anchorEl: HTMLElement): void {
		const lang = this.plugin.settings.language;
		new ContextPickerModal(
			this.app,
			this.sessionOverride,
			this.plugin.settings.additionalContextPaths,
			lang,
			(override) => {
				this.sessionOverride = override;
				this.updateCtxBtnLabel();
				void this.refreshContextPreview();
			},
		).open();
	}

	// — Session finalization —

	async finalizeSession(): Promise<void> {
		if (this.transcript.length === 0 || this.finalizationInProgress) return;
		this.finalizationInProgress = true;
		this.idleTimer.clear();

		const activeSoul = this.soulsCache.find(s => s.id === this.activeSoulId);
		if (activeSoul) this.finalizingScreen.setEmoji(activeSoul.emoji);
		const soulPhrases = activeSoul?.loading_phrases ?? [];
		if (soulPhrases.length > 0) this.finalizingScreen.startPhrases(soulPhrases);
		this.finalizingScreen.startStatusPhrases(LOADING_PHRASES);

		this.chatEl.hide();
		this.finalizingEl.show();

		try {
			const soul = this.soulsCache.find(s => s.id === this.activeSoulId)
				?? { id: this.activeSoulId, name: this.soulDisplayName, emoji: '', path: '' };
			await this.plugin.sessionManager.finalizeSession(this.transcript, [soul]);
			this.transcript = [];
			this.sessionOverride.extraPaths = [];
			this.messageFeed.empty();
			this.statsBar.clear();
			this.updateCtxBtnLabel();
			this.setMascotState('idle');
		} finally {
			this.finalizingScreen.stopPhrases();
			this.finalizingScreen.stopStatusPhrases();
			this.finalizationInProgress = false;
			this.finalizingEl.hide();
			this.chatEl.show();
		}
	}

}
