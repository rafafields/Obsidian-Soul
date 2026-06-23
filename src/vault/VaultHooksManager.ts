import { App, Notice, Plugin, TFile } from 'obsidian';
import type { VaultManager } from './VaultManager';
import type { MemoryManager } from '../memory/MemoryManager';
import type { TaxonomyManager } from './TaxonomyManager';
import type { MemoryItemFrontmatter } from '../types';

export class VaultHooksManager {
	constructor(
		private app: App,
		private vaultManager: VaultManager,
		private memoryManager: MemoryManager,
		private taxonomyManager: TaxonomyManager,
		private coreFileContents: Map<string, string>,
		private coreFiles: string[],
	) {}

	register(registerEvent: Plugin['registerEvent']): void {
		registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				if (!(file instanceof TFile)) return;
				if (this.coreFiles.includes(oldPath)) {
					void this.app.vault.rename(file, oldPath);
					new Notice(`"${oldPath.split('/').pop()}" is a protected file and cannot be renamed.`);
				}
			}),
		);

		registerEvent(
			this.app.vault.on('delete', (file) => {
				if (this.coreFiles.includes(file.path)) {
					const cached = this.coreFileContents.get(file.path);
					if (cached) {
						void this.vaultManager.writeFile(file.path, cached);
						new Notice(`"${file.path.split('/').pop()}" is protected and has been restored.`);
					} else {
						new Notice(`"${file.path.split('/').pop()}" is protected. Re-run the setup wizard to restore it.`);
					}
					return;
				}

				if (!file.path.includes('memory/items/') || file.path.endsWith('.base')) return;
				const cachedFm = this.app.metadataCache.getCache(file.path)?.frontmatter;
				const state = String(cachedFm?.['state'] ?? '');
				if (!state.includes('pending')) return;
				const ts = new Date().toISOString().slice(0, 16).replace(':', '-');
				void this.vaultManager.writeFile(`_system/traces/${ts}-discard.md`, `Discarded: ${file.path}\n`);
			}),
		);

		registerEvent(
			this.app.vault.on('modify', (file) => {
				if (!(file instanceof TFile)) return;

				if (this.coreFiles.includes(file.path)) {
					void this.vaultManager.readFile(file.path).then(content => {
						if (content !== null) this.coreFileContents.set(file.path, content);
					});
					return;
				}

				if (!file.path.includes('memory/items/') || file.path.endsWith('.base')) return;
				this.memoryManager.reindex(file.path);
				const cache = this.app.metadataCache.getFileCache(file);
				const fm = cache?.frontmatter as Partial<MemoryItemFrontmatter> | undefined;
				if (!fm) return;
				const state = String(fm.state ?? '');
				if (state.includes('pending')) return;
				const proposedTags = fm.proposed_tags;
				if (Array.isArray(proposedTags) && proposedTags.length > 0) {
					void this.taxonomyManager.addToActive(proposedTags);
				}
			}),
		);
	}
}
