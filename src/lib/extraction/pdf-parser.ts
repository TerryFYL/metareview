// PDF text extraction using pdfjs-dist
// Client-side only — PDF never leaves the browser

import type { TextItem } from 'pdfjs-dist/types/src/display/api';

export interface PageText {
  pageNum: number;
  text: string;
  charCount: number;
}

// Lazy-load pdfjs-dist to avoid adding to main bundle
async function loadPdfjs() {
  const pdfjsLib = await import('pdfjs-dist');
  // Set worker source — Vite handles the URL resolution
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
  return pdfjsLib;
}

/**
 * Extract text from all pages of a PDF file.
 * Handles two-column academic papers via column detection heuristic.
 */
export async function extractTextFromPDF(file: File): Promise<PageText[]> {
  const pdfjsLib = await loadPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: PageText[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    const items = textContent.items
      .filter((item): item is TextItem => 'str' in item && item.str.trim().length > 0)
      .map(item => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        height: item.height,
      }));

    const text = reconstructReadingOrder(items);
    pages.push({ pageNum: i, text, charCount: text.length });
  }

  return pages;
}

interface TextItemPos {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Reconstruct reading order from positioned text items.
 * Detects two-column layouts via bimodal x-coordinate distribution.
 */
function reconstructReadingOrder(items: TextItemPos[]): string {
  if (items.length === 0) return '';

  // Detect if page is two-column by analyzing x-coordinate distribution
  const xCoords = items.map(i => i.x);
  const minX = Math.min(...xCoords);
  const maxX = Math.max(...xCoords);
  const pageWidth = maxX - minX;

  const isTwoColumn = detectTwoColumn(xCoords, pageWidth);

  if (isTwoColumn) {
    return extractTwoColumn(items, minX, pageWidth);
  } else {
    return extractSingleColumn(items);
  }
}

/**
 * Detect two-column layout via bimodal x-coordinate distribution.
 * If there's a gap > 40% of page width in the middle, it's two-column.
 */
function detectTwoColumn(xCoords: number[], pageWidth: number): boolean {
  if (pageWidth < 100) return false; // Too narrow to be two-column

  // Create histogram of x-coordinates (20 bins)
  const bins = 20;
  const minX = Math.min(...xCoords);
  const binWidth = pageWidth / bins;
  const histogram = new Array(bins).fill(0);

  for (const x of xCoords) {
    const bin = Math.min(Math.floor((x - minX) / binWidth), bins - 1);
    histogram[bin]++;
  }

  // Look for a gap in the middle third of the page
  const midStart = Math.floor(bins * 0.3);
  const midEnd = Math.ceil(bins * 0.7);
  const middleBins = histogram.slice(midStart, midEnd);
  const maxCount = Math.max(...histogram);

  // If any middle bin has < 10% of the max, there's a column gap
  const hasGap = middleBins.some(count => count < maxCount * 0.1);
  return hasGap;
}

/**
 * Extract text from a two-column page.
 * Split items into left and right columns, read each top-to-bottom.
 */
function extractTwoColumn(items: TextItemPos[], minX: number, pageWidth: number): string {
  const midpoint = minX + pageWidth / 2;

  const leftItems = items.filter(i => i.x < midpoint);
  const rightItems = items.filter(i => i.x >= midpoint);

  const leftText = extractSingleColumn(leftItems);
  const rightText = extractSingleColumn(rightItems);

  return leftText + '\n\n' + rightText;
}

/**
 * Extract text in reading order for a single column.
 * Group by y-coordinate (lines), then sort left-to-right within each line.
 */
function extractSingleColumn(items: TextItemPos[]): string {
  if (items.length === 0) return '';

  // Sort by y descending (PDF coordinates: y=0 is bottom)
  const sorted = [...items].sort((a, b) => b.y - a.y);

  // Group into lines: items within ~2pt of y are on the same line
  const lines: TextItemPos[][] = [];
  let currentLine: TextItemPos[] = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - currentY) < 3) {
      currentLine.push(sorted[i]);
    } else {
      lines.push(currentLine);
      currentLine = [sorted[i]];
      currentY = sorted[i].y;
    }
  }
  lines.push(currentLine);

  // Within each line, sort left-to-right and join
  return lines
    .map(line => {
      line.sort((a, b) => a.x - b.x);
      return line.map(item => item.str).join(' ');
    })
    .join('\n');
}

/**
 * Check if a PDF is likely scanned (image-only).
 * Returns true if all pages have < 50 characters.
 */
export function isScannedPDF(pages: PageText[]): boolean {
  return pages.every(p => p.charCount < 50);
}
