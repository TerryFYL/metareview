// MetaReview Statistical Engine — Public API
export { metaAnalysis, sensitivityAnalysis, subgroupAnalysis, cumulativeMetaAnalysis } from './meta-analysis';
export {
  calculateEffectSize,
  toOriginalScale,
  isLogScale,
  calculateCI,
  logOddsRatio,
  logRiskRatio,
  meanDifference,
  hedgesG,
  isBinaryData,
  isContinuousData,
  isHRData,
  isGenericData,
  logHazardRatio,
} from './effect-size';
export { funnelPlotData, eggersTest, galbraithPlotData } from './publication-bias';
export type { GalbraithPoint, GalbraithData } from './publication-bias';
export {
  normalCdf,
  normalQuantile,
  zToP,
  chiSquaredPValue,
  tToP,
} from './distributions';
