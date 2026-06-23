import type { ChatMessage, CouncilSession, CouncilQuestionType } from '../types';
import type { CouncilResponseLength } from '../settings/types';
import { t, type TranslationKey } from '../i18n';

export const QUESTION_INSTRUCTIONS: Record<CouncilQuestionType, TranslationKey> = {
	opinion:  'council_question_opinion',
	critique: 'council_question_critique',
	propose:  'council_question_propose',
};

export const QUESTION_TYPE_LABELS: Record<CouncilQuestionType, TranslationKey> = {
	opinion:  'council_question_type_opinion',
	critique: 'council_question_type_critique',
	propose:  'council_question_type_propose',
};

const LENGTH_INSTRUCTION_KEYS: Record<CouncilResponseLength, TranslationKey> = {
	short:  'council_length_short',
	medium: 'council_length_medium',
	long:   'council_length_long',
};

export function buildContext(
	soulId: string,
	session: CouncilSession,
	questionType: CouncilQuestionType,
	lang: string,
	responseLength: CouncilResponseLength = 'short',
): { system: string; messages: ChatMessage[] } {
	const thread = session.threads[soulId];
	if (!thread) throw new Error(`Soul "${soulId}" not found in council session`);

	const instruction = t(QUESTION_INSTRUCTIONS[questionType], lang);
	const formatInstruction = t('council_format_instruction', lang);
	const lengthInstruction = t(LENGTH_INSTRUCTION_KEYS[responseLength], lang);
	const system = `${thread.systemPrompt}\n\n${instruction}\n\n${formatInstruction}\n\n${lengthInstruction}`;

	const messages: ChatMessage[] = session.messages.map((msg) => {
		if (msg.author === 'user') {
			return { role: 'user', content: msg.content };
		}
		if (msg.author === soulId) {
			return { role: 'assistant', content: msg.content };
		}
		return { role: 'user', content: `[${msg.author}]: ${msg.content}` };
	});

	return { system, messages };
}
