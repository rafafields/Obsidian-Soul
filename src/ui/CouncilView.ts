import { ItemView, Notice, WorkspaceLeaf } from 'obsidian';
import type MinimalAgentPlugin from '../main';
import { LLMError, type ChatMessage, type CouncilQuestionType, type CouncilSession, type SoulMeta, type SoulThread } from '../types';
import { OpenRouterClient } from '../llm/OpenRouterClient';
import { calcCost } from '../utils/tokens';
import { buildContext, QUESTION_TYPE_LABELS } from '../council/buildContext';
import { MessageFeed } from './shared/MessageFeed';
import { SessionStatsBar } from './shared/SessionStatsBar';
import { FinalizeBar } from './shared/FinalizeBar';
import { CouncilInputArea } from './CouncilInputArea';
import { LoadingScreen } from './LoadingScreen';
import { LOADING_PHRASES } from './loadingPhrases';
import { t } from '../i18n';

export const COUNCIL_VIEW_TYPE = 'soul-council';
const SESSION_DIR = '_system/council-sessions';

type WizardStep = 1 | 2 | 3;

export class CouncilView extends ItemView {
	private session: CouncilSession | null = null;
	private sessionSouls: SoulMeta[] = [];

	private wizardStep: WizardStep = 1;
	private wizardTopic = '';
	private wizardSelectedSouls = new Set<string>();

	private messageFeed: MessageFeed | null = null;
	private statsBar: SessionStatsBar | null = null;
	private finalizationInProgress = false;

	constructor(leaf: WorkspaceLeaf, private plugin: MinimalAgentPlugin) {
		super(leaf);
	}

	getViewType(): string { return COUNCIL_VIEW_TYPE; }
	getDisplayText(): string { return 'Soul Council'; }
	getIcon(): string { return 'users'; }

	async onOpen(): Promise<void> {
		await this.restoreSession();
		await this.render();
	}

	private async render(): Promise<void> {
		const root = this.containerEl.children[1] as HTMLElement;
		root.empty();
		root.addClass('agent-council-container');
		if (this.session) {
			this.renderSession(root);
		} else {
			await this.renderWizard(root);
		}
	}

	// ─── Wizard ─────────────────────────────────────────────────────────────

	private async renderWizard(root: HTMLElement): Promise<void> {
		const lang = this.plugin.settings.language;
		if (this.wizardStep === 1 && this.plugin.settings.skipCouncilIntro) {
			this.wizardStep = 2;
		}
		const wrap = root.createDiv({ cls: 'agent-council-wizard' });
		if (this.wizardStep === 1) {
			this.renderStep1(wrap, lang);
		} else if (this.wizardStep === 2) {
			this.renderStep2(wrap, lang);
		} else {
			await this.renderStep3(wrap, lang);
		}
	}

	private renderStep1(wrap: HTMLElement, lang: string): void {
		wrap.createEl('h2', { text: t('council_wizard_title', lang) });
		wrap.createEl('p', { text: t('council_wizard_intro_body', lang), cls: 'agent-council-intro' });

		const checkRow = wrap.createDiv({ cls: 'agent-council-check-row' });
		const checkbox = checkRow.createEl('input', { attr: { type: 'checkbox' } });
		checkbox.checked = this.plugin.settings.skipCouncilIntro;
		checkRow.createEl('label', { text: t('council_wizard_skip_intro', lang) });
		checkbox.addEventListener('change', () => {
			this.plugin.settings.skipCouncilIntro = checkbox.checked;
			void this.plugin.saveSettings();
		});

		const actions = wrap.createDiv({ cls: 'agent-council-actions' });
		const nextBtn = actions.createEl('button', {
			text: t('council_wizard_next', lang),
			cls: 'mod-cta agent-council-btn',
		});
		nextBtn.addEventListener('click', () => { this.wizardStep = 2; void this.render(); });
	}

