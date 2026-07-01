import { normalizePath } from 'obsidian';
import type { App, PluginManifest } from 'obsidian';

/** Map from Unicode emoji character → animated PNG filename in the plugin's `emojis/` asset folder. */
const EMOJI_FILES: Record<string, string> = {
	'👾': 'Alien Monster.png',
	'👽': 'Alien.png',
	'😁': 'Beaming Face with Smiling Eyes.png',
	'😕': 'Confused Face.png',
	'🤠': 'Cowboy Hat Face.png',
	'🥸': 'Disguised Face.png',
	'🤤': 'Drooling Face.png',
	'🤯': 'Exploding Head.png',
	'😘': 'Face Blowing a Kiss.png',
	'😮‍💨': 'Face Exhaling.png',
	'🧐': 'Face with Monocle.png',
	'🤨': 'Face with Raised Eyebrow.png',
	'👻': 'Ghost.png',
	'👺': 'Goblin.png',
	'😺': 'Grinning Cat.png',
	'😃': 'Grinning Face with Big Eyes.png',
	'🙉': 'Hear-No-Evil Monkey.png',
	'❤️‍🔥': 'Heart on Fire.png',
	'😚': 'Kissing Face with Closed Eyes.png',
	'💌': 'Love Letter.png',
	'❤️‍🩹': 'Mending Heart.png',
	'🤑': 'Money-Mouth Face.png',
	'🤓': 'Nerd Face.png',
	'👹': 'Ogre.png',
	'🥳': 'Partying Face.png',
	'💩': 'Pile of Poo.png',
	'🤖': 'Robot.png',
	'🫡': 'Saluting Face.png',
	'💀': 'Skull.png',
	'😇': 'Smiling Face with Halo.png',
	'😈': 'Smiling Face with Horns.png',
	'😏': 'Smirking Face.png',
	'🤔': 'Thinking Face.png',
};

/** Ordered list of all available emoji characters (matches the curated picker). */
export const CURATED_EMOJIS: string[] = Object.keys(EMOJI_FILES);

// Filenames for mascot state images
export const THINKING_FILE = EMOJI_FILES['🤔'] as string;
export const INLOVE_FILE = EMOJI_FILES['❤️‍🔥'] as string;
export const PARTY_FILE = EMOJI_FILES['🥳'] as string;

let resolveAsset: ((filename: string) => string) | null = null;

/**
 * Wires up asset resolution against the plugin's `emojis/` folder (shipped as loose
 * files alongside main.js, not bundled — see esbuild.config.mjs). Call once from
 * `onload()` before any UI that renders emoji PNGs.
 */
export function initEmojiAssets(app: App, manifest: PluginManifest): void {
	const dir = manifest.dir;
	if (!dir) return;
	resolveAsset = (filename: string) =>
		app.vault.adapter.getResourcePath(normalizePath(`${dir}/emojis/${filename}`));
}

/** Resource-path URL for the given emoji's animated PNG, or null if unknown/unresolved. */
export function getEmojiSrc(emoji: string): string | null {
	const filename = EMOJI_FILES[emoji];
	if (!filename || !resolveAsset) return null;
	return resolveAsset(filename);
}

/** Resource-path URL for a specific asset filename (e.g. THINKING_FILE), or null if unresolved. */
export function getAssetSrc(filename: string): string | null {
	return resolveAsset ? resolveAsset(filename) : null;
}
