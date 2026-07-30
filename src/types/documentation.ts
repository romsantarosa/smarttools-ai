export type DocumentationSectionId =
  | 'visao-geral'
  | 'login'
  | 'dashboard'
  | 'navios'
  | 'ferramentas'
  | 'manutencao'
  | 'escalas'
  | 'split-operacional'
  | 'relatorios'
  | 'configuracoes'
  | 'inteligencia-artificial'
  | 'sobre'
  | 'faq'
  | 'historico-de-versoes';

export interface DocumentationMenuItem {
  id: DocumentationSectionId;
  label: string;
}

export interface DocumentationTemplateField {
  title:
    | 'Nome da Tela'
    | 'Objetivo'
    | 'Descrição'
    | 'Imagem da Tela'
    | 'Principais Funcionalidades'
    | 'Campos'
    | 'Botões'
    | 'Fluxo de Utilização'
    | 'Exemplos'
    | 'Observações'
    | 'Perguntas Frequentes';
  placeholder: string;
}

export interface DocumentationVersionEntry {
  version: string;
  date: string;
  description: string;
}

export interface DocumentationFAQItem {
  question: string;
  answer: string;
}

export type DocumentationAutomationStepStatus = 'pending' | 'in-progress' | 'completed';

export interface DocumentationAutomationStep {
  id:
    | 'screenshot'
    | 'fields'
    | 'buttons'
    | 'filters'
    | 'description'
    | 'manual'
    | 'version';
  label: string;
  status: DocumentationAutomationStepStatus;
  note: string;
}

export interface DocumentationAutomationResult {
  screenRoute: string;
  screenName: string;
  startedAt: string;
  steps: DocumentationAutomationStep[];
  status: 'placeholder';
}