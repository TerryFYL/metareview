// RIS/EndNote Import for MetaReview
// Supports .ris (RIS) and .enw (EndNote) formats.
// Extracts study name, year, and creates empty data studies for manual entry.

import type { Study, EffectMeasure, BinaryData, ContinuousData, HRData } from './types';

interface RISRecord {
  title: string;
  authors: string[];
  year?: number;
}

/** Parse a RIS format file into records */
function parseRIS(text: string): RISRecord[] {
  const records: RISRecord[] = [];
  let current: RISRecord | null = null;

  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    // RIS tag format: "TY  - JOUR" (2-char tag, 2 spaces, dash, space, value)
    const match = line.match(/^([A-Z][A-Z0-9])\s{2}-\s(.*)$/);

    if (!match) continue;
    const [, tag, value] = match;
    const trimmed = value.trim();

    switch (tag) {
      case 'TY': // Type — start of new record
        if (current && (current.title || current.authors.length > 0)) {
          records.push(current);
        }
        current = { title: '', authors: [], year: undefined };
        break;
      case 'TI': // Title
      case 'T1': // Primary Title (alternative)
        if (current && !current.title) current.title = trimmed;
        break;
      case 'AU': // Author
      case 'A1': // First Author (alternative)
        if (current && trimmed) current.authors.push(trimmed);
        break;
      case 'PY': // Publication Year
      case 'Y1': // Year (alternative)
        if (current && !current.year) {
          const yr = parseInt(trimmed.split('/')[0]);
          if (yr > 1800 && yr < 2100) current.year = yr;
        }
        break;
      case 'DA': // Date
        if (current && !current.year) {
          const yr = parseInt(trimmed.split('/')[0]);
          if (yr > 1800 && yr < 2100) current.year = yr;
        }
        break;
      case 'ER': // End of Record
        if (current && (current.title || current.authors.length > 0)) {
          records.push(current);
        }
        current = null;
        break;
    }
  }

  // Handle last record if no ER tag
  if (current && (current.title || current.authors.length > 0)) {
    records.push(current);
  }

  return records;
}

/** Parse an EndNote export (.enw) file into records */
function parseEndNote(text: string): RISRecord[] {
  // EndNote Tagged format uses % prefixed tags: %0 Type, %A Author, %T Title, %D Year
  const records: RISRecord[] = [];
  let current: RISRecord | null = null;

  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^%([0-9A-Z])\s(.*)$/);

    if (!match) continue;
    const [, tag, value] = match;
    const trimmed = value.trim();

    switch (tag) {
      case '0': // Reference type — start of new record
        if (current && (current.title || current.authors.length > 0)) {
          records.push(current);
        }
        current = { title: '', authors: [], year: undefined };
        break;
      case 'T': // Title
        if (current && !current.title) current.title = trimmed;
        break;
      case 'A': // Author
        if (current && trimmed) current.authors.push(trimmed);
        break;
      case 'D': // Date/Year
        if (current && !current.year) {
          const yr = parseInt(trimmed);
          if (yr > 1800 && yr < 2100) current.year = yr;
        }
        break;
    }
  }

  // Handle last record
  if (current && (current.title || current.authors.length > 0)) {
    records.push(current);
  }

  return records;
}

/** Detect format and parse */
function detectAndParse(text: string): RISRecord[] {
  // Check if it's EndNote format (starts with %0)
  if (text.trimStart().startsWith('%0')) {
    return parseEndNote(text);
  }
  // Default to RIS format
  return parseRIS(text);
}

/** Build study name from record: "Author et al., Year" or title truncation */
function buildStudyName(record: RISRecord): string {
  if (record.authors.length > 0) {
    // Extract last name from first author (format: "Last, First" or "Last")
    const firstAuthor = record.authors[0];
    const lastName = firstAuthor.split(',')[0].trim();
    if (record.authors.length > 1) {
      return `${lastName} et al.`;
    }
    return lastName;
  }
  // Fallback to truncated title
  if (record.title) {
    return record.title.length > 30 ? record.title.slice(0, 27) + '...' : record.title;
  }
  return 'Untitled';
}

/** Create empty study data for a given measure */
function emptyData(measure: EffectMeasure): BinaryData | ContinuousData | HRData {
  if (measure === 'HR') {
    return { hr: 0, ciLower: 0, ciUpper: 0 } as HRData;
  }
  if (measure === 'OR' || measure === 'RR') {
    return { events1: 0, total1: 0, events2: 0, total2: 0 } as BinaryData;
  }
  return { mean1: 0, sd1: 0, n1: 0, mean2: 0, sd2: 0, n2: 0 } as ContinuousData;
}

/** Import RIS or EndNote file into Study[] with empty data fields */
export function importRIS(text: string, measure: EffectMeasure): Study[] {
  const records = detectAndParse(text);

  return records.map((record) => ({
    id: Math.random().toString(36).slice(2, 9),
    name: buildStudyName(record),
    year: record.year,
    data: emptyData(measure),
  }));
}
