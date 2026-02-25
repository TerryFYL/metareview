import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Study, EffectMeasure, ModelType, PICO, MetaAnalysisResult, EggersTest, BeggsTest, MetaRegressionResult, RobAssessments, ProtocolData } from './lib/types';
import { isBinaryData, isContinuousData, isGenericData, isHRData } from './lib/statistics/effect-size';
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
  if (isHRData(first)) return newMeasure === 'HR';
  if (isBinaryData(first)) return BINARY_MEASURES.includes(newMeasure);
  if (isContinuousData(first)) return CONTINUOUS_MEASURES.includes(newMeasure);
  return false;
}

const MAX_HISTORY = 50;

interface ProjectStore {
  // Project data (persisted)
  title: string;
  pico: PICO;
  measure: EffectMeasure;
  model: ModelType;
  studies: Study[];
  prisma: PRISMAData;
  robAssessments: RobAssessments;
  protocol: ProtocolData;

  // Undo/redo history (not persisted)
  _history: Study[][];
  _historyIndex: number;

  // Actions
  setTitle: (title: string) => void;
  setPICO: (pico: PICO) => void;
  setMeasure: (measure: EffectMeasure) => void;
  setModel: (model: ModelType) => void;
  setStudies: (studies: Study[]) => void;
  setPRISMA: (prisma: PRISMAData) => void;
  setRobAssessments: (rob: RobAssessments) => void;
  setProtocol: (protocol: ProtocolData) => void;
  reset: () => void;
  loadDemo: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const emptyPICO: PICO = {
  population: '',
  intervention: '',
  comparison: '',
  outcome: '',
};

export const emptyProtocol: ProtocolData = {
  title: '',
  prosperoId: '',
  authors: '',
  contactEmail: '',
  rationale: '',
  studyTypes: [],
  participants: '',
  interventions: '',
  comparators: '',
  primaryOutcomes: '',
  secondaryOutcomes: '',
  timingOfOutcomes: '',
  setting: '',
  databases: [],
  otherSources: '',
  searchDateFrom: '',
  searchDateTo: '',
  searchStrategy: '',
  screeningProcess: '',
  dataExtractionProcess: '',
  dataItems: '',
  robTool: 'rob2',
  robDetails: '',
  effectMeasure: '',
  synthesisMethod: '',
  heterogeneityAssessment: '',
  subgroupAnalyses: '',
  sensitivityAnalyses: '',
  publicationBiasAssessment: '',
  confidenceAssessment: '',
  anticipatedStartDate: '',
  anticipatedEndDate: '',
  funding: '',
  conflictsOfInterest: '',
};

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      title: '',
      pico: emptyPICO,
      measure: 'OR' as EffectMeasure,
      model: 'random' as ModelType,
      studies: [],
      prisma: emptyPRISMA,
      robAssessments: {} as RobAssessments,
      protocol: emptyProtocol,
      _history: [[]] as Study[][],
      _historyIndex: 0,

      setTitle: (title) => set({ title }),
      setPICO: (pico) => set({ pico }),
      setMeasure: (measure) => set((state) => {
        const compatible = studiesCompatible(state.studies, measure);
        const newStudies = compatible ? state.studies : [];
        if (!compatible) {
          // Push cleared studies to history
          const newHistory = state._history.slice(0, state._historyIndex + 1);
          newHistory.push(newStudies);
          if (newHistory.length > MAX_HISTORY) newHistory.shift();
          return { measure, studies: newStudies, _history: newHistory, _historyIndex: newHistory.length - 1 };
        }
        return { measure };
      }),
      setModel: (model) => set({ model }),
      setStudies: (studies) => set((state) => {
        const newHistory = state._history.slice(0, state._historyIndex + 1);
        newHistory.push(studies);
        if (newHistory.length > MAX_HISTORY) newHistory.shift();
        return { studies, _history: newHistory, _historyIndex: newHistory.length - 1 };
      }),
      setPRISMA: (prisma) => set({ prisma }),
      setRobAssessments: (robAssessments) => set({ robAssessments }),
      setProtocol: (protocol) => set({ protocol }),
      undo: () => set((state) => {
        if (state._historyIndex <= 0) return {};
        const newIndex = state._historyIndex - 1;
        return { studies: state._history[newIndex], _historyIndex: newIndex };
      }),
      redo: () => set((state) => {
        if (state._historyIndex >= state._history.length - 1) return {};
        const newIndex = state._historyIndex + 1;
        return { studies: state._history[newIndex], _historyIndex: newIndex };
      }),
      canUndo: () => {
        const state = get();
        return state._historyIndex > 0;
      },
      canRedo: () => {
        const state = get();
        return state._historyIndex < state._history.length - 1;
      },
      reset: () =>
        set({
          title: '',
          pico: emptyPICO,
          measure: 'OR',
          model: 'random',
          studies: [],
          prisma: emptyPRISMA,
          robAssessments: {} as RobAssessments,
          protocol: emptyProtocol,
          _history: [[]],
          _historyIndex: 0,
        }),
      loadDemo: () =>
        set({
          title: 'Aspirin for Primary Prevention of Cardiovascular Events',
          pico: {
            population: 'Adults without established cardiovascular disease',
            intervention: 'Aspirin (75-500 mg/day)',
            comparison: 'Placebo or no aspirin',
            outcome: 'Composite cardiovascular events (CV death, nonfatal MI, nonfatal stroke)',
          },
          measure: 'RR',
          model: 'random',
          studies: [
            {
              id: 'd1',
              name: 'PHS',
              year: 1989,
              subgroup: 'Low CV Risk',
              data: { events1: 217, total1: 11037, events2: 227, total2: 11034 },
            },
            {
              id: 'd2',
              name: 'TPT',
              year: 1998,
              subgroup: 'High CV Risk',
              data: { events1: 83, total1: 1268, events2: 107, total2: 1272 },
            },
            {
              id: 'd3',
              name: 'HOT',
              year: 1998,
              subgroup: 'High CV Risk',
              data: { events1: 284, total1: 9399, events2: 305, total2: 9391 },
            },
            {
              id: 'd4',
              name: 'PPP',
              year: 2003,
              subgroup: 'Low CV Risk',
              data: { events1: 62, total1: 2226, events2: 78, total2: 2269 },
            },
            {
              id: 'd5',
              name: 'WHS',
              year: 2005,
              subgroup: 'Low CV Risk',
              data: { events1: 477, total1: 19934, events2: 522, total2: 19942 },
            },
            {
              id: 'd6',
              name: 'POPADAD',
              year: 2008,
              subgroup: 'High CV Risk',
              data: { events1: 116, total1: 638, events2: 117, total2: 638 },
            },
            {
              id: 'd7',
              name: 'JPAD',
              year: 2008,
              subgroup: 'High CV Risk',
              data: { events1: 68, total1: 1262, events2: 86, total2: 1277 },
            },
            {
              id: 'd8',
              name: 'AAA',
              year: 2010,
              subgroup: 'High CV Risk',
              data: { events1: 181, total1: 1675, events2: 176, total2: 1675 },
            },
            {
              id: 'd9',
              name: 'JPPP',
              year: 2014,
              subgroup: 'Low CV Risk',
              data: { events1: 193, total1: 7220, events2: 207, total2: 7244 },
            },
            {
              id: 'd10',
              name: 'ARRIVE',
              year: 2018,
              subgroup: 'Low CV Risk',
              data: { events1: 269, total1: 6270, events2: 281, total2: 6276 },
            },
            {
              id: 'd11',
              name: 'ASCEND',
              year: 2018,
              subgroup: 'High CV Risk',
              data: { events1: 658, total1: 7740, events2: 743, total2: 7740 },
            },
            {
              id: 'd12',
              name: 'ASPREE',
              year: 2018,
              subgroup: 'Low CV Risk',
              data: { events1: 448, total1: 9525, events2: 474, total2: 9589 },
            },
          ],
        }),
    }),
    {
      name: 'metareview-project',
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _history, _historyIndex, ...rest } = state;
        return rest;
      },
    }
  )
);

