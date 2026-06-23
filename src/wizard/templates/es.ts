export const GETTING_STARTED = `# Cómo empezar con Minimal Agent

Tu agente vive completamente dentro de este vault. Su personalidad, memoria y conocimiento sobre ti se almacenan como archivos Markdown que puedes leer y editar en cualquier momento.

## Estructura del vault

\`\`\`
_agent/
  souls/          ← personalidades del agente (editables)
  user.md         ← cómo el agente te modela (editable)
  taxonomy.md     ← vocabulario de etiquetas autorizado
  memory/
    active.md     ← memoria de trabajo (se actualiza cada sesión)
    episodes/     ← resúmenes de sesión
    items/        ← memoria a largo plazo confirmada
_system/          ← documentación de referencia y trazas (solo lectura)
\`\`\`

## Flujo de memoria

Cada conversación sigue este ciclo:

1. **Ensamblaje de contexto** — el agente lee \`active.md\`, episodios recientes y elementos de memoria con alta puntuación dentro de un presupuesto de tokens.
2. **Durante la sesión** — \`active.md\` se actualiza después de cada intercambio.
3. **Finalizar** — haz clic en *Finalizar y memorizar* (o deja que el temporizador de inactividad se active) para extraer candidatos de memoria de la transcripción.
4. **Revisión** — los candidatos aparecen en \`memory/items/\` con estado [[pending]]. Confirma los que valgan la pena cambiando el estado a [[active]], o elimínalos para descartarlos.

## Capas de contexto

| Capa | Fuente | Presupuesto |
|------|--------|-------------|
| [[working\\|Trabajo]] | \`active.md\` + soul + \`user.md\` | Siempre incluida (~700 tokens) |
| Episódica | Últimos 1–2 episodios | Siempre incluida (~400 tokens) |
| [[semantic\\|Semántica]] | Elementos confirmados, puntuados | Presupuesto restante |

## Ciclo de vida de los elementos de memoria

[[pending]] → [[active]] → [[stale]] / [[archived]]

Los elementos se puntúan por importancia, tier y recencia. Consulta [[semantic]] para ver cómo las puntuaciones afectan la inclusión en el contexto.

## Tipos de elemento de memoria

| Tipo | Úsalo cuando… |
|------|---------------|
| [[decision\\|decisión]] | una elección con implicaciones duraderas |
| [[insight]] | un patrón o realización |
| [[constraint\\|restricción]] | un límite duro o no negociable |
| [[risk\\|riesgo]] | una amenaza o incertidumbre abierta |
| [[summary\\|resumen]] | un relato comprimido de un tema |
| [[pattern\\|patrón]] | un comportamiento o tendencia recurrente |

## Consejos

- Edita \`user.md\` libremente — moldea cada conversación.
- El agente nunca escribe en \`soul.md\` ni en \`user.md\` directamente; esos archivos son tuyos.
- Ajusta \`taxonomy.md\` para controlar qué etiquetas puede asignar el agente.
- Explora \`_system/\` para entender el vocabulario usado en el frontmatter de los elementos de memoria.
`;

