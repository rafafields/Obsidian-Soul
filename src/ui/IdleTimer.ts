export class IdleTimer {
	private timer: number | null = null;

	constructor(private onFire: () => void) {}

	reset(minutes: number): void {
		this.clear();
		if (minutes <= 0) return;
		this.timer = window.setTimeout(() => this.onFire(), minutes * 60 * 1000);
	}

	clear(): void {
		if (this.timer !== null) {
			window.clearTimeout(this.timer);
			this.timer = null;
		}
	}
}
