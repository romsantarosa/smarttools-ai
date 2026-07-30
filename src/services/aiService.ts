import { analyzeSplitIntelligently } from './splitIntelligenceService';

export async function analyzeSplit(parsed: any): Promise<any> {
  const pages = Array.isArray(parsed?.pages) ? parsed.pages : [];
  const lines = Array.isArray(parsed?.lines)
    ? parsed.lines
    : pages.map((page: string) => String(page || '').split(/\r?\n/));

  return analyzeSplitIntelligently({
    text: String(parsed?.text || pages.join('\n\n')),
    pages,
    lines,
    pageAssets: Array.isArray(parsed?.pageAssets) ? parsed.pageAssets : [],
  });
}

export default analyzeSplit;
