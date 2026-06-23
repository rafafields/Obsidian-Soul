export interface EditBlock {
	path: string;
	content: string;
}

export type DiffLineKind = 'equal' | 'add' | 'remove';

export interface DiffLine {
	kind: DiffLineKind;
	text: string;
}

const EDIT_FENCE_RE = /^```edit:(.+)\n([\s\S]*?)^```/gm;

export function parseEditBlocks(response: string): EditBlock[] {
	const blocks: EditBlock[] = [];
	let match: RegExpExecArray | null;
	const re = new RegExp(EDIT_FENCE_RE.source, EDIT_FENCE_RE.flags);
	while ((match = re.exec(response)) !== null) {
		const path = match[1]?.trim() ?? '';
		const content = match[2]?.trimEnd() ?? '';
		if (path) blocks.push({ path, content });
	}
	return blocks;
}

export function stripEditBlocks(response: string): string {
	return response.replace(EDIT_FENCE_RE, '').replace(/\n{3,}/g, '\n\n').trim();
}

export function computeDiff(original: string, modified: string): DiffLine[] {
	const oldLines = original === '' ? [] : original.split('\n');
	const newLines = modified === '' ? [] : modified.split('\n');
	return lcs(oldLines, newLines);
}

function lcs(oldLines: string[], newLines: string[]): DiffLine[] {
	const m = oldLines.length;
	const n = newLines.length;

	// Build LCS table as flat array for strict-mode safety
	const dp = new Int32Array((m + 1) * (n + 1));
	const at = (i: number, j: number) => dp[i * (n + 1) + j] as number;
	const set = (i: number, j: number, v: number) => { dp[i * (n + 1) + j] = v; };

	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			set(i, j, oldLines[i - 1] === newLines[j - 1]
				? at(i - 1, j - 1) + 1
				: Math.max(at(i - 1, j), at(i, j - 1)));
		}
	}

	// Backtrack to produce diff
	const result: DiffLine[] = [];
	let i = m, j = n;
	while (i > 0 || j > 0) {
		if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
			result.unshift({ kind: 'equal', text: oldLines[i - 1] as string });
			i--; j--;
		} else if (j > 0 && (i === 0 || at(i, j - 1) >= at(i - 1, j))) {
			result.unshift({ kind: 'add', text: newLines[j - 1] as string });
			j--;
		} else {
			result.unshift({ kind: 'remove', text: oldLines[i - 1] as string });
			i--;
		}
	}
	return result;
}