	private renderStep2(wrap: HTMLElement, lang: string): void {
		wrap.createEl('h2', { text: t('council_wizard_topic_title', lang) });

		const textarea = wrap.createEl('textarea', {
			cls: 'agent-council-textarea',
			attr: { placeholder: t('council_wizard_topic_placeholder', lang), rows: '5' },
		});
		textarea.value = this.wizardTopic;

		const actions = wrap.createDiv({ cls: 'agent-council-actions' });
		if (!this.plugin.settings.skipCouncilIntro) {
			const backBtn = actions.createEl('button', {
				text: t('council_wizard_back', lang),
				cls: 'agent-council-back',
			});
			backBtn.addEventListener('click', () => { this.wizardStep = 1; void this.render(); });
		}
		const nextBtn = actions.createEl('button', {
			text: t('council_wizard_next', lang),
			cls: 'mod-cta agent-council-btn',
		});
		nextBtn.disabled = this.wizardTopic.trim() === '';

		textarea.addEventListener('input', () => {
			this.wizardTopic = textarea.value;
			nextBtn.disabled = this.wizardTopic.trim() === '';
		});
		nextBtn.addEventListener('click', () => { this.wizardStep = 3; void this.render(); });
	}

	private async renderStep3(wrap: HTMLElement, lang: string): Promise<void> {
		wrap.createEl('h2', { text: t('council_wizard_souls_title', lang) });
		wrap.createEl('p', { text: t('council_wizard_souls_hint', lang), cls: 'agent-council-hint' });

		const souls = await this.plugin.soulManager.listSouls();
		const grid = wrap.createDiv({ cls: 'agent-council-soul-grid' });

		const updateCreateBtn = () => {
			createBtn.disabled = this.wizardSelectedSouls.size < 2 || this.wizardSelectedSouls.size > 5;
		};

		for (const soul of souls) {
			const selected = this.wizardSelectedSouls.has(soul.id);
			const card = grid.createDiv({ cls: `agent-council-soul-card${selected ? ' is-selected' : ''}` });
			card.createSpan({ cls: 'agent-council-soul-emoji', text: soul.emoji });
			card.createSpan({ cls: 'agent-council-soul-name', text: soul.name });
			card.addEventListener('click', () => {
				if (this.wizardSelectedSouls.has(soul.id)) {
					this.wizardSelectedSouls.delete(soul.id);
				} else {
					this.wizardSelectedSouls.add(soul.id);
				}
				card.toggleClass('is-selected', this.wizardSelectedSouls.has(soul.id));
				updateCreateBtn();
			});
		}

		const actions = wrap.createDiv({ cls: 'agent-council-actions' });
		const backBtn = actions.createEl('button', {
			text: t('council_wizard_back', lang),
			cls: 'agent-council-back',
		});
		backBtn.addEventListener('click', () => { this.wizardStep = 2; void this.render(); });

		const createBtn = actions.createEl('button', {
			text: t('council_wizard_create', lang),
			cls: 'mod-cta agent-council-btn',
		});
		updateCreateBtn();
		createBtn.addEventListener('click', () => void this.createSession(souls));
	}

	private async createSession(allSouls: SoulMeta[]): Promise<void> {
		const selectedSouls = allSouls.filter(s => this.wizardSelectedSouls.has(s.id));
		const threads: Record<string, SoulThread> = {};

		for (const soul of selectedSouls) {
			const content = await this.plugin.soulManager.getSoulContent(soul.id);
			threads[soul.id] = { soulId: soul.id, emoji: soul.emoji, systemPrompt: content ?? '' };
		}

		const message = this.wizardTopic.trim();
		this.session = {
			sessionId: crypto.randomUUID(),
			title: message.slice(0, 60),
			createdAt: Date.now(),
			messages: [{ author: 'user', content: message, timestamp: Date.now() }],
			threads,
			tokenCount: 0,
			estimatedCost: 0,
		};
		this.sessionSouls = selectedSouls;

		await this.render();
	}

	// ─── Session view ────────────────────────────────────────────────────────

