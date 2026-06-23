import { MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import { countTokens } from './utils/tokens';
import { AgentSettings, AgentSettingTab, DEFAULT_SETTINGS } from './settings';
import { OpenRouterClient } from './llm/OpenRouterClient';
import type { ModelPricing } from './types';
import { ChatView, CHAT_VIEW_TYPE } from './ui/ChatView';
import { CouncilView, COUNCIL_VIEW_TYPE } from './ui/CouncilView';
import { VaultManager } from './vault/VaultManager';
import { FrontmatterParser } from './vault/FrontmatterParser';
import { TaxonomyManager } from './vault/TaxonomyManager';
import { MemoryManager } from './memory/MemoryManager';
import { ContextAssembler } from './context/ContextAssembler';
import { ContextService } from './context/ContextService';
import { SessionManager } from './session/SessionManager';
import { SoulManager } from './souls/SoulManager';
import { SoulGeneratorModal } from './souls/SoulGeneratorModal';
import { SetupWizard } from './wizard/SetupWizard';
import { refreshSystemDocs } from './wizard/WizardVaultInit';
import { LockIcons } from './ui/LockIcons';
import { VaultHooksManager } from './vault/VaultHooksManager';

const CORE_FILES = [
	'_agent/user.md',
	'_agent/taxonomy.md',
	'_agent/memory/active.md',
];

export default class MinimalAgentPlugin extends Plugin {
	settings: AgentSettings;
	vaultManager: VaultManager;
	parser: FrontmatterParser;
	taxonomyManager: TaxonomyManager;
	memoryManager: MemoryManager;
	contextAssembler: ContextAssembler;
	contextService: ContextService;
	sessionManager: SessionManager;
	soulManager: SoulManager;

	private coreFileContents = new Map<string, string>();
	private lockIcons: LockIcons;
	private statusBarTokenEl: HTMLElement;
	private statusBarTimer: number | null = null;
	private pricingCache = new Map<string, { pricing: ModelPricing; fetchedAt: number }>();
	private static readonly PRICING_TTL_MS = 60 * 60 * 1000; // 1 hour

	async onload() {
		await this.loadSettings();

		this.vaultManager = new VaultManager(this.app);
		this.parser = new FrontmatterParser();
		this.taxonomyManager = new TaxonomyManager(this.vaultManager, this.parser);
		this.memoryManager = new MemoryManager(this.vaultManager, this.parser);
		this.contextAssembler = new ContextAssembler(this.vaultManager, this.parser, this.memoryManager);
		this.contextService = new ContextService(this.settings, this.contextAssembler);
		this.soulManager = new SoulManager(this.vaultManager, this.parser);
		this.sessionManager = new SessionManager(
			this.vaultManager,
			this.parser,
			this.taxonomyManager,
			() => this.settings.apiKey,
			() => this.settings.modelSlug,
			() => this.settings.language,
		);

		this.registerView(CHAT_VIEW_TYPE, (leaf) => new ChatView(leaf, this));
		this.registerView(COUNCIL_VIEW_TYPE, (leaf) => new CouncilView(leaf, this));

		this.addCommand({
			id: 'open-agent-chat',
			name: 'Open agent chat',
			callback: () => this.openChatView(),
		});

		this.addCommand({
			id: 'open-soul-council',
			name: 'Open Soul Council',
			callback: () => this.openCouncilView(),
		});

		this.addCommand({
			id: 'create-soul',
			name: 'Create new soul',
			callback: () => {
				new SoulGeneratorModal(
					this.app,
					this.vaultManager,
					this.parser,
					this.settings.apiKey,
					this.settings.modelSlug,
					() => {},
					this.settings.language,
				).open();
			},
		});

		this.addRibbonIcon('message-square', 'Open agent chat', () => this.openChatView());
		this.addRibbonIcon('users', 'Open Soul Council', () => this.openCouncilView());

		this.addSettingTab(new AgentSettingTab(this.app, this));

		this.statusBarTokenEl = this.addStatusBarItem();
		this.statusBarTokenEl.addClass('agent-status-tokens');

		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				this.updateStatusBarTokens();
			}),
		);

		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (!(file instanceof TFile)) return;
				if (file !== this.app.workspace.getActiveFile()) return;
				if (this.statusBarTimer !== null) window.clearTimeout(this.statusBarTimer);
				this.statusBarTimer = window.setTimeout(() => {
					this.statusBarTimer = null;
					this.updateStatusBarTokens();
				}, 500);
			}),
		);

		new VaultHooksManager(
			this.app,
			this.vaultManager,
			this.memoryManager,
			this.taxonomyManager,
			this.coreFileContents,
			CORE_FILES,
		).register(this.registerEvent.bind(this));

		this.app.workspace.onLayoutReady(() => {
			if (SetupWizard.isFirstRun(this.app)) {
				new SetupWizard(this.app, this, this.vaultManager).open();
			} else if (!this.vaultManager.fileExists('_system/getting-started.md')) {
				void refreshSystemDocs(this.vaultManager, this.settings.language);
			}
			void this.memoryManager.autoMarkStale();
			void this.cleanupTraces();
			void this.cacheCoreFiles();
			this.lockIcons = new LockIcons(this.app, CORE_FILES);
			this.lockIcons.setup();
			this.updateStatusBarTokens();
		});
	}

	onunload() {
		if (this.statusBarTimer !== null) window.clearTimeout(this.statusBarTimer);
		this.lockIcons?.destroy();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<AgentSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	openChatView() {
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			leaf.setViewState({ type: CHAT_VIEW_TYPE, active: true });
			this.app.workspace.revealLeaf(leaf);
		}
	}

	openCouncilView() {
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			leaf.setViewState({ type: COUNCIL_VIEW_TYPE, active: true });
			this.app.workspace.revealLeaf(leaf);
		}
	}

	openGettingStarted() {
		const file = this.app.vault.getAbstractFileByPath('_system/getting-started.md');
		if (file instanceof TFile) {
			const leaf = this.app.workspace.getLeaf(false);
			if (leaf) void leaf.openFile(file);
		}
	}

	// — Core file protection —

	private async cacheCoreFiles(): Promise<void> {
		for (const path of CORE_FILES) {
			const content = await this.vaultManager.readFile(path);
			if (content !== null) this.coreFileContents.set(path, content);
		}
	}

	// — Pricing cache —

	async getModelPricing(): Promise<ModelPricing | null> {
		const slug = this.settings.modelSlug;
		if (!slug || !this.settings.apiKey) return null;
		const cached = this.pricingCache.get(slug);
		if (cached && Date.now() - cached.fetchedAt < MinimalAgentPlugin.PRICING_TTL_MS) {
			return cached.pricing;
		}
		try {
			const pricing = await OpenRouterClient.fetchPricing(slug, this.settings.apiKey);
			this.pricingCache.set(slug, { pricing, fetchedAt: Date.now() });
			return pricing;
		} catch {
			return null;
		}
	}

	// — Status bar token count —

	private updateStatusBarTokens(): void {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) {
			this.statusBarTokenEl.setText('');
			return;
		}
		const tokens = countTokens(view.editor.getValue());
		this.statusBarTokenEl.setText(`~${tokens.toLocaleString()} tokens`);
	}

	// — Trace retention cleanup —

	private async cleanupTraces(): Promise<void> {
		const files = this.vaultManager.listFiles('_system/traces');
		const cutoff = Date.now() - this.settings.traceRetentionDays * 24 * 60 * 60 * 1000;

		for (const filePath of files) {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (!(file instanceof TFile)) continue;
			if (file.stat.mtime < cutoff) {
				await this.app.vault.delete(file);
			}
		}
	}
}
