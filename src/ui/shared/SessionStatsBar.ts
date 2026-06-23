import { formatCost } from '../../utils/tokens';

export interface StatsParams {
	contextTokens: number;
	transcriptTokens: number;
	droppedItems: number;
	extraCount?: number;
	cost?: number;
}

export class SessionStatsBar {
	readonly el: HTMLElement;

	constructor(container: HTMLElement, cls = 'agent-chat-status') {
		this.el = container.createDiv({ cls });
	}

	update(params: StatsParams): void {
		const { contextTokens, transcriptTokens, droppedItems, extraCount = 0, cost } = params;
		const priceTag  = cost != null       ? ` · ${formatCost(cost)}`          : '';
		const dropped   = droppedItems > 0   ? ` · ${droppedItems} items dropped` : '';
		const ctxTag    = extraCount > 0     ? ` · +${extraCount} ctx`            : '';
		this.el.setText(`~${contextTokens + transcriptTokens} tokens${priceTag}${dropped}${ctxTag}`);
	}

	clear(): void {
		this.el.setText('');
	}
}
