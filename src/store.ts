import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Study, EffectMeasure, ModelType, PICO, MetaAnalysisResult, EggersTest } from './lib/types';
import { isBinaryData, isContinuousData, isGenericData } from './lib/statistics/effect-size';
import type { Lang } from './lib/i18n';
import type { PRISMAData } from './components/PRISMAFlow';
import { emptyPRISMA } from './components/PRISMAFlow';

const BINARY_MEASURES: EffectMeasure[] = ['OR', 'RR'];
const CONTINUOUS_MEASURES: EffectMeasure[] = ['MD', 'SMD'];

/** Check if studies are compatible with the new measure */
function studiesCompatible(studies: Study[], newMeasure: EffectMeasure): boolean {
  if (studies.length === 0) return true;
  const first = studies[0].data;
  if (isGenericData(first)) return true;
  if (isBinaryData(first)) return BINARY_MEASURES.includes(newMeasure);
  if (isContinuousData(first)) return CONTINUOUS_MEASURES.includes(newMeasure);
  return false;
}

interface ProjectStore {
  // Project data (persisted)
  title: string;
  pico: PICO;
  measure: EffectMeasure;
  model: ModelType;
  studies: Study[];
  prisma: PRISMAData;

  // Actions
  setTitle: (title: string) => void;
  setPICO: (pico: PICO) => void;
  setMeasure: (measure: EffectMeasure) => void;
  setModel: (model: ModelType) => void;
  setStudies: (studies: Study[]) => void;
  setPRISMA: (prisma: PRISMAData) => void;
  reset: () => void;
  loadDemo: () => void;
}

const emptyPICO: PICO = {
  population: '',
  intervention: '',
  comparison: '',
  outcome: '',
};

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set) => ({
      title: '',
      pico: emptyPICO,
      measure: 'OR' as EffectMeasure,
      model: 'random' as ModelType,
      studies: [],
      prisma: emptyPRISMA,

      setTitle: (title) => set({ title }),
      setPICO: (pico) => set({ pico }),
      setMeasure: (measure) => set((state) => ({
        measure,
        studies: studiesCompatible(state.studies, measure) ? state.studies : [],
      })),
      setModel: (model) => set({ model }),
      setStudies: (studies) => set({ studies }),
      setPRISMA: (prisma) => set({ prisma }),
      reset: () =>
        set({
          title: '',
          pico: emptyPICO,
          measure: 'OR',
          model: 'random',
          studies: [],
          prisma: emptyPRISMA,
        }),
      loadDemo: () =>
        set({
          title: 'Aspirin vs Placebo for Cardiovascular Events',
          pico: {
            population: 'Adults at risk of cardiovascular disease',
            intervention: 'Aspirin (75-325 mg/day)',
            comparison: 'Placebo',
            outcome: 'Major cardiovascular events (MI, stroke, CV death)',
          },
          measure: 'OR',
          model: 'random',
          studies: [
            {
              id: 'd1',
              name: 'ISIS-2',
              year: 1988,
              subgroup: 'Secondary Prevention',
              data: { events1: 791, total1: 8587, events2: 1029, total2: 8600 },
            },
            {
              id: 'd2',
              name: 'SALT',
              year: 1991,
              subgroup: 'Secondary Prevention',
              data: { events1: 150, total1: 676, events2: 196, total2: 684 },
            },
            {
              id: 'd3',
              name: 'UK-TIA',
              year: 1991,
              subgroup: 'Secondary Prevention',
              data: { events1: 286, total1: 1632, events2: 168, total2: 814 },
            },
            {
              id: 'd4',
              name: 'ESPS-2',
              year: 1996,
              subgroup: 'Secondary Prevention',
              data: { events1: 356, total1: 1649, events2: 441, total2: 1649 },
            },
            {
              id: 'd5',
              name: 'TPT',
              year: 1998,
              subgroup: 'Primary Prevention',
              data: { events1: 142, total1: 2545, events2: 166, total2: 2540 },
            },
            {
              id: 'd6',
              name: 'HOT',
              year: 1998,
              subgroup: 'Primary Prevention',
              data: { events1: 127, total1: 9399, events2: 151, total2: 9391 },
            },
            {
              id: 'd7',
              name: 'PPP',
              year: 2001,
              subgroup: 'Primary Prevention',
              data: { events1: 20, total1: 2226, events2: 32, total2: 2269 },
            },
          ],
        }),
    }),
    { name: 'metareview-project' }
  )
);

// UI store (lang is persisted, rest is not)
interface UIStore {
  lang: Lang;
  heroSeen: boolean;
  result: MetaAnalysisResult | null;
  eggers: EggersTest | null;
  error: string | null;
  activeTab: 'input' | 'results' | 'forest' | 'funnel' | 'sensitivity' | 'subgroup' | 'prisma' | 'search' | 'extract';
  setLang: (lang: Lang) => void;
  setHeroSeen: (seen: boolean) => void;
  setResult: (result: MetaAnalysisResult | null) => void;
  setEggers: (eggers: EggersTest | null) => void;
  setError: (error: string | null) => void;
  setActiveTab: (tab: UIStore['activeTab']) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      lang: 'zh',
      heroSeen: false,
      result: null,
      eggers: null,
      error: null,
      activeTab: 'input',
      setLang: (lang) => set({ lang }),
      setHeroSeen: (heroSeen) => set({ heroSeen }),
      setResult: (result) => set({ result }),
      setEggers: (eggers) => set({ eggers }),
      setError: (error) => set({ error }),
      setActiveTab: (activeTab) => set({ activeTab }),
    }),
    {
      name: 'metareview-ui',
      partialize: (state) => ({ lang: state.lang, heroSeen: state.heroSeen }),
    }
  )
);
