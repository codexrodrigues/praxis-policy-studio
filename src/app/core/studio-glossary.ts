import type { SupportedLocale } from './runtime-config';

export interface StudioGlossaryEntry {
  readonly category: string;
  readonly title: string;
  readonly summary: string;
  readonly detail?: string;
}

export type StudioGovernanceTermKey =
  | 'fourEyes'
  | 'safeDraft'
  | 'runtimeAuthority'
  | 'failClosed'
  | 'legalBasis'
  | 'stageGuard'
  | 'stageDomain'
  | 'stagePost'
  | 'stageTransform'
  | 'stageEffect'
  | 'stageOther';

export function resolvePolicyGlossaryEntry(
  policy: string | null | undefined,
  locale: SupportedLocale
): StudioGlossaryEntry {
  const normalized = policy?.toUpperCase() ?? 'LOCKED';
  if (locale === 'en-US') {
    switch (normalized) {
      case 'PARAMETERIZABLE':
        return {
          category: 'Autonomy policy',
          title: 'Parameterizable',
          summary:
            'Business analysts can tune governed thresholds, limits, and dates in a safe draft without altering core calculation logic.',
          detail: 'Changes pass sandbox simulation and require 4-eyes approval before promotion.'
        };
      case 'REPLACEABLE':
      case 'RESTRICT_ONLY':
      case 'EXTEND_ONLY':
      case 'FREE_EXTENSION':
      case 'DECISION_TABLE':
        return {
          category: 'Autonomy policy',
          title: 'Customizable rule',
          summary:
            'This rule accepts custom conditions or customer decision tables bounded to the domain contract.',
          detail: 'All customizations start in a draft and are validated against declared scenarios.'
        };
      default:
        return {
          category: 'Autonomy policy',
          title: 'Protected rule (locked)',
          summary:
            'Core invariant or legal safeguard controlled centrally. Direct rule editing is disabled to preserve system integrity.',
          detail: 'You can inspect its plain-language rationale, legal basis, and evaluated facts safely.'
        };
    }
  }

  switch (normalized) {
    case 'PARAMETERIZABLE':
      return {
        category: 'Política de autonomia',
        title: 'Parametrizável',
        summary:
          'Analistas de negócio podem ajustar limites, prazos e parâmetros em um rascunho seguro, sem alterar a lógica central do sistema.',
        detail: 'Toda alteração passa por simulação e exige revisão 4-olhos antes de entrar em produção.'
      };
    case 'REPLACEABLE':
    case 'RESTRICT_ONLY':
    case 'EXTEND_ONLY':
    case 'FREE_EXTENSION':
    case 'DECISION_TABLE':
      return {
        category: 'Política de autonomia',
        title: 'Customizável pelo cliente',
        summary:
          'Permite adaptar condições ou tabelas de decisão às particularidades da sua organização dentro dos limites do contrato.',
        detail: 'A edição ocorre em rascunho isolado e só é ativada após testes em cenários e aprovação.'
      };
    default:
      return {
        category: 'Política de autonomia',
        title: 'Regra protegida (fixa)',
        summary:
          'Invariante central ou obrigação normativa protegida contra alterações diretas para garantir segurança e consistência.',
        detail: 'Você pode consultar a explicação didática, a base legal e os dados avaliados sem risco de alteração.'
      };
  }
}

export function resolveStatusGlossaryEntry(
  status: string | null | undefined,
  locale: SupportedLocale
): StudioGlossaryEntry {
  const normalized = status?.toUpperCase() ?? 'UNKNOWN';
  if (locale === 'en-US') {
    switch (normalized) {
      case 'PROMOTED':
      case 'PUBLISHED':
        return {
          category: 'Governance status',
          title: 'Active in runtime',
          summary: 'This rule version is published and actively enforcing decisions for the selected scope.',
          detail: 'New changes open a separate draft so active behavior remains uninterrupted until approved.'
        };
      case 'APPROVED':
        return {
          category: 'Governance status',
          title: 'Approved (ready to promote)',
          summary: 'Peer 4-eyes review is complete and the decision is queued for controlled activation.'
        };
      case 'SUBMITTED':
        return {
          category: 'Governance status',
          title: 'In 4-eyes review',
          summary: 'Submitted by an author and awaiting validation from an independent reviewer.'
        };
      case 'REJECTED':
        return {
          category: 'Governance status',
          title: 'Review rejected',
          summary: '4-eyes review requested changes before approving this rule.'
        };
      case 'OPEN':
        return {
          category: 'Governance status',
          title: 'Working draft',
          summary: 'Editable draft not yet active in runtime. Safe to experiment and simulate.'
        };
      default:
        return {
          category: 'Governance status',
          title: normalized,
          summary: 'Current governance lifecycle stage recorded for this decision.'
        };
    }
  }

  switch (normalized) {
    case 'PROMOTED':
    case 'PUBLISHED':
      return {
        category: 'Estado de governança',
        title: 'Ativa em produção',
        summary: 'Versão oficial já publicada e aplicada nas operações do escopo selecionado.',
        detail: 'Qualquer ajuste cria um rascunho paralelo sem interromper a operação vigente.'
      };
    case 'APPROVED':
      return {
        category: 'Estado de governança',
        title: 'Aprovada para publicação',
        summary: 'Já validada na revisão 4-olhos e pronta para ativação controlada em produção.'
      };
    case 'SUBMITTED':
      return {
        category: 'Estado de governança',
        title: 'Em revisão 4-olhos',
        summary: 'Enviada para conferência independente antes de poder ser promovida.'
      };
    case 'REJECTED':
      return {
        category: 'Estado de governança',
        title: 'Revisão recusada',
        summary: 'A revisão 4-olhos solicitou ajustes antes de aprovar esta regra.'
      };
    case 'OPEN':
      return {
        category: 'Estado de governança',
        title: 'Rascunho em edição',
        summary: 'Versão de trabalho ainda não publicada em produção. Você pode simular cenários livremente.'
      };
    default:
      return {
        category: 'Estado de governança',
        title: normalized,
        summary: 'Estágio atual do ciclo de governança registrado para esta decisão.'
      };
  }
}

