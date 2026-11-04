'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Bot,
  CalendarDays,
  Code2,
  ExternalLink,
  FlaskConical,
  Lightbulb,
  Network,
  Palette,
  Scale,
  ShieldCheck,
  Sun,
  TestTube,
  UserRound,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';
import type { AboutItem, TranslationDictionary } from '@/lib/i18n/types';

const SOURCE_CODE_URL = 'https://github.com/NemesisRE/famvacay';

type AboutText = TranslationDictionary['about'];

const HUMAN_ITEMS: { key: keyof AboutText['humanItems']; icon: LucideIcon }[] = [
  { key: 'idea', icon: Lightbulb },
  { key: 'design', icon: Palette },
  { key: 'architecture', icon: ShieldCheck },
  { key: 'testing', icon: FlaskConical },
];

const AI_ITEMS: { key: keyof AboutText['aiItems']; icon: LucideIcon }[] = [
  { key: 'code', icon: Code2 },
  { key: 'tests', icon: TestTube },
];

const CAPABILITIES: { key: keyof AboutText['capabilities']; icon: LucideIcon }[] = [
  { key: 'solver', icon: Network },
  { key: 'climate', icon: Sun },
  { key: 'pto', icon: CalendarDays },
  { key: 'privacy', icon: ShieldCheck },
];

const sectionTitleClass = 'text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white';
// One width for every intro/prose block so text edges line up across sections.
const proseClass = 'max-w-3xl';
const bodyClass = 'text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed';

// The AI and human badges look identical wherever they appear (hero and card headers);
// AI always comes first, matching the order of the hero text.
const BADGE_TONES = {
  ai: 'bg-violet-600 text-white',
  human: 'bg-teal-600 text-white',
} as const;

function RoleBadge({ role, label }: { role: keyof typeof BADGE_TONES; label: string }) {
  const Icon = role === 'ai' ? Bot : UserRound;
  return (
    <span className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold ${BADGE_TONES[role]}`}>
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

function ItemRow({ item, icon: Icon, iconClass }: { item: AboutItem; icon: LucideIcon; iconClass: string }) {
  return (
    <li className="flex gap-3">
      <span className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${iconClass}`}>
        <Icon className="w-4.5 h-4.5" aria-hidden="true" />
      </span>
      <div>
        <h4 className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</h4>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mt-0.5">{item.body}</p>
      </div>
    </li>
  );
}

export function AboutContent() {
  const { t } = useI18n();
  const a = t.about;

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-2">
      {/* 1. Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-teal-200/70 dark:border-teal-900/60 bg-gradient-to-br from-teal-50 via-white to-violet-50 dark:from-teal-950/50 dark:via-slate-900 dark:to-violet-950/40 p-6 sm:p-8">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-300 bg-white/80 dark:bg-slate-900/70 border border-teal-200 dark:border-teal-800 rounded-full px-3 py-1">
          <Scale className="w-3.5 h-3.5" aria-hidden="true" />
          {a.heroBadge}
        </span>
        <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white max-w-3xl leading-tight">
          {a.heroTitle}
        </h1>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <p className={bodyClass}>{a.heroIntro}</p>
          <p className={bodyClass}>{a.heroIntroSecond}</p>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <RoleBadge role="ai" label={a.aiSubtitle} />
          <RoleBadge role="human" label={a.humanSubtitle} />
        </div>
      </section>

      {/* 2. Division of labour */}
      <section aria-labelledby="about-division" className="space-y-6">
        <div className={proseClass}>
          <h2 id="about-division" className={sectionTitleClass}>{a.divisionTitle}</h2>
          <p className={`${bodyClass} mt-2`}>{a.divisionIntro}</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border-2 border-violet-200 dark:border-violet-800 bg-white dark:bg-slate-900 p-4 sm:p-6">
            <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              <span className="shrink-0 w-11 h-11 rounded-2xl bg-violet-600 text-white flex items-center justify-center">
                <Bot className="w-6 h-6" aria-hidden="true" />
              </span>
              <div className="min-w-0 space-y-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{a.aiTitle}</h3>
                <RoleBadge role="ai" label={a.aiSubtitle} />
              </div>
            </div>
            <ul className="space-y-3">
              {AI_ITEMS.map(({ key, icon }) => (
                <ItemRow
                  key={key}
                  item={a.aiItems[key]}
                  icon={icon}
                  iconClass="bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300"
                />
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border-2 border-teal-200 dark:border-teal-800 bg-white dark:bg-slate-900 p-4 sm:p-6">
            <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              <span className="shrink-0 w-11 h-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center">
                <UserRound className="w-6 h-6" aria-hidden="true" />
              </span>
              <div className="min-w-0 space-y-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{a.humanTitle}</h3>
                <RoleBadge role="human" label={a.humanSubtitle} />
              </div>
            </div>
            <ul className="space-y-3">
              {HUMAN_ITEMS.map(({ key, icon }) => (
                <ItemRow
                  key={key}
                  item={a.humanItems[key]}
                  icon={icon}
                  iconClass="bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300"
                />
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 3. Why FamVacay exists */}
      <section aria-labelledby="about-capabilities" className="space-y-6">
        <div className={proseClass}>
          <h2 id="about-capabilities" className={sectionTitleClass}>{a.capabilitiesTitle}</h2>
          <p className={`${bodyClass} mt-2`}>{a.capabilitiesIntro}</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {CAPABILITIES.map(({ key, icon: Icon }) => (
            <div
              key={key}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6"
            >
              <Icon className="w-6 h-6 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              <h3 className="mt-3 font-bold text-slate-900 dark:text-white">{a.capabilities[key].title}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{a.capabilities[key].body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Open & honest engineering */}
      <section
        aria-labelledby="about-honesty"
        className="rounded-3xl bg-slate-900 dark:bg-slate-900 border border-slate-800 text-white p-6 sm:p-8"
      >
        <h2 id="about-honesty" className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Scale className="w-6 h-6 text-teal-400" aria-hidden="true" />
          {a.honestyTitle}
        </h2>
        <div className="mt-3 space-y-3 max-w-3xl text-sm sm:text-base text-slate-300 leading-relaxed">
          <p>{a.honestyBody}</p>
          <p>{a.honestyBodySecond}</p>
        </div>
        <a
          href={SOURCE_CODE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-sm px-4 py-2.5 transition-colors"
        >
          <Code2 className="w-4 h-4" aria-hidden="true" />
          {a.sourceCodeLink}
          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
        </a>
      </section>
    </div>
  );
}
