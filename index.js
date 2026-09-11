import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

async function renderPdfToCanvas(pdfUrl, fileName) {
  try {
    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    const pdf = await loadingTask.promise;
    console.log(`PDF loaded. Total pages: ${pdf.numPages}`);

    const pageNumber = 1;
    const page = await pdf.getPage(pageNumber);

    const canvas = document.getElementById('pdf-canvas');
    const context = canvas.getContext('2d');

    const scale = 1.5;
    const viewport = page.getViewport({ scale: scale });

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };

    await page.render(renderContext).promise;
    console.log('PDF page successfully rendered to canvas!');
    document.getElementById('file-status').textContent = `Loaded: ${fileName}`;
  } catch (error) {
    console.error('Error rendering PDF: ', error);
    document.getElementById('file-status').textContent = 'Error rendering PDF';
  }
}

const fileInput = document.getElementById('pdf-file-input');

fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const objectUrl = URL.createObjectURL(file);
  renderPdfToCanvas(objectUrl, file.name).finally(() => {
    URL.revokeObjectURL(objectUrl);
  });
});