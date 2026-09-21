// Configure PDF.js Global Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

document.addEventListener('DOMContentLoaded', () => {
  const btnNewBuilding = document.getElementById('btn-new-building');
  const btnNewFloor = document.getElementById('btn-new-floor');
  const pdfInput = document.getElementById('pdf-upload');
  const canvas = document.getElementById('floor-view');
  const ctx = canvas.getContext('2d');

  // Containers for appending new items
  const buildingsContainer = document.querySelector('#buildings-container .list-group');
  const floorsContainer = document.querySelector('#floors-container .list-group');

  // 1. New Building Handler: Prompt for name and append to list
  btnNewBuilding.addEventListener('click', () => {
    const buildingName = prompt('Enter new building name:');
    
    // Check if user entered a name (and didn't click Cancel)
    if (buildingName && buildingName.trim() !== '') {
      const newBtn = document.createElement('button');
      newBtn.className = 'list-item';
      newBtn.textContent = buildingName.trim();
      
      // Optional: Add click listener to select this building
      newBtn.addEventListener('click', () => {
        document.querySelectorAll('#buildings-container .list-item').forEach(el => el.classList.remove('active-item'));
        newBtn.classList.add('active-item');
      });

      buildingsContainer.appendChild(newBtn);
    }
  });

  // 2. New Floor Handler: Prompt for floor name, then trigger PDF selection
  btnNewFloor.addEventListener('click', () => {
    const floorName = prompt('Enter new floor name (e.g., Level 3):');
    
    if (floorName && floorName.trim() !== '') {
      // Store floor name temporarily or pass it directly
      pdfInput.dataset.pendingFloorName = floorName.trim();
      
      // Open the file dialog to pick the PDF blueprint
      pdfInput.click();
    }
  });

  // 3. Render PDF Floor Plan and add new floor item
  pdfInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      alert('Please select a valid PDF file.');
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Load PDF Document
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.5 });
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };

      await page.render(renderContext).promise;

      // Create new floor button in list using the prompt name
      const floorName = pdfInput.dataset.pendingFloorName || 'New Floor';
      const newFloorBtn = document.createElement('button');
      newFloorBtn.className = 'list-item active-item';
      newFloorBtn.textContent = floorName;

      // Remove active class from existing floor buttons
      document.querySelectorAll('#floors-container .list-item').forEach(el => el.classList.remove('active-item'));
      
      newFloorBtn.addEventListener('click', () => {
        document.querySelectorAll('#floors-container .list-item').forEach(el => el.classList.remove('active-item'));
        newFloorBtn.classList.add('active-item');
      });

      floorsContainer.appendChild(newFloorBtn);

      // Reset file input value so selecting the same file again triggers change event
      pdfInput.value = '';
    } catch (error) {
      console.error('Error rendering PDF with PDF.js:', error);
      alert('Failed to render PDF file.');
    }
  });
});