export const SYSTEM_NOTES: [string, string][] = [
	['_system/memory_tiers/working.md', `# Memoria de trabajo

Estado a corto plazo del agente, almacenado en \`_agent/memory/active.md\`. Se actualiza sección por sección después de cada turno de conversación y siempre se incluye en el contexto, independientemente del presupuesto de tokens.

Contiene foco actual, decisiones recientes, bloqueos y próximo paso. El contenido antiguo se reemplaza gradualmente conforme nuevas sesiones actualizan cada sección.`],

	['_system/memory_tiers/semantic.md', `# Memoria semántica

Capa de conocimiento a largo plazo formada por elementos de memoria confirmados en \`_agent/memory/items/\`. Cada elemento tiene una puntuación calculada a partir de importancia, bonificación de tier y penalización por obsolescencia.

Durante el ensamblaje de contexto, los elementos con mayor puntuación se incluyen hasta agotar el presupuesto restante. Los elementos con estado [[stale]] o [[archived]] se excluyen.`],

	['_system/memory_kinds/decision.md', `# Decisión

Una elección tomada con intención deliberada y consecuencias que persisten entre sesiones. Úsala para recordar por qué se decidió algo: cambios de estrategia, compromisos personales, elecciones de diseño.`],

	['_system/memory_kinds/insight.md', `# Insight

Un patrón o realización derivado de la experiencia. Úsalo cuando una sesión revela algo no obvio: una conexión entre ideas, una lección aprendida, una actualización del modelo mental sobre cómo funciona algo.`],

	['_system/memory_kinds/constraint.md', `# Restricción

Un límite duro que determina lo que es posible. Captura cosas que el agente nunca debe olvidar: límites de tiempo, restricciones de recursos, reglas, no negociables.`],

	['_system/memory_kinds/risk.md', `# Riesgo

Una amenaza abierta, incertidumbre o problema potencial que vale la pena monitorear. A diferencia de una [[constraint\\|restricción]] (que es cierta), un riesgo es probabilístico — algo que podría ocurrir.`],

	['_system/memory_kinds/summary.md', `# Resumen

Un relato comprimido de eventos, contexto o un tema. Úsalo para temas complejos que ocuparían demasiados tokens si se almacenaran completos — extrae los puntos clave.`],

	['_system/memory_kinds/pattern.md', `# Patrón

Un comportamiento, estructura o tendencia recurrente que vale la pena nombrar. Útil para hábitos, flujos de trabajo o dinámicas que aparecen en múltiples sesiones.`],

	['_system/states/pending.md', `# Pendiente

Extraído por el agente y pendiente de revisión. Los elementos en este estado se almacenan en \`_agent/memory/items/\` pero **no se incluyen en el contexto** hasta que se confirmen.

Para confirmar: cambia el estado a [[active]] en el frontmatter del archivo.`],

	['_system/states/active.md', `# Activo

Confirmado y elegible para el ensamblaje de contexto. Los elementos con este estado se incluyen en la capa [[semantic\\|semántica]] según su puntuación.`],

	['_system/states/stale.md', `# Obsoleto

Expirado: la fecha \`expires_at\` ha pasado. El plugin marca automáticamente los elementos como obsoletos al cargar (si *Archivar automáticamente elementos caducados* está activado en la configuración). Los elementos obsoletos se excluyen del contexto pero permanecen en el vault.`],

	['_system/states/archived.md', `# Archivado

Retirado manualmente. Excluido del contexto pero conservado para referencia. Úsalo para elementos que ya no son relevantes pero que no quieres eliminar permanentemente.`],

	['_system/states/confirmed.md', `# Confirmado

Estado de episodio: el resumen de sesión ha sido aceptado como parte del registro permanente. Los episodios confirmados se incluyen en la capa episódica del contexto.`],

	['_system/origins/agent.md', `# Agente

Creado por el LLM durante la finalización de la sesión. Los candidatos de memoria con este origen son propuestas del agente basadas en el contenido de la transcripción.`],

	['_system/origins/human.md', `# Humano

Creado directamente por el usuario. Los archivos editados manualmente en el vault llevan este origen.`],

	['_system/origins/hybrid.md', `# Híbrido

Creado de forma colaborativa entre usuario y agente — por ejemplo, los archivos generados por el wizard de configuración que combinan input del usuario con generación del LLM.`],

	['_system/kinds/memory_item.md', `# Elemento de memoria

Una pieza discreta de memoria a largo plazo. Se almacena como archivo Markdown en \`_agent/memory/items/\` con frontmatter estructurado: estado, tipo, importancia, confianza, etiquetas, fecha de expiración y origen.`],

	['_system/kinds/memory_episode.md', `# Episodio de memoria

Resumen de sesión generado al finalizar una conversación. Se almacena en \`_agent/memory/episodes/\` e incluye ID de sesión, soul usado, coste en tokens y una transcripción comprimida.`],

	['_system/kinds/agent_soul.md', `# Soul del agente

Definición de personalidad e identidad para un agente. Se almacena en \`_agent/souls/\` como archivo Markdown editable. Incluye propósito, valores, voz y frases de carga opcionales.`],
];
