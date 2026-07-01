export type MascotState =
	| 'idle'
	| 'thinking'
	| 'blink'
	| 'inlove'
	| 'badass'
	| 'confused'
	| 'challenged'
	| 'sad'
	| 'cry'
	| 'angry';

/** States that display the soul's own emoji as plain text, unanimated. */
const TEXT_STATES = new Set<MascotState>(['idle', 'blink']);

/** Map from non-text state → emoji character to show. */
const STATE_EMOJI: Partial<Record<MascotState, string>> = {
	thinking:   '🤔',
	confused:   '🤔',
	challenged: '🤔',
	inlove:     '❤️‍🔥',
	badass:     '😏',
	sad:        '😕',
	cry:        '😕',
	angry:      '👺',
};

const ANIM_CLASSES = ['agent-mascot-anim-thinking', 'agent-mascot-anim-inlove', 'agent-mascot-anim-mood'];

/** Map from non-text state → CSS animation class applied to the emoji text. */
const STATE_ANIM_CLASS: Partial<Record<MascotState, string>> = {
	thinking:   'agent-mascot-anim-thinking',
	confused:   'agent-mascot-anim-thinking',
	challenged: 'agent-mascot-anim-thinking',
	inlove:     'agent-mascot-anim-inlove',
	badass:     'agent-mascot-anim-mood',
	sad:        'agent-mascot-anim-mood',
	cry:        'agent-mascot-anim-mood',
	angry:      'agent-mascot-anim-mood',
};

/**
 * Creates an animated mascot inside `container`. Always renders as plain emoji text;
 * non-text states get a CSS keyframe animation instead of an animated PNG.
 *
 * - **Idle / blink**: renders the soul's own emoji, unanimated.
 * - **All other states**: renders the state's emoji with a state-specific CSS animation.
 *
 * Returns:
 * - `setState(state)` — switch expression.
 * - `setEmoji(emoji)` — update the soul emoji shown in idle/blink states.
 */
export function createMascotImg(
	container: HTMLElement,
	initialState: MascotState,
	cls = 'agent-mascot-img',
	initialEmoji = '✨',
): { el: HTMLElement; setState: (state: MascotState) => void; setEmoji: (emoji: string) => void } {
	const wrap = container.createDiv({ cls });

	const emojiSpan = wrap.createEl('span', {
		cls: 'agent-mascot-emoji-text',
		text: initialEmoji,
	});

	let currentState: MascotState = initialState;
	let currentEmoji = initialEmoji;

	function applyState(state: MascotState): void {
		emojiSpan.removeClass(...ANIM_CLASSES);
		if (TEXT_STATES.has(state)) {
			emojiSpan.setText(currentEmoji);
		} else {
			emojiSpan.setText(STATE_EMOJI[state] ?? '🤔');
			const animClass = STATE_ANIM_CLASS[state];
			if (animClass) emojiSpan.addClass(animClass);
		}
	}

	applyState(initialState);

	return {
		el: wrap,
		setState(state: MascotState) {
			if (state === currentState) return;
			currentState = state;
			applyState(state);
		},
		setEmoji(emoji: string) {
			currentEmoji = emoji;
			if (TEXT_STATES.has(currentState)) {
				emojiSpan.setText(emoji);
			}
		},
	};
}
