import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

export async function parseResumeFile(file: File): Promise<string> {
  if (file.name.endsWith('.md') || file.type === 'text/markdown') {
    return file.text();
  }

  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      pages.push(pageText);
    }
    return pages.join('\n\n');
  }

  throw new Error(`Unsupported file type: ${file.name}`);
}
