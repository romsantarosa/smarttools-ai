import React from 'react';
import {
  Bot,
  Code2,
  Cpu,
  FileText,
  Info,
  LayoutDashboard,
  Monitor,
  ScanText,
  Ship,
  Smartphone,
  Sparkles,
  Tablet,
  Wrench,
  ShieldCheck,
  Settings2,
} from 'lucide-react';
import { M3Badge } from '../components/ui/M3Badge';
import { M3Card } from '../components/ui/M3Card';

const features = [
  { label: 'Dashboard Operacional', icon: LayoutDashboard },
  { label: 'Gestão de Navios', icon: Ship },
  { label: 'Ferramentas de Peação', icon: Wrench },
  { label: 'Controle de Manutenção', icon: Settings2 },
  { label: 'Escalas Operacionais', icon: Monitor },
  { label: 'Split Operacional', icon: FileText },
  { label: 'OCR de Documentos', icon: ScanText },
  { label: 'Inteligência Artificial', icon: Bot },
  { label: 'Relatórios', icon: Sparkles },
  { label: 'Plataforma Responsiva', icon: Smartphone },
];

const technologies = [
  'React',
  'TypeScript',
  'Node.js',
  'Express',
  'Google Gemini AI',
  'OCR',
  'PWA',
  'Responsive Design',
];

const platformBadges = [
  { label: 'Desktop', icon: Monitor },
  { label: 'Tablet', icon: Tablet },
  { label: 'Mobile', icon: Smartphone },
];

export const Sobre: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in pb-8 sm:pb-12">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 dark:border-tc-border bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white shadow-xl">
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.35),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(250,204,21,0.18),_transparent_30%)]" />
        <div className="relative p-6 sm:p-8 md:p-10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shadow-lg backdrop-blur-sm">
              <Info className="w-8 h-8 text-sky-300" />
            </div>
            <div className="space-y-2 min-w-0">
              <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.28em] text-sky-200/80">
                BTP SmartTools AI
              </p>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight">
                BTP SmartTools AI
              </h1>
              <p className="text-sm sm:text-base text-slate-200/90 font-medium max-w-3xl">
                Sistema Inteligente de Gestão Operacional Portuária
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-5">
        <M3Card className="xl:col-span-2 border border-slate-200 dark:border-tc-border shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-blue-100 dark:bg-tc-accent-soft p-2.5 text-blue-700 dark:text-tc-accent shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-3 min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                Sobre o Sistema
              </h2>
              <p className="text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-tc-ink-2">
                O BTP SmartTools AI é uma plataforma desenvolvida para otimizar a operação portuária através de Inteligência Artificial,
                automação de processos e gerenciamento operacional.
              </p>
              <p className="text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-tc-ink-2">
                O sistema foi projetado para centralizar informações, facilitar a tomada de decisões e aumentar a produtividade das equipes
                envolvidas nas operações de bordo.
              </p>
            </div>
          </div>
        </M3Card>

        <M3Card className="border border-slate-200 dark:border-tc-border shadow-sm">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-emerald-100 dark:bg-tc-good-soft p-2.5 text-emerald-700 dark:text-tc-good shrink-0">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  Versão
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-tc-ink-2 font-semibold mt-1">
                  Versão 1.0.0
                </p>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-tc-ink-3 font-medium">
                  Build 2026
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {platformBadges.map((badge) => {
                const Icon = badge.icon;
                return (
                  <M3Badge
                    key={badge.label}
                    label={badge.label}
                    variant="info"
                    icon={<Icon className="w-3.5 h-3.5" />}
                  />
                );
              })}
            </div>
          </div>
        </M3Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <M3Card className="border border-slate-200 dark:border-tc-border shadow-sm">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-amber-100 dark:bg-tc-warning-soft p-2.5 text-amber-700 dark:text-tc-warning">
                <Sparkles className="w-5 h-5" />
              </div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                Principais Recursos
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.label}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-tc-border bg-slate-50/80 dark:bg-tc-surface-1/50 px-3 py-2.5"
                  >
                    <div className="rounded-xl bg-white dark:bg-tc-surface-2 p-2 text-slate-700 dark:text-tc-ink-1 shadow-xs">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-tc-ink-1">
                      {feature.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </M3Card>

        <M3Card className="border border-slate-200 dark:border-tc-border shadow-sm">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-sky-100 dark:bg-tc-accent-soft p-2.5 text-sky-700 dark:text-tc-accent">
                <Code2 className="w-5 h-5" />
              </div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                Tecnologias
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {technologies.map((tech) => (
                <M3Badge key={tech} label={tech} variant="neutral" />
              ))}
            </div>
          </div>
        </M3Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        <M3Card className="border border-slate-200 dark:border-tc-border shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-violet-100 dark:bg-tc-accent-soft p-2.5 text-violet-700 dark:text-tc-accent shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div className="space-y-1 min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                Desenvolvedor
              </h2>
              <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                Rom Santa Rosa
              </p>
              <div className="space-y-1 text-xs sm:text-sm font-semibold text-slate-600 dark:text-tc-ink-2">
                <p>Analista e Desenvolvedor de Sistemas</p>
                <p>Especialista em Engenharia de Software</p>
                <p>Especialista em Gestão Portuária</p>
              </div>
            </div>
          </div>
        </M3Card>

        <M3Card className="border border-slate-200 dark:border-tc-border shadow-sm flex items-center justify-center text-center">
          <div className="space-y-2">
            <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.28em] text-slate-500 dark:text-tc-ink-3">
              Marca do Aplicativo
            </p>
            <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
              <Info className="w-8 h-8 text-sky-300" />
            </div>
            <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-tc-ink-2">
              Experiência moderna, responsiva e focada em operações portuárias.
            </p>
          </div>
        </M3Card>
      </div>

      <footer className="pt-2 text-center text-[11px] sm:text-xs text-slate-500 dark:text-tc-ink-3 leading-relaxed">
        <p>© 2026 Rom Santa Rosa</p>
        <p>Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};