	private renderSession(root: HTMLElement): void {
		if (!this.session) return;
		const lang = this.plugin.settings.language;

		// Finalizing overlay (hidden by default)
		const finalizingEl = root.createDiv({ cls: 'agent-finalizing' });
		finalizingEl.hide();
		const loadingScreen = new LoadingScreen(
			finalizingEl,
			t('council_saving', lang),
			t('council_extracting', lang),
		);

		// Main session body
		const bodyEl = root.createDiv({ cls: 'agent-council-body' });

		// Header
		const header = bodyEl.createDiv({ cls: 'agent-council-header' });
		header.createDiv({ cls: 'agent-council-title', text: this.session.title });

		const chipsEl = header.createDiv({ cls: 'agent-council-chips' });
		for (const soul of this.sessionSouls) {
			const chip = chipsEl.createDiv({ cls: 'agent-council-chip' });
			chip.createSpan({ text: soul.emoji });
			chip.createSpan({ text: soul.name });
		}

		this.statsBar = new SessionStatsBar(header);
		this.statsBar.update({ contextTokens: 0, transcriptTokens: 0, droppedItems: 0, cost: 0 });

		// Message feed — render all messages (first user message highlighted)
		this.messageFeed = new MessageFeed(bodyEl, this.app, this);
		for (const [i, msg] of this.session.messages.entries()) {
			if (msg.author === 'user') {
				this.messageFeed.append('user', msg.content, undefined, i === 0);
			} else {
				const soul = this.sessionSouls.find(s => s.id === msg.author);
				this.messageFeed.append('agent', msg.content, soul?.emoji);
			}
		}

		// Finalize bar
		new FinalizeBar(
			bodyEl.createDiv({ cls: 'agent-council-actions agent-council-finalize-row' }),
			t('council_finalize', lang),
			t('council_save', lang),
			() => void this.finalizeCouncil(true, finalizingEl, loadingScreen, bodyEl),
			() => void this.finalizeCouncil(false, finalizingEl, loadingScreen, bodyEl),
		);

		// Input area
		const inputEl = bodyEl.createDiv({ cls: 'agent-council-input' });
		const feed = this.messageFeed;
		new CouncilInputArea(
			inputEl,
			this.session,
			this.sessionSouls,
			lang,
			(content) => { feed.append('user', content); },
			(soulId, questionType) => this.invokeCouncilSoul(soulId, questionType),
		);
	}

	// ─── Persistence ────────────────────────────────────────────────────────

	private async saveSession(): Promise<void> {
		if (!this.session) return;
		const path = `${SESSION_DIR}/${this.session.sessionId}.json`;
		await this.plugin.vaultManager.writeFile(path, JSON.stringify(this.session));
	}

	private async restoreSession(): Promise<void> {
		const files = this.plugin.vaultManager.listFiles(SESSION_DIR);
		const jsonFiles = files.filter(f => f.endsWith('.json'));
		if (jsonFiles.length === 0) return;

		if (jsonFiles.length > 1) {
			console.warn('[council] Multiple session files found — loading newest.');
		}

		const parsed: CouncilSession[] = [];
		for (const f of jsonFiles) {
			const raw = await this.plugin.vaultManager.readFile(f);
			if (!raw) continue;
			try { parsed.push(JSON.parse(raw) as CouncilSession); } catch { /* skip malformed */ }
		}
		if (parsed.length === 0) return;

		const newest = parsed.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
		this.session = newest;

		// Reconstruct sessionSouls from threads — prefer live soul data for display name
		const allSouls = await this.plugin.soulManager.listSouls();
		this.sessionSouls = Object.values(newest.threads).map(thread => {
			const live = allSouls.find(s => s.id === thread.soulId);
			return live ?? {
				id: thread.soulId,
				name: thread.soulId,
				emoji: thread.emoji,
				path: `_agent/souls/${thread.soulId}.md`,
			};
		});
	}

	// ─── LLM invocation ──────────────────────────────────────────────────────

	// ─── Finalization ────────────────────────────────────────────────────────

	private async finalizeCouncil(
		withMemory: boolean,
		finalizingEl: HTMLElement,
		loadingScreen: LoadingScreen,
		bodyEl: HTMLElement,
	): Promise<void> {
		if (!this.session || this.finalizationInProgress) return;
		this.finalizationInProgress = true;

		const lang = this.plugin.settings.language;
		const session = this.session;

		if (!withMemory) {
			// Snapshot only — write note, show notice, leave session open
			try {
				const notePath = await this.writeCouncilNote(session);
				new Notice(t('council_saved_notice', lang, { path: notePath }));
			} finally {
				this.finalizationInProgress = false;
			}
			return;
		}

		bodyEl.hide();
		finalizingEl.show();
		loadingScreen.startStatusPhrases(LOADING_PHRASES);

		try {
			// Export Markdown note
			const notePath = await this.writeCouncilNote(session);

			// Convert to ChatMessage[] transcript for memory pipeline
			const transcript = this.buildCouncilTranscript(session);
			await this.plugin.sessionManager.finalizeSession(transcript, this.sessionSouls);

			// Delete persisted session file
			const sessionPath = `${SESSION_DIR}/${session.sessionId}.json`;
			await this.plugin.vaultManager.deleteFile(sessionPath);

			new Notice(t('council_saved_notice', lang, { path: notePath }));

			// Reset to wizard
			this.session = null;
			this.sessionSouls = [];
			this.wizardStep = 1;
			this.wizardTopic = '';
			this.wizardSelectedSouls = new Set();
			this.messageFeed = null;
			this.statsBar = null;
		} finally {
			loadingScreen.stopStatusPhrases();
			this.finalizationInProgress = false;
			await this.render();
		}
	}

	private async writeCouncilNote(session: CouncilSession): Promise<string> {
		const now = new Date();
		const date = now.toISOString().slice(0, 10);
		const time = now.toISOString().slice(11, 16).replace(':', '-');
		const path = `chats/council-${date}-${time}.md`;

		const soulLine = this.sessionSouls.map(s => `${s.emoji} ${s.name}`).join(', ');
		const lines: string[] = [
			`# Council: ${session.title}`,
			`_${date} · ${soulLine}_`,
			'',
		];

		for (const msg of session.messages) {
			if (msg.author === 'user') {
				lines.push(`**[[user]]** ${msg.content}`, '');
			} else {
				const soul = this.sessionSouls.find(s => s.id === msg.author);
				const emoji = soul?.emoji ?? '';
				const name = soul?.name ?? msg.author;
				lines.push(`**${emoji} [[${name}]]** ${msg.content}`, '');
			}
		}

		await this.plugin.vaultManager.writeFile(path, lines.join('\n'));
		return path;
	}

	private buildCouncilTranscript(session: CouncilSession): ChatMessage[] {
		return session.messages.map(msg => {
			if (msg.author === 'user') {
				return { role: 'user' as const, content: msg.content };
			}
			return { role: 'assistant' as const, content: `[${msg.author}]: ${msg.content}` };
		});
	}

	// ─── LLM invocation ──────────────────────────────────────────────────────

	private async invokeCouncilSoul(soulId: string, questionType: CouncilQuestionType): Promise<void> {
		if (!this.session) return;
		await this.saveSession();
		const lang = this.plugin.settings.language;

		const { system, messages } = buildContext(soulId, this.session, questionType, lang, this.plugin.settings.councilResponseLength);
		const llmMessages: ChatMessage[] = [{ role: 'system', content: system }, ...messages];

		const soul = this.sessionSouls.find(s => s.id === soulId);

		const questionLabel = t(QUESTION_TYPE_LABELS[questionType], lang);
		const bubbleText = soul
			? `@${soul.emoji}${soul.name} — ${questionLabel}`
			: questionLabel;
		this.messageFeed?.append('user', bubbleText);

		const modelSlug = soul?.model_slug ?? this.plugin.settings.modelSlug;
		const client = new OpenRouterClient(this.plugin.settings.apiKey, modelSlug);

		const { content, usage } = await client.chat(llmMessages);

		this.session.messages.push({ author: soulId, content, timestamp: Date.now() });
		this.session.tokenCount += usage.promptTokens + usage.completionTokens;

		this.statsBar?.update({ contextTokens: this.session.tokenCount, transcriptTokens: 0, droppedItems: 0 });
		this.messageFeed?.append('agent', content, soul?.emoji);

		void this.plugin.getModelPricing().then(pricing => {
			if (!pricing || !this.session) return;
			this.session.estimatedCost += calcCost(
				usage.promptTokens, usage.completionTokens,
				pricing.promptPerToken, pricing.completionPerToken,
			);
			this.statsBar?.update({
				contextTokens: this.session.tokenCount,
				transcriptTokens: 0,
				droppedItems: 0,
				cost: this.session.estimatedCost,
			});
		});
	}
}
