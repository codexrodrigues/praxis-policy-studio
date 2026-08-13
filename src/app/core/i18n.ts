import { Injectable, signal } from '@angular/core';
import { SupportedLocale } from './runtime-config';

const copy = {
  'pt-BR': {
    skip: 'Pular para o conteúdo principal',
    product: 'Praxis Policy Studio',
    catalog: 'Catálogo de decisões',
    provenance: 'Proveniência',
    environment: 'Ambiente',
    fixture: 'Fixture hermética',
    readonly: 'Somente leitura',
    loading: 'Preparando o ambiente de trabalho…',
    setupError: 'Não foi possível configurar o Policy Studio.',
    retry: 'Tentar novamente',
    search: 'Buscar decisões',
    searchHint: 'Nome, código ou domínio',
    decisions: 'decisões',
    selected: 'Decisão selecionada',
    meaning: 'Significado',
    evidence: 'Evidências',
    execution: 'Execução',
    authority: 'Autoridade atual',
    source: 'Fonte governada',
    noResults: 'Nenhuma decisão corresponde à busca.',
    fixtureNotice: 'Dados locais de demonstração. Nenhuma regra ou autoridade é alterada.'
  },
  'en-US': {
    skip: 'Skip to main content',
    product: 'Praxis Policy Studio',
    catalog: 'Decision catalog',
    provenance: 'Provenance',
    environment: 'Environment',
    fixture: 'Hermetic fixture',
    readonly: 'Read only',
    loading: 'Preparing the workspace…',
    setupError: 'Policy Studio could not be configured.',
    retry: 'Try again',
    search: 'Search decisions',
    searchHint: 'Name, code, or domain',
    decisions: 'decisions',
    selected: 'Selected decision',
    meaning: 'Meaning',
    evidence: 'Evidence',
    execution: 'Execution',
    authority: 'Current authority',
    source: 'Governed source',
    noResults: 'No decision matches this search.',
    fixtureNotice: 'Local demonstration data. No rule or authority is changed.'
  }
} as const;

export type CopyKey = keyof typeof copy['pt-BR'];

@Injectable({ providedIn: 'root' })
export class PolicyStudioI18n {
  readonly locale = signal<SupportedLocale>('pt-BR');
  text(key: CopyKey): string { return copy[this.locale()][key]; }
}

