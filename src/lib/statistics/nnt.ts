// NNT/NNH (Number Needed to Treat / Number Needed to Harm) calculation
// Reference: Cochrane Handbook §15.4.4; Altman DG, BMJ 1998;317:1309
//
// NNT = 1 / ARD, where ARD = Absolute Risk Difference = CER - EER
//   For RR: EER = CER × RR → ARD = CER × (1 - RR)
//   For OR: EER = (CER × OR) / (1 - CER + CER × OR) → ARD = CER - EER
//
// CER (Control Event Rate) is pooled from the control arms of all studies.

import type { Study, MetaAnalysisResult, NNTResult, BinaryData } from '../types';
import { isBinaryData } from './effect-size';

/** Compute experimental event rate from control event rate and effect measure */
function computeEER(cer: number, effect: number, measure: 'OR' | 'RR'): number {
  if (measure === 'RR') {
    return cer * effect;
  }
  // OR: Sackett's formula
  return (cer * effect) / (1 - cer + cer * effect);
}

/**
 * Calculate NNT/NNH from meta-analysis result and original studies.
 * Only applicable to binary outcomes (OR, RR).
 * Returns null for continuous outcomes, zero-event scenarios, or non-binary data.
 */
export function calculateNNT(
  result: MetaAnalysisResult,
  studies: Study[]
): NNTResult | null {
  const { measure, effect, ciLower, ciUpper } = result;

  // Only for binary ratio measures
  if (measure !== 'OR' && measure !== 'RR') return null;

  // Pool CER from raw binary data (control arm = group 2)
  const binaryStudies = studies.filter(s => isBinaryData(s.data));
  if (binaryStudies.length === 0) return null;

  let totalControlEvents = 0;
  let totalControlN = 0;
  for (const s of binaryStudies) {
    const d = s.data as BinaryData;
    totalControlEvents += d.events2;
    totalControlN += d.total2;
  }

  if (totalControlN === 0) return null;
  const cer = totalControlEvents / totalControlN;
  if (cer <= 0 || cer >= 1) return null;

  // Event rates
  const eer = computeEER(cer, effect, measure);
  const eerFromLower = computeEER(cer, ciLower, measure);
  const eerFromUpper = computeEER(cer, ciUpper, measure);

  // ARD = CER - EER (positive = treatment reduces risk = NNT benefit)
  const ard = cer - eer;
  if (Math.abs(ard) < 1e-10) return null;

  const isHarm = ard < 0;
  const nnt = 1 / Math.abs(ard);

  // ARD from CI bounds (note: ciLower effect → larger ARD, ciUpper → smaller ARD for protective)
  const ardFromCILower = cer - eerFromUpper; // upper RR/OR → less benefit → smaller ARD
  const ardFromCIUpper = cer - eerFromLower; // lower RR/OR → more benefit → larger ARD

  // NNT CI
  let nntCILower: number;
  let nntCIUpper: number;

  // When both ARD bounds have same sign, CI is straightforward
  if (ardFromCILower > 0 && ardFromCIUpper > 0) {
    // Both beneficial
    nntCILower = 1 / ardFromCIUpper; // larger ARD → smaller NNT (better bound)
    nntCIUpper = 1 / ardFromCILower; // smaller ARD → larger NNT
  } else if (ardFromCILower < 0 && ardFromCIUpper < 0) {
    // Both harmful
    nntCILower = 1 / Math.abs(ardFromCILower);
    nntCIUpper = 1 / Math.abs(ardFromCIUpper);
  } else {
    // CI crosses null → NNT CI is discontinuous (goes through ±∞)
    // Report the finite bound and Infinity for the other
    if (isHarm) {
      nntCILower = 1 / Math.abs(ard);
      nntCIUpper = Infinity;
    } else {
      nntCILower = 1 / Math.abs(ard);
      nntCIUpper = Infinity;
    }
  }

  // Ensure lower ≤ upper
  if (nntCILower > nntCIUpper && isFinite(nntCIUpper)) {
    [nntCILower, nntCIUpper] = [nntCIUpper, nntCILower];
  }

  return {
    nnt,
    nntCILower,
    nntCIUpper,
    isHarm,
    absoluteRiskDifference: ard,
    controlEventRate: cer,
    experimentalEventRate: eer,
  };
}
