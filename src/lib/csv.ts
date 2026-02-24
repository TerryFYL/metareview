// CSV Import/Export for MetaReview
// Handles both binary (OR/RR) and continuous (MD/SMD) data formats.

import type { Study, EffectMeasure, BinaryData, ContinuousData } from './types';

const isBinary = (m: EffectMeasure) => m === 'OR' || m === 'RR';

/** Generate a CSV string from studies */
export function exportCSV(studies: Study[], measure: EffectMeasure): string {
  const binary = isBinary(measure);

  const header = binary
    ? 'Study,Year,Subgroup,Events_T,Total_T,Events_C,Total_C'
    : 'Study,Year,Subgroup,Mean_T,SD_T,N_T,Mean_C,SD_C,N_C';

  const rows = studies.map((s) => {
    const name = s.name.includes(',') ? `"${s.name}"` : s.name;
    const year = s.year ?? '';
    const subgroup = s.subgroup ? (s.subgroup.includes(',') ? `"${s.subgroup}"` : s.subgroup) : '';

    if (binary) {
      const d = s.data as BinaryData;
      return `${name},${year},${subgroup},${d.events1},${d.total1},${d.events2},${d.total2}`;
    } else {
      const d = s.data as ContinuousData;
      return `${name},${year},${subgroup},${d.mean1},${d.sd1},${d.n1},${d.mean2},${d.sd2},${d.n2}`;
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

/** Parse a CSV string into Study[] */
export function importCSV(csvString: string, measure: EffectMeasure): Study[] {
  const binary = isBinary(measure);
  const lines = csvString.split(/\r?\n/).filter((line) => line.trim() !== '');

  if (lines.length < 2) return [];

  // Skip header row
  const dataLines = lines.slice(1);

  return dataLines.map((line) => {
    const fields = splitCSVLine(line).map(parseField);
    const name = fields[0] || 'Untitled';
    const year = fields[1] ? parseInt(fields[1]) : undefined;
    const subgroup = fields[2]?.trim() || undefined;
    const id = Math.random().toString(36).slice(2, 9);

    if (binary) {
      const data: BinaryData = {
        events1: parseFloat(fields[3]) || 0,
        total1: parseFloat(fields[4]) || 0,
        events2: parseFloat(fields[5]) || 0,
        total2: parseFloat(fields[6]) || 0,
      };
      return { id, name, year, subgroup, data };
    } else {
      const data: ContinuousData = {
        mean1: parseFloat(fields[3]) || 0,
        sd1: parseFloat(fields[4]) || 0,
        n1: parseFloat(fields[5]) || 0,
        mean2: parseFloat(fields[6]) || 0,
        sd2: parseFloat(fields[7]) || 0,
        n2: parseFloat(fields[8]) || 0,
      };
      return { id, name, year, subgroup, data };
    }
  });
}
