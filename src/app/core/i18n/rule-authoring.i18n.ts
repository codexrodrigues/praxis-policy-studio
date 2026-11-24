export const RULE_AUTHORING_COPY_PT_BR = {
  ruleExpressionTechnicalTitle: 'Expressão lógica da decisão',
  draftFocusedModeBadge: 'Modo edição focado',
  draftDirtyBadge: 'Alterações pendentes',
  draftCleanBadge: 'Sem alterações pendentes',
  draftScrollToReference: 'Ver referência da regra',
  ruleReferenceSectionLabel: 'Referência atual da regra'
} as const;

export const RULE_AUTHORING_COPY_EN_US: Record<keyof typeof RULE_AUTHORING_COPY_PT_BR, string> = {
  ruleExpressionTechnicalTitle: 'Decision logic expression',
  draftFocusedModeBadge: 'Focused edit mode',
  draftDirtyBadge: 'Pending changes',
  draftCleanBadge: 'No pending changes',
  draftScrollToReference: 'View rule reference',
  ruleReferenceSectionLabel: 'Current rule reference'
};
