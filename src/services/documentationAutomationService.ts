import {
  DocumentationAutomationResult,
  DocumentationAutomationStep,
} from '../types/documentation';

const AUTOMATION_STEPS: DocumentationAutomationStep[] = [
  {
    id: 'screenshot',
    label: 'Captura de screenshot da tela',
    status: 'pending',
    note: 'Infraestrutura pronta para integração futura.',
  },
  {
    id: 'fields',
    label: 'Identificação de campos',
    status: 'pending',
    note: 'Infraestrutura pronta para integração futura.',
  },
  {
    id: 'buttons',
    label: 'Identificação de botões',
    status: 'pending',
    note: 'Infraestrutura pronta para integração futura.',
  },
  {
    id: 'filters',
    label: 'Identificação de filtros',
    status: 'pending',
    note: 'Infraestrutura pronta para integração futura.',
  },
  {
    id: 'description',
    label: 'Geração de descrição com IA',
    status: 'pending',
    note: 'Infraestrutura pronta para integração futura.',
  },
  {
    id: 'manual',
    label: 'Atualização do manual oficial',
    status: 'pending',
    note: 'Infraestrutura pronta para integração futura.',
  },
  {
    id: 'version',
    label: 'Registro de nova versão da documentação',
    status: 'pending',
    note: 'Infraestrutura pronta para integração futura.',
  },
];

export async function startDocumentationUpdate(screenRoute: string, screenName: string): Promise<DocumentationAutomationResult> {
  return {
    screenRoute,
    screenName,
    startedAt: new Date().toISOString(),
    status: 'placeholder',
    steps: AUTOMATION_STEPS,
  };
}