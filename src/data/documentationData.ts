import {
  DocumentationFAQItem,
  DocumentationMenuItem,
  DocumentationSectionId,
  DocumentationTemplateField,
  DocumentationVersionEntry,
} from '../types/documentation';

export const DOCUMENTATION_MENU_ITEMS: DocumentationMenuItem[] = [
  { id: 'visao-geral', label: 'Visão Geral' },
  { id: 'login', label: 'Login' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'navios', label: 'Navios' },
  { id: 'ferramentas', label: 'Ferramentas' },
  { id: 'manutencao', label: 'Manutenção' },
  { id: 'escalas', label: 'Escalas' },
  { id: 'split-operacional', label: 'Split Operacional' },
  { id: 'relatorios', label: 'Relatórios' },
  { id: 'configuracoes', label: 'Configurações' },
  { id: 'inteligencia-artificial', label: 'Inteligência Artificial' },
  { id: 'sobre', label: 'Sobre' },
  { id: 'faq', label: 'FAQ' },
  { id: 'historico-de-versoes', label: 'Histórico de Versões' },
];

export const DOCUMENTATION_TEMPLATE_FIELDS: DocumentationTemplateField[] = [
  { title: 'Nome da Tela', placeholder: 'Documentação em construção.' },
  { title: 'Objetivo', placeholder: 'Documentação em construção.' },
  { title: 'Descrição', placeholder: 'Documentação em construção.' },
  { title: 'Imagem da Tela', placeholder: 'Documentação em construção.' },
  { title: 'Principais Funcionalidades', placeholder: 'Documentação em construção.' },
  { title: 'Campos', placeholder: 'Documentação em construção.' },
  { title: 'Botões', placeholder: 'Documentação em construção.' },
  { title: 'Fluxo de Utilização', placeholder: 'Documentação em construção.' },
  { title: 'Exemplos', placeholder: 'Documentação em construção.' },
  { title: 'Observações', placeholder: 'Documentação em construção.' },
  { title: 'Perguntas Frequentes', placeholder: 'Documentação em construção.' },
];

export const DOCUMENTATION_FAQ_PLACEHOLDERS: DocumentationFAQItem[] = [
  {
    question: 'Como manter a documentação atualizada?',
    answer: 'Documentação em construção. Esta resposta será preenchida automaticamente em versões futuras.',
  },
  {
    question: 'Como usar o fluxo de exportação?',
    answer: 'Documentação em construção. O fluxo de exportação para PDF e PowerPoint será habilitado futuramente.',
  },
  {
    question: 'Como registrar mudanças de versão?',
    answer: 'Documentação em construção. O histórico será atualizado por versões do manual.',
  },
];

export const DOCUMENTATION_VERSION_PLACEHOLDERS: DocumentationVersionEntry[] = [
  {
    version: '1.0.0',
    date: '2026-01-01',
    description: 'Estrutura inicial do Centro de Documentação criada.',
  },
  {
    version: '1.0.1',
    date: 'A definir',
    description: 'Espaço reservado para futuras atualizações automáticas.',
  },
];

export const DOCUMENTATION_SCREEN_LABELS: Record<DocumentationSectionId, string> = {
  'visao-geral': 'Visão Geral',
  login: 'Login',
  dashboard: 'Dashboard',
  navios: 'Navios',
  ferramentas: 'Ferramentas',
  manutencao: 'Manutenção',
  escalas: 'Escalas',
  'split-operacional': 'Split Operacional',
  relatorios: 'Relatórios',
  configuracoes: 'Configurações',
  'inteligencia-artificial': 'Inteligência Artificial',
  sobre: 'Sobre',
  faq: 'FAQ',
  'historico-de-versoes': 'Histórico de Versões',
};