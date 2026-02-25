/**
 * SVG brand watermark utility for MetaReview chart exports.
 * Adds a subtle "MetaReview · metareview.cc" watermark
 * at the bottom-right of exported SVG charts.
 */

const BRAND_TEXT = 'MetaReview \u00b7 metareview.cc';
const WATERMARK_HEIGHT = 22;
const FONT_SIZE = 9;
const BRAND_COLOR = '#9ca3af';

/**
 * Clone an SVG element and add a brand watermark at the bottom.
 * Returns the serialized SVG string ready for download.
 */
export function brandSvgForExport(svg: SVGElement | Element): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;

  // Get current dimensions
  const viewBox = clone.getAttribute('viewBox');
  let w: number, h: number;

  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number);
    w = parts[2];
    h = parts[3];
    // Extend viewBox height
    clone.setAttribute('viewBox', `${parts[0]} ${parts[1]} ${w} ${h + WATERMARK_HEIGHT}`);
  } else {
    w = parseFloat(clone.getAttribute('width') || '600');
    h = parseFloat(clone.getAttribute('height') || '400');
  }

  // Update height attribute
  const heightAttr = clone.getAttribute('height');
  if (heightAttr) {
    clone.setAttribute('height', String(parseFloat(heightAttr) + WATERMARK_HEIGHT));
  }

  // Create watermark text element
  const ns = 'http://www.w3.org/2000/svg';
  const text = document.createElementNS(ns, 'text');
  text.setAttribute('x', String(w - 8));
  text.setAttribute('y', String(h + WATERMARK_HEIGHT - 6));
  text.setAttribute('text-anchor', 'end');
  text.setAttribute('font-family', 'Helvetica, Arial, sans-serif');
  text.setAttribute('font-size', String(FONT_SIZE));
  text.setAttribute('fill', BRAND_COLOR);
  text.setAttribute('opacity', '0.8');
  text.textContent = BRAND_TEXT;

  clone.appendChild(text);

  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(clone);

  // Ensure xmlns is present for standalone SVG
  if (!source.includes('xmlns=')) {
    source = source.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  return source;
}
