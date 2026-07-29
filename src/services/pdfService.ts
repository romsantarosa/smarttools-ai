import pdfjsLib from 'pdfjs-dist';

export async function parsePDF(file: File): Promise<any> {
  // Minimal stub: read text from all pages using pdfjs-dist in browser environment
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer } as any);
  const doc = await loadingTask.promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const strs = content.items.map((it: any) => it.str).join(' ');
    pages.push(strs);
  }
  return { pages };
}

export default parsePDF;
