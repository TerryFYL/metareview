// MetaReview Statistical Engine — Public API
export { metaAnalysis, sensitivityAnalysis, subgroupAnalysis, cumulativeMetaAnalysis, metaRegression } from './meta-analysis';
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
export { funnelPlotData, eggersTest, beggsTest, galbraithPlotData, labbeePlotData, trimAndFill } from './publication-bias';
export type { GalbraithPoint, GalbraithData, LabbePoint, LabbeData, TrimAndFillResult } from './publication-bias';
export {
  normalCdf,
  normalQuantile,
  zToP,
  chiSquaredPValue,
  tToP,
} from './distributions';