// UI store (lang is persisted, rest is not)
export type ColorScheme = 'default' | 'bw' | 'colorblind';

export type ForestSortBy = 'default' | 'effect' | 'year' | 'weight' | 'name';

export interface PlotSettings {
  colorScheme: ColorScheme;
  fontSize: number;
  showWeights: boolean;
  customTitle: string;
  customXLabel: string;
  favoursLeftLabel: string;
  favoursRightLabel: string;
  forestSortBy: ForestSortBy;
}

const defaultPlotSettings: PlotSettings = {
  colorScheme: 'default',
  fontSize: 11,
  showWeights: true,
  customTitle: '',
  customXLabel: '',
  favoursLeftLabel: '',
  favoursRightLabel: '',
  forestSortBy: 'default',
};

interface UIStore {
  lang: Lang;
  heroSeen: boolean;
  tourSeen: boolean;
  result: MetaAnalysisResult | null;
  eggers: EggersTest | null;
  beggs: BeggsTest | null;
  metaRegression: MetaRegressionResult | null;
  error: string | null;
  activeTab: 'input' | 'results' | 'forest' | 'funnel' | 'galbraith' | 'labbe' | 'baujat' | 'cumulative' | 'sensitivity' | 'influence' | 'subgroup' | 'metareg' | 'grade' | 'rob' | 'prisma' | 'search' | 'extract' | 'loo' | 'network' | 'doseresponse' | 'protocol';
  plotSettings: PlotSettings;
  setLang: (lang: Lang) => void;
  setHeroSeen: (seen: boolean) => void;
  setTourSeen: (seen: boolean) => void;
  setResult: (result: MetaAnalysisResult | null) => void;
  setEggers: (eggers: EggersTest | null) => void;
  setBeggs: (beggs: BeggsTest | null) => void;
  setMetaRegression: (metaReg: MetaRegressionResult | null) => void;
  setError: (error: string | null) => void;
  setActiveTab: (tab: UIStore['activeTab']) => void;
  setPlotSettings: (settings: Partial<PlotSettings>) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      lang: 'zh',
      heroSeen: false,
      tourSeen: false,
      result: null,
      eggers: null,
      beggs: null,
      metaRegression: null,
      error: null,
      activeTab: 'input',
      plotSettings: defaultPlotSettings,
      setLang: (lang) => set({ lang }),
      setHeroSeen: (heroSeen) => set({ heroSeen }),
      setTourSeen: (tourSeen) => set({ tourSeen }),
      setResult: (result) => set({ result }),
      setEggers: (eggers) => set({ eggers }),
      setBeggs: (beggs) => set({ beggs }),
      setMetaRegression: (metaRegression) => set({ metaRegression }),
      setError: (error) => set({ error }),
      setActiveTab: (activeTab) => set({ activeTab }),
      setPlotSettings: (settings) => set((state) => ({
        plotSettings: { ...state.plotSettings, ...settings },
      })),
    }),
    {
      name: 'metareview-ui',
      partialize: (state) => ({ lang: state.lang, heroSeen: state.heroSeen, tourSeen: state.tourSeen, plotSettings: state.plotSettings }),
    }
  )
);
