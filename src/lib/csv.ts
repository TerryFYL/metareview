// CSV Import/Export for MetaReview
// Handles binary (OR/RR), continuous (MD/SMD), and HR data formats.

import type { Study, EffectMeasure, BinaryData, ContinuousData, HRData, MetaAnalysisResult, EggersTest, BeggsTest, SubgroupAnalysisResult, SensitivityResult, MetaRegressionResult, GradeAssessment, InfluenceDiagnostic, DoseResponseResult, CumulativeResult } from './types';
import type { TrimAndFillResult } from './statistics/publication-bias';

const isBinary = (m: EffectMeasure) => m === 'OR' || m === 'RR';
const isHRMeasure = (m: EffectMeasure) => m === 'HR';

/** Generate a CSV string from studies */
export function exportCSV(studies: Study[], measure: EffectMeasure): string {
  const binary = isBinary(measure);
  const hr = isHRMeasure(measure);

  const header = hr
    ? 'Study,Year,Subgroup,Dose,HR,CI_Lower,CI_Upper'
    : binary
    ? 'Study,Year,Subgroup,Dose,Events_T,Total_T,Events_C,Total_C'
    : 'Study,Year,Subgroup,Dose,Mean_T,SD_T,N_T,Mean_C,SD_C,N_C';

  const rows = studies.map((s) => {
    const name = s.name.includes(',') ? `"${s.name}"` : s.name;
    const year = s.year ?? '';
    const subgroup = s.subgroup ? (s.subgroup.includes(',') ? `"${s.subgroup}"` : s.subgroup) : '';
    const dose = s.dose != null ? s.dose : '';

    if (hr) {
      const d = s.data as HRData;
      return `${name},${year},${subgroup},${dose},${d.hr},${d.ciLower},${d.ciUpper}`;
    } else if (binary) {
      const d = s.data as BinaryData;
      return `${name},${year},${subgroup},${dose},${d.events1},${d.total1},${d.events2},${d.total2}`;
    } else {
      const d = s.data as ContinuousData;
      return `${name},${year},${subgroup},${dose},${d.mean1},${d.sd1},${d.n1},${d.mean2},${d.sd2},${d.n2}`;
    }
  });

  return [header, ...rows].join('\n');
}

