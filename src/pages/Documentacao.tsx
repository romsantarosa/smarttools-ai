import React, { useMemo, useState } from 'react';
import { BookOpenText, Search, FileOutput, Presentation, Printer, Camera, Bot, Video } from 'lucide-react';
import {
  DOCUMENTATION_FAQ_PLACEHOLDERS,
  DOCUMENTATION_MENU_ITEMS,
  DOCUMENTATION_SCREEN_LABELS,
  DOCUMENTATION_TEMPLATE_FIELDS,
  DOCUMENTATION_VERSION_PLACEHOLDERS,
} from '../data/documentationData';
import { DocumentationLayout } from '../components/documentation/DocumentationLayout';
import { DocumentationMenu } from '../components/documentation/DocumentationMenu';
import { DocumentationCard } from '../components/documentation/DocumentationCard';
import { DocumentationSection } from '../components/documentation/DocumentationSection';
import { DocumentationImage } from '../components/documentation/DocumentationImage';
import { DocumentationFAQ } from '../components/documentation/DocumentationFAQ';
import { DocumentationFlow } from '../components/documentation/DocumentationFlow';
import { DocumentationVersion } from '../components/documentation/DocumentationVersion';
import { DocumentationSectionId } from '../types/documentation';
import { M3Badge } from '../components/ui/M3Badge';

const FUTURE_ACTIONS = [
  { label: 'Exportar PDF', icon: FileOutput },
  { label: 'Exportar PowerPoint', icon: Presentation },
  { label: 'Imprimir documentação', icon: Printer },
  { label: 'Capturar screenshots automaticamente', icon: Camera },
  { label: 'Gerar documentação com IA', icon: Bot },
  { label: 'Criar vídeos tutoriais', icon: Video },
];

export const Documentacao: React.FC = () => {
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState<DocumentationSectionId>('visao-geral');

  const filteredMenu = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return DOCUMENTATION_MENU_ITEMS;
    }

    return DOCUMENTATION_MENU_ITEMS.filter((item) => item.label.toLowerCase().includes(query));
  }, [search]);

  const canRenderSection = filteredMenu.some((item) => item.id === activeSection);
  const selectedSection = canRenderSection ? activeSection : filteredMenu[0]?.id ?? 'visao-geral';
  const selectedLabel = DOCUMENTATION_SCREEN_LABELS[selectedSection];

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white shadow-xl overflow-hidden">
        <div className="p-6 sm:p-8 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-[11px] uppercase tracking-wider font-bold text-sky-200">
            <BookOpenText className="w-3.5 h-3.5" />
            Documentação
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Centro de Documentação</h1>
            <p className="text-xs sm:text-sm text-slate-200/90 font-medium">Manual Oficial do BTP SmartTools AI</p>
          </div>

          <div className="relative max-w-2xl">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar tela, módulo ou funcionalidade..."
              className="w-full rounded-2xl border border-white/20 bg-white/10 text-white placeholder:text-slate-300 pl-9 pr-3 py-2.5 text-xs sm:text-sm font-medium backdrop-blur-sm focus:outline-hidden focus:ring-2 focus:ring-sky-300/40"
            />
          </div>
        </div>
      </section>

      <DocumentationLayout
        menu={<DocumentationMenu items={filteredMenu} activeId={selectedSection} onSelect={setActiveSection} />}
        content={
          <>
            <DocumentationCard
              title={selectedLabel}
              subtitle="Estrutura padrão para documentação oficial da tela selecionada"
            >
              <div className="space-y-3">
                {selectedSection === 'faq' ? (
                  <DocumentationFAQ items={DOCUMENTATION_FAQ_PLACEHOLDERS} />
                ) : selectedSection === 'historico-de-versoes' ? (
                  <DocumentationVersion entries={DOCUMENTATION_VERSION_PLACEHOLDERS} />
                ) : (
                  <div className="space-y-3">
                    {DOCUMENTATION_TEMPLATE_FIELDS.map((field) => (
                      <DocumentationSection key={field.title} title={field.title} placeholder={field.placeholder}>
                        {field.title === 'Imagem da Tela' ? (
                          <DocumentationImage />
                        ) : field.title === 'Fluxo de Utilização' ? (
                          <DocumentationFlow
                            steps={[
                              'Documentação em construção.',
                              'Espaço reservado para fluxo detalhado da tela.',
                              'Espaço reservado para validações e boas práticas.',
                            ]}
                          />
                        ) : (
                          <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">Documentação em construção.</p>
                        )}
                      </DocumentationSection>
                    ))}
                  </div>
                )}
              </div>
            </DocumentationCard>

            <DocumentationCard
              title="Arquitetura preparada para o futuro"
              subtitle="Infraestrutura pronta para exportação, impressão, automação por IA e evolução do manual"
            >
              <div className="flex flex-wrap gap-2 mb-3">
                {['Manual do usuário', 'Treinamento', 'Ajuda online', 'FAQ', 'Histórico de versões'].map((tag) => (
                  <M3Badge key={tag} label={tag} variant="info" />
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {FUTURE_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  return (
                    <div
                      key={action.label}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 flex items-center justify-between"
                    >
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <Icon className="w-4 h-4 text-slate-500" />
                        {action.label}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        Em breve
                      </span>
                    </div>
                  );
                })}
              </div>
            </DocumentationCard>
          </>
        }
      />
    </div>
  );
};