export function resolveGovernanceGlossaryEntry(
  key: StudioGovernanceTermKey,
  locale: SupportedLocale
): StudioGlossaryEntry {
  const ptEntries: Record<StudioGovernanceTermKey, StudioGlossaryEntry> = {
    fourEyes: {
      category: 'Controle de qualidade',
      title: 'Revisão 4-olhos',
      summary:
        'Princípio de governança em que quem cria ou edita uma regra não pode aprová-la sozinho.',
      detail: 'Outro analista ou revisor autorizado confere o impacto e aprova antes da publicação.'
    },
    safeDraft: {
      category: 'Controle e liberdade',
      title: 'Rascunho seguro (não afeta produção)',
      summary:
        'Suas edições ficam isoladas em rascunho. Você pode testar em cenários, comparar diferenças e descartar a qualquer momento.'
    },
    runtimeAuthority: {
      category: 'Execução',
      title: 'Autoridade em produção',
      summary:
        'Indica se esta decisão já é executada nativamente no motor governado ou se ainda opera em validação paralela/sombra.'
    },
    failClosed: {
      category: 'Segurança operacional',
      title: 'Falha segura (Fail-Closed)',
      summary:
        'Se um contrato ou dado obrigatório estiver ausente ou inconsistente, o sistema bloqueia a operação em vez de aprovar no escuro.'
    },
    legalBasis: {
      category: 'Conformidade',
      title: 'Base legal ou normativa',
      summary:
        'Artigos de lei, portarias, estatutos ou políticas internas que justificam a existência desta regra.'
    },
    stageGuard: {
      category: 'Estágio do fluxo',
      title: '1. Pré-requisitos',
      summary: 'Verificações iniciais que garantem que a operação tem os requisitos mínimos antes de continuar.'
    },
    stageDomain: {
      category: 'Estágio do fluxo',
      title: '2. Regras de negócio',
      summary: 'Cálculo central e critérios principais que definem aprovação, rejeição ou limite.'
    },
    stagePost: {
      category: 'Estágio do fluxo',
      title: '3. Validações cruzadas',
      summary: 'Checagens finais que validam consistência entre múltiplos campos ou regras relacionadas.'
    },
    stageTransform: {
      category: 'Estágio do fluxo',
      title: '4. Transformações',
      summary: 'Normalizações e derivações aplicadas sobre os dados antes do fechamento.'
    },
    stageEffect: {
      category: 'Estágio do fluxo',
      title: '5. Efeitos',
      summary: 'Resultado final ou consequência gravada após todas as validações passarem.'
    },
    stageOther: {
      category: 'Estágio do fluxo',
      title: 'Outras decisões',
      summary: 'Decisões complementares vinculadas ao contexto da operação.'
    }
  };

  const enEntries: Record<StudioGovernanceTermKey, StudioGlossaryEntry> = {
    fourEyes: {
      category: 'Quality control',
      title: '4-eyes review',
      summary:
        'Governance safeguard ensuring the author who proposes a rule change cannot approve it alone.',
      detail: 'An independent reviewer validates the simulation diff before promotion.'
    },
    safeDraft: {
      category: 'Control & freedom',
      title: 'Safe draft (zero runtime impact)',
      summary:
        'Your edits remain isolated in a working draft. You can simulate scenarios, inspect diffs, or discard anytime.'
    },
    runtimeAuthority: {
      category: 'Execution',
      title: 'Runtime authority',
      summary:
        'Shows whether this decision is actively enforced by the governed engine or still running in shadow comparison.'
    },
    failClosed: {
      category: 'Operational safety',
      title: 'Fail-closed enforcement',
      summary:
        'Whenever a required contract or fact is missing or invalid, execution stops safely instead of guessing.'
    },
    legalBasis: {
      category: 'Compliance',
      title: 'Legal or normative basis',
      summary:
        'Laws, regulations, bylaws, or corporate directives that explain why this rule exists.'
    },
    stageGuard: {
      category: 'Evaluation stage',
      title: '1. Guards & prerequisites',
      summary: 'Early checks ensuring minimum eligibility conditions before core evaluation.'
    },
    stageDomain: {
      category: 'Evaluation stage',
      title: '2. Business rules',
      summary: 'Core criteria and thresholds determining acceptance, limits, or denial.'
    },
    stagePost: {
      category: 'Evaluation stage',
      title: '3. Cross-checks',
      summary: 'Post-checks validating consistency across related fields and outcomes.'
    },
    stageTransform: {
      category: 'Evaluation stage',
      title: '4. Transformations',
      summary: 'Derived values or normalizations computed before finalization.'
    },
    stageEffect: {
      category: 'Evaluation stage',
      title: '5. Effects',
      summary: 'Final decision outcome recorded once checks pass.'
    },
    stageOther: {
      category: 'Evaluation stage',
      title: 'Other decisions',
      summary: 'Supporting decisions bound to this operation scope.'
    }
  };

  return (locale === 'en-US' ? enEntries : ptEntries)[key];
}