/** Parse a CSV field, handling quoted values */
function parseField(field: string): string {
  const trimmed = field.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/** Split a CSV line respecting quoted commas */
function splitCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/** Minimum total columns (metadata + data) required for each measure type */
function minColumnsForMeasure(measure: EffectMeasure): number {
  // 4 metadata cols (Study, Year, Subgroup, Dose) + data cols
  if (isHRMeasure(measure)) return 7;      // + 3 (HR, CI_Lower, CI_Upper)
  if (isBinary(measure)) return 8;          // + 4 (Events_T, Total_T, Events_C, Total_C)
  return 10;                                // + 6 (Mean_T, SD_T, N_T, Mean_C, SD_C, N_C)
}

export interface CSVImportResult {
  studies: Study[];
  skippedRows: number;
  expectedColumns: number;
  /** Column count of the first skipped row (for error messaging) */
  actualColumns?: number;
}

/** Parse a CSV string into Study[] with column validation */
export function importCSV(csvString: string, measure: EffectMeasure): CSVImportResult {
  const binary = isBinary(measure);
  const hr = isHRMeasure(measure);
  const lines = csvString.split(/\r?\n/).filter((line) => line.trim() !== '');
  const expectedCols = minColumnsForMeasure(measure);

  if (lines.length < 2) return { studies: [], skippedRows: 0, expectedColumns: expectedCols };

  // Skip header row
  const dataLines = lines.slice(1);

  const studies: Study[] = [];
  let skippedRows = 0;
  let firstSkippedActual: number | undefined;

  for (const line of dataLines) {
    const fields = splitCSVLine(line).map(parseField);

    // Skip rows with insufficient columns
    if (fields.length < expectedCols) {
      skippedRows++;
      if (firstSkippedActual === undefined) firstSkippedActual = fields.length;
      continue;
    }

    const name = fields[0] || 'Untitled';
    const year = fields[1] ? parseInt(fields[1]) : undefined;
    const subgroup = fields[2]?.trim() || undefined;
    const doseStr = fields[3]?.trim();
    const dose = doseStr ? parseFloat(doseStr) : undefined;
    const id = Math.random().toString(36).slice(2, 9);

    if (hr) {
      const data: HRData = {
        hr: parseFloat(fields[4]) || 0,
        ciLower: parseFloat(fields[5]) || 0,
        ciUpper: parseFloat(fields[6]) || 0,
      };
      studies.push({ id, name, year, subgroup, dose: dose != null && !isNaN(dose) ? dose : undefined, data });
    } else if (binary) {
      const data: BinaryData = {
        events1: parseFloat(fields[4]) || 0,
        total1: parseFloat(fields[5]) || 0,
        events2: parseFloat(fields[6]) || 0,
        total2: parseFloat(fields[7]) || 0,
      };
      studies.push({ id, name, year, subgroup, dose: dose != null && !isNaN(dose) ? dose : undefined, data });
    } else {
      const data: ContinuousData = {
        mean1: parseFloat(fields[4]) || 0,
        sd1: parseFloat(fields[5]) || 0,
        n1: parseFloat(fields[6]) || 0,
        mean2: parseFloat(fields[7]) || 0,
        sd2: parseFloat(fields[8]) || 0,
        n2: parseFloat(fields[9]) || 0,
      };
      studies.push({ id, name, year, subgroup, dose: dose != null && !isNaN(dose) ? dose : undefined, data });
    }
  }

  return { studies, skippedRows, expectedColumns: expectedCols, actualColumns: firstSkippedActual };
}

/** Export complete analysis results as JSON */
export interface JSONExportData {
  meta: { tool: string; version: string; exportedAt: string };
  settings: { measure: EffectMeasure; model: string };
  studies: Study[];
  result: MetaAnalysisResult | null;
  diagnostics: {
    eggers: EggersTest | null;
    beggs: BeggsTest | null;
    trimFill: TrimAndFillResult | null;
    metaRegression: MetaRegressionResult | null;
    influenceDiagnostics: InfluenceDiagnostic[];
    grade: GradeAssessment | null;
    doseResponse: DoseResponseResult | null;
  };
  subgroupResult: SubgroupAnalysisResult | null;
  sensitivityResults: SensitivityResult[];
  cumulativeResults: CumulativeResult[];
}

export function exportJSON(data: {
  studies: Study[];
  measure: EffectMeasure;
  model: string;
  result: MetaAnalysisResult | null;
  eggers: EggersTest | null;
  beggs: BeggsTest | null;
  trimFill: TrimAndFillResult | null;
  metaRegression: MetaRegressionResult | null;
  influenceDiagnostics: InfluenceDiagnostic[];
  gradeAssessment: GradeAssessment | null;
  doseResponse: DoseResponseResult | null;
  subgroupResult: SubgroupAnalysisResult | null;
  sensitivityResults: SensitivityResult[];
  cumulativeResults: CumulativeResult[];
}): string {
  const exportData: JSONExportData = {
    meta: {
      tool: 'MetaReview',
      version: '1.0',
      exportedAt: new Date().toISOString(),
    },
    settings: {
      measure: data.measure,
      model: data.model,
    },
    studies: data.studies,
    result: data.result,
    diagnostics: {
      eggers: data.eggers,
      beggs: data.beggs,
      trimFill: data.trimFill,
      metaRegression: data.metaRegression,
      influenceDiagnostics: data.influenceDiagnostics,
      grade: data.gradeAssessment,
      doseResponse: data.doseResponse,
    },
    subgroupResult: data.subgroupResult,
    sensitivityResults: data.sensitivityResults,
    cumulativeResults: data.cumulativeResults,
  };
  return JSON.stringify(exportData, null, 2);
}
