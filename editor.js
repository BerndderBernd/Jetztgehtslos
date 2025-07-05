document.addEventListener('DOMContentLoaded', () => {
    const pagesThumbnailContainer = document.getElementById('pages-thumbnail-container');
    const addPageBtn = document.getElementById('add-page-btn');
    const currentPageDisplay = document.getElementById('current-page-display');
    const currentBookPage = document.getElementById('current-book-page');
    const imageUploadInput = document.getElementById('image-upload');
    const addTextBtn = document.getElementById('add-text-btn');
    const propertiesPanel = document.getElementById('properties-panel');
    const generalPropertiesPanel = document.getElementById('general-properties');
    const textPropertiesPanel = document.getElementById('text-properties');
    const imagePropertiesPanel = document.getElementById('image-properties');
    const deleteElementBtn = document.getElementById('delete-element-btn');

    const saveProjectBtn = document.getElementById('save-project-btn');
    const loadProjectBtn = document.getElementById('load-project-btn');

    const loadingOverlay = document.getElementById('loading-overlay');
    const toastContainer = document.getElementById('toast-container');


    // Text properties inputs
    const fontSizeInput = document.getElementById('font-size');
    const fontFamilyInput = document.getElementById('font-family');
    const textColorInput = document.getElementById('text-color');
    const textAlignInput = document.getElementById('text-align');
    const textContentInput = document.getElementById('text-content');

    // General properties inputs
    const zIndexInput = document.getElementById('z-index');
    const bringForwardBtn = document.getElementById('bring-forward-btn');
    const sendBackwardBtn = document.getElementById('send-backward-btn');
    const pageBackgroundColorInput = document.getElementById('page-background-color');
    const clearPageBackgroundBtn = document.getElementById('clear-page-background-btn');


    // States
    let currentPageId = 1;
    let nextPageId = 2;
    let selectedElement = null;
    let isDragging = false;
    let isResizing = false;
    let initialX, initialY, initialWidth, initialHeight;
    let offsetX, offsetY;
    let activeHandle = null;

    let bookPages = {
        '1': {
            elements: [],
            format: 'landscape',
            backgroundColor: '#FFFFFF'
        }
    };
    let bookStyle = 'picture-book';

    const BACKEND_BASE_URL = 'http://127.0.0.1:5000'; // Die Basis-URL deines Flask-Backends

    // --- Feedback-Funktionen ---

    function showLoading(message = "Bitte warten...") {
        loadingOverlay.querySelector('p').textContent = message;
        loadingOverlay.classList.remove('hidden');
    }

    function hideLoading() {
        loadingOverlay.classList.add('hidden');
    }

    function showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.classList.add('toast', type);
        toast.textContent = message;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 10); // Kleine Verzögerung für CSS-Transition

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.addEventListener('transitionend', () => toast.remove());
        }, duration);
    }


    // --- Initialisierung ---

    function getUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const format = urlParams.get('format');
        const style = urlParams.get('style');
        if (format) {
            bookPages['1'].format = format;
            currentBookPage.classList.add(format);
        } else {
            currentBookPage.classList.add('landscape');
        }
        if (style) {
            bookStyle = style;
        } else {
            bookStyle = 'picture-book';
        }
        console.log(`Editor gestartet mit Format: ${bookPages['1'].format} und Stil: ${bookStyle}`);
    }

    getUrlParameters();
    renderPage(currentPageId);
    pagesThumbnailContainer.appendChild(createPageThumbnail(1));
    setTimeout(() => updatePageThumbnail(1), 100);


    // --- Funktionen für Seitenverwaltung ---

    function createPageThumbnail(pageId) {
        const thumbnailDiv = document.createElement('div');
        thumbnailDiv.classList.add('page-thumbnail');
        if (pageId === currentPageId) {
            thumbnailDiv.classList.add('active');
        }
        thumbnailDiv.dataset.pageId = pageId;

        const pageNumberSpan = document.createElement('span');
        pageNumberSpan.classList.add('page-number');
        pageNumberSpan.textContent = pageId;

        const pagePreviewBox = document.createElement('div');
        pagePreviewBox.classList.add('page-preview-box');
        pagePreviewBox.innerHTML = '<p>Lade Vorschau...</p>';

        thumbnailDiv.appendChild(pageNumberSpan);
        thumbnailDiv.appendChild(pagePreviewBox);

        thumbnailDiv.addEventListener('click', () => {
            switchPage(pageId);
        });
        return thumbnailDiv;
    }

    async function addPage() {
        showLoading("Füge Seite hinzu...");
        await updatePageThumbnail(currentPageId); 

        const newPageId = nextPageId++;
        bookPages[newPageId] = { elements: [], format: bookPages[currentPageId].format, backgroundColor: bookPages[currentPageId].backgroundColor || '#FFFFFF' }; 
        pagesThumbnailContainer.appendChild(createPageThumbnail(newPageId));
        switchPage(newPageId);
        await updatePageThumbnail(newPageId); 
        showToast(`Seite ${newPageId} hinzugefügt.`, 'success');
        console.log(`Seite ${newPageId} hinzugefügt.`);
        hideLoading();
    }

    async function switchPage(pageId) {
        if (!bookPages[pageId]) {
            console.error(`Seite ${pageId} existiert nicht.`);
            return;
        }

        showLoading(`Wechsle zu Seite ${pageId}...`);
        await updatePageThumbnail(currentPageId); 

        const currentActiveThumbnail = document.querySelector('.page-thumbnail.active');
        if (currentActiveThumbnail) {
            currentActiveThumbnail.classList.remove('active');
        }

        const newActiveThumbnail = document.querySelector(`.page-thumbnail[data-page-id="${pageId}"]`);
        if (newActiveThumbnail) {
            newActiveThumbnail.classList.add('active');
        }

        currentPageId = pageId;
        currentPageDisplay.textContent = `Seite ${currentPageId}`;
        renderPage(currentPageId);
        selectedElement = null;
        hidePropertyPanels();
        showToast(`Zu Seite ${pageId} gewechselt.`, 'info');
        console.log(`Zu Seite ${pageId} gewechselt.`);
        hideLoading();
    }

    /**
     * Erstellt eine Miniaturansicht der angegebenen Seite und aktualisiert das Thumbnail.
     * Nutzt html2canvas, um den Inhalt der Seite als Bild zu rendern.
     */
    async function updatePageThumbnail(pageIdToUpdate) {
        const tempPageDiv = document.createElement('div');
        tempPageDiv.classList.add('book-page', bookPages[pageIdToUpdate].format);
        tempPageDiv.style.backgroundColor = bookPages[pageIdToUpdate].backgroundColor || '#FFFFFF'; 
        tempPageDiv.style.position = 'absolute';
        tempPageDiv.style.left = '-9999px';
        tempPageDiv.style.top = '-9999px';
        tempPageDiv.style.zIndex = '-1';

        const pageElementsData = bookPages[pageIdToUpdate].elements;
        const sortedPageElementsData = [...pageElementsData].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

        sortedPageElementsData.forEach(elementData => {
            const elementDiv = document.createElement('div');
            elementDiv.classList.add('editable-element');
            elementDiv.dataset.elementId = elementData.id;
            elementDiv.dataset.elementType = elementData.type;

            elementDiv.style.left = `${elementData.x}px`;
            elementDiv.style.top = `${elementData.y}px`;
            elementDiv.style.width = `${elementData.width}px`;
            elementDiv.style.height = `${elementData.height}px`;
            elementDiv.style.zIndex = elementData.zIndex || 0;

            if (elementData.type === 'image') {
                const img = document.createElement('img');
                img.src = elementData.src;
                elementDiv.appendChild(img);
            } else if (elementData.type === 'text') {
                const p = document.createElement('p');
                p.textContent = elementData.content;
                p.style.fontSize = `${elementData.fontSize}px`;
                p.style.fontFamily = elementData.fontFamily;
                p.style.color = elementData.color;
                p.style.textAlign = elementData.textAlign;
                elementDiv.appendChild(p);
            }
            tempPageDiv.appendChild(elementDiv);
        });

        document.body.appendChild(tempPageDiv);

        const thumbnailElement = document.querySelector(`.page-thumbnail[data-page-id="${pageIdToUpdate}"] .page-preview-box`);
        if (!thumbnailElement) {
            console.error(`Thumbnail-Box für Seite ${pageIdToUpdate} nicht gefunden.`);
            document.body.removeChild(tempPageDiv);
            return;
        }

        if (bookPages[pageIdToUpdate].elements.length === 0) {
            thumbnailElement.innerHTML = '<p>Seite leer</p>';
            thumbnailElement.style.background = bookPages[pageIdToUpdate].backgroundColor || '#ecf0f1';
            thumbnailElement.style.border = '1px dashed #7f8c8d';
            document.body.removeChild(tempPageDiv);
            return;
        }

        try {
            await new Promise(resolve => setTimeout(resolve, 50));

            const canvas = await html2canvas(tempPageDiv, {
                scale: 0.15,
                useCORS: true,
                logging: false
            });
            const imgUrl = canvas.toDataURL('image/png');
            thumbnailElement.innerHTML = `<img src="${imgUrl}" alt="Seite ${pageIdToUpdate} Vorschau" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
            thumbnailElement.style.background = 'none';
            thumbnailElement.style.border = 'none';
        } catch (error) {
            console.error(`Fehler beim Rendern des Thumbnails für Seite ${pageIdToUpdate}:`, error);
            thumbnailElement.innerHTML = '<p style="color: red; font-size: 0.7em;">Vorschau Fehler</p>';
        } finally {
            document.body.removeChild(tempPageDiv);
        }
    }


    // --- Funktionen für Element-Rendering und Interaktion ---

    function renderPage(pageId) {
        currentBookPage.innerHTML = '';
        currentBookPage.className = 'book-page ' + bookPages[pageId].format;
        currentBookPage.style.backgroundColor = bookPages[pageId].backgroundColor || '#FFFFFF';

        if (bookPages[pageId].elements.length === 0) {
            const placeholder = document.createElement('p');
            placeholder.classList.add('placeholder-text');
            placeholder.textContent = 'Ziehe Bilder hierher oder klicke auf "Bild hinzufügen"';
            currentBookPage.appendChild(placeholder);
        } else {
            const sortedElements = [...bookPages[pageId].elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
            sortedElements.forEach(elementData => {
                const elementDiv = createElementDiv(elementData);
                currentBookPage.appendChild(elementDiv);
            });
        }
    }

    function createElementDiv(elementData) {
        const elementDiv = document.createElement('div');
        elementDiv.classList.add('editable-element');
        elementDiv.dataset.elementId = elementData.id;
        elementDiv.dataset.elementType = elementData.type;

        elementDiv.style.left = `${elementData.x}px`;
        elementDiv.style.top = `${elementData.y}px`;
        elementDiv.style.width = `${elementData.width}px`;
        elementDiv.style.height = `${elementData.height}px`;
        elementDiv.style.zIndex = elementData.zIndex || 0;

        if (elementData.type === 'image') {
            const img = document.createElement('img');
            img.src = elementData.src;
            img.onload = () => updatePageThumbnail(currentPageId);
            elementDiv.appendChild(img);
        } else if (elementData.type === 'text') {
            const p = document.createElement('p');
            p.textContent = elementData.content;
            p.style.fontSize = `${elementData.fontSize}px`;
            p.style.fontFamily = elementData.fontFamily;
            p.style.color = elementData.color;
            p.style.textAlign = elementData.textAlign;
            elementDiv.appendChild(p);
        }

        elementDiv.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('resizer')) {
                return;
            }
            selectElement(elementDiv);
            startDragging(e, elementDiv);
        });

        return elementDiv;
    }

    function selectElement(elementDiv) {
        if (selectedElement && selectedElement !== elementDiv) {
            selectedElement.classList.remove('selected-element');
            removeResizerHandles(selectedElement);
        }
        selectedElement = elementDiv;
        selectedElement.classList.add('selected-element');
        addResizerHandles(selectedElement);
        showPropertiesForSelectedElement();
    }

    function addResizerHandles(element) {
        const handles = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
        handles.forEach(position => {
            const handle = document.createElement('div');
            handle.classList.add('resizer', position);
            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                startResizing(e, element, position);
            });
            element.appendChild(handle);
        });
    }

    function removeResizerHandles(element) {
        element.querySelectorAll('.resizer').forEach(handle => handle.remove());
    }

    function showPropertiesForSelectedElement() {
        hidePropertyPanels();
        if (!selectedElement) return;

        const elementType = selectedElement.dataset.elementType;
        const elementId = selectedElement.dataset.elementId;
        const elementData = bookPages[currentPageId].elements.find(el => el.id == elementId);

        if (!elementData) return;

        generalPropertiesPanel.classList.remove('hidden');
        deleteElementBtn.classList.remove('hidden');

        // Z-Index-Eingabe aktualisieren
        zIndexInput.value = elementData.zIndex || 0;
        zIndexInput.oninput = () => {
            elementData.zIndex = parseInt(zIndexInput.value);
            selectedElement.style.zIndex = elementData.zIndex;
            renderPage(currentPageId);
            selectElement(document.querySelector(`.editable-element[data-element-id="${elementData.id}"]`));
            updatePageThumbnail(currentPageId);
        };

        // Event Listener für Ebenen-Buttons
        bringForwardBtn.onclick = () => changeElementZIndex(selectedElement, 1);
        sendBackwardBtn.onclick = () => changeElementZIndex(selectedElement, -1);


        // Hintergrundfarbe der SEITE
        pageBackgroundColorInput.value = bookPages[currentPageId].backgroundColor || '#FFFFFF';
        pageBackgroundColorInput.oninput = () => {
            bookPages[currentPageId].backgroundColor = pageBackgroundColorInput.value;
            currentBookPage.style.backgroundColor = pageBackgroundColorInput.value;
            updatePageThumbnail(currentPageId);
        };
        clearPageBackgroundBtn.onclick = () => {
            bookPages[currentPageId].backgroundColor = '#FFFFFF';
            currentBookPage.style.backgroundColor = '#FFFFFF';
            pageBackgroundColorInput.value = '#FFFFFF';
            updatePageThumbnail(currentPageId);
        };


        if (elementType === 'text') {
            textPropertiesPanel.classList.remove('hidden');
            fontSizeInput.value = elementData.fontSize;
            fontFamilyInput.value = elementData.fontFamily;
            textColorInput.value = elementData.color;
            textAlignInput.value = elementData.textAlign;
            textContentInput.value = elementData.content;

            fontSizeInput.oninput = () => updateTextProperty(elementData, 'fontSize', parseInt(fontSizeInput.value));
            fontFamilyInput.onchange = () => updateTextProperty(elementData, 'fontFamily', fontFamilyInput.value);
            textColorInput.oninput = () => updateTextProperty(elementData, 'color', textColorInput.value);
            textAlignInput.onchange = () => updateTextProperty(elementData, 'textAlign', textAlignInput.value);
            textContentInput.oninput = () => {
                 elementData.content = textContentInput.value;
                 selectedElement.querySelector('p').textContent = textContentInput.value;
                 updatePageThumbnail(currentPageId);
            };

        } else if (elementType === 'image') {
            imagePropertiesPanel.classList.remove('hidden');
            document.getElementById('image-url-display').value = elementData.src;
        }
    }

    function hidePropertyPanels() {
        generalPropertiesPanel.classList.add('hidden');
        textPropertiesPanel.classList.add('hidden');
        imagePropertiesPanel.classList.add('hidden');
        deleteElementBtn.classList.add('hidden');
    }

    function updateTextProperty(elementData, property, value) {
        elementData[property] = value;
        const pElement = selectedElement.querySelector('p');
        if (pElement) {
            if (property === 'fontSize') pElement.style.fontSize = `${value}px`;
            if (property === 'fontFamily') pElement.style.fontFamily = value;
            if (property === 'color') pElement.style.color = value;
            if (property === 'textAlign') pElement.style.textAlign = value;
        }
        updatePageThumbnail(currentPageId);
    }


    // --- Ebenen-Verwaltung (changeElementZIndex) ---
    function changeElementZIndex(elementDiv, direction) {
        if (!selectedElement) return;

        const elementId = selectedElement.dataset.elementId;
        const elementData = bookPages[currentPageId].elements.find(el => el.id == elementId);
        if (!elementData) return;

        let currentZIndex = elementData.zIndex || 0;
        let newZIndex = currentZIndex;

        const currentElements = bookPages[currentPageId].elements;
        const uniqueZIndices = [...new Set(currentElements.map(el => el.zIndex || 0))].sort((a, b) => a - b);
        
        const currentIndexInUnique = uniqueZIndices.indexOf(currentZIndex);

        if (direction > 0) { // Nach vorne bringen
            if (currentIndexInUnique < uniqueZIndices.length - 1) {
                newZIndex = uniqueZIndices[currentIndexInUnique + 1];
            } else {
                newZIndex = currentZIndex + 1;
            }
        } else { // Nach hinten bringen
            if (currentIndexInUnique > 0) {
                newZIndex = uniqueZIndices[currentIndexInUnique - 1];
            } else {
                newZIndex = currentZIndex - 1;
            }
        }

        const elementToSwap = bookPages[currentPageId].elements.find(el => 
            (el.zIndex || 0) === newZIndex && el.id !== elementData.id
        );

        if (elementToSwap) {
            elementToSwap.zIndex = currentZIndex;
        }

        elementData.zIndex = newZIndex;

        zIndexInput.value = elementData.zIndex;

        renderPage(currentPageId);
        selectElement(document.querySelector(`.editable-element[data-element-id="${elementData.id}"]`));

        showToast(`Element auf Ebene ${elementData.zIndex} verschoben.`, 'info');
    }


    // --- Dragging Funktionalität ---

    function startDragging(e, element) {
        isDragging = true;
        element.style.cursor = 'grabbing'; 

        const rect = element.getBoundingClientRect();
        const pageRect = currentBookPage.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        initialX = rect.left - pageRect.left;
        initialY = rect.top - pageRect.top;

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    function onMouseMove(e) {
        if (isDragging) {
            if (!selectedElement) return;

            let newX = e.clientX - currentBookPage.getBoundingClientRect().left - offsetX;
            let newY = e.clientY - currentBookPage.getBoundingClientRect().top - offsetY;

            newX = Math.max(0, Math.min(newX, currentBookPage.clientWidth - selectedElement.offsetWidth));
            newY = Math.max(0, Math.min(newY, currentBookPage.clientHeight - selectedElement.offsetHeight));

            selectedElement.style.left = `${newX}px`;
            selectedElement.style.top = `${newY}px`;

            const elementData = bookPages[currentPageId].elements.find(el => el.id == selectedElement.dataset.elementId);
            if (elementData) {
                elementData.x = newX;
                elementData.y = newY;
            }
        } else if (isResizing) {
            resizeElement(e);
        }
    }

    function onMouseUp() {
        isDragging = false;
        isResizing = false;
        activeHandle = null;
        if (selectedElement) {
            selectedElement.style.cursor = 'grab'; 
        }
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        updatePageThumbnail(currentPageId);
    }


    // --- Resizing Funktionalität ---

    function startResizing(e, element, handle) {
        isResizing = true;
        activeHandle = handle;
        initialX = element.offsetLeft;
        initialY = element.offsetTop;
        initialWidth = element.offsetWidth;
        initialHeight = element.offsetHeight;
        offsetX = e.clientX - currentBookPage.getBoundingClientRect().left;
        offsetY = e.clientY - currentBookPage.getBoundingClientRect().top;

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    function resizeElement(e) {
        if (!selectedElement || !activeHandle) return;

        const currentMouseX = e.clientX - currentBookPage.getBoundingClientRect().left;
        const currentMouseY = e.clientY - currentBookPage.getBoundingClientRect().top;

        let newWidth = initialWidth;
        let newHeight = initialHeight;
        let newX = initialX;
        let newY = initialY;

        const minSize = 20;

        switch (activeHandle) {
            case 'top-left':
                newWidth = initialWidth - (currentMouseX - offsetX);
                newHeight = initialHeight - (currentMouseY - offsetY);
                newX = initialX + (currentMouseX - offsetX);
                newY = initialY + (currentMouseY - offsetY);
                break;
            case 'top-right':
                newWidth = currentMouseX - initialX;
                newHeight = initialHeight - (currentMouseY - offsetY);
                newY = initialY + (currentMouseY - offsetY);
                break;
            case 'bottom-left':
                newWidth = initialWidth - (currentMouseX - offsetX);
                newHeight = currentMouseY - initialY;
                newX = initialX + (currentMouseX - offsetX);
                break;
            case 'bottom-right':
                newWidth = currentMouseX - initialX;
                newHeight = currentMouseY - initialY;
                break;
        }

        if (newWidth >= minSize) {
            selectedElement.style.width = `${newWidth}px`;
            const elementData = bookPages[currentPageId].elements.find(el => el.id == selectedElement.dataset.elementId);
            if (elementData) elementData.width = newWidth;
            if (activeHandle.includes('left')) {
                selectedElement.style.left = `${newX}px`;
                if (elementData) elementData.x = newX;
            }
        }
        if (newHeight >= minSize) {
            selectedElement.style.height = `${newHeight}px`;
            const elementData = bookPages[currentPageId].elements.find(el => el.id == selectedElement.dataset.elementId);
            if (elementData) elementData.height = newHeight;
            if (activeHandle.includes('top')) {
                selectedElement.style.top = `${newY}px`;
                if (elementData) elementData.y = newY;
            }
        }
    }


    // --- Element Hinzufügen (Bild/Text) ---

    imageUploadInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
            showLoading("Bild wird hochgeladen und verarbeitet...");
            const formData = new FormData();
            formData.append('image', file);
            formData.append('style', bookStyle);

            try {
                const response = await fetch(`${BACKEND_BASE_URL}/process-image`, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`HTTP error! status: ${response.status} - ${errorData.error}`);
                }

                const result = await response.json();
                const processedImageUrl = result.imageUrl;

                // KORREKTUR: Korrekte Berechnung des Z-Index beim Hinzufügen
                const maxZ = bookPages[currentPageId].elements.length > 0 ? Math.max(...bookPages[currentPageId].elements.map(el => el.zIndex || 0)) : -1;

                const newImageElement = {
                    id: Date.now(),
                    type: 'image',
                    src: processedImageUrl,
                    x: 50, y: 50,
                    width: 200, height: 150,
                    zIndex: maxZ + 1 // Setze Z-Index höher als alle bestehenden
                };
                bookPages[currentPageId].elements.push(newImageElement);
                renderPage(currentPageId);
                selectElement(document.querySelector(`.editable-element[data-element-id="${newImageElement.id}"]`));
                updatePageThumbnail(currentPageId);
                showToast("Bild erfolgreich hinzugefügt und verarbeitet!", "success");
            } catch (error) {
                console.error('Fehler beim Hochladen oder Verarbeiten des Bildes:', error);
                showToast(`Fehler: ${error.message}`, "error");
            } finally {
                hideLoading();
            }
        }
        event.target.value = '';
    });

    addTextBtn.addEventListener('click', () => {
        // KORREKTUR: Korrekte Berechnung des Z-Index beim Hinzufügen
        const maxZ = bookPages[currentPageId].elements.length > 0 ? Math.max(...bookPages[currentPageId].elements.map(el => el.zIndex || 0)) : -1;

        const newTextElement = {
            id: Date.now(),
            type: 'text',
            content: 'Neuer Text hier eingeben',
            x: 50, y: 50,
            width: 200, height: 50,
            fontSize: 16,
            fontFamily: 'Arial',
            color: '#000000',
            textAlign: 'left',
            zIndex: maxZ + 1 // Setze Z-Index höher als alle bestehenden
        };
        bookPages[currentPageId].elements.push(newTextElement);
        renderPage(currentPageId);
        selectElement(document.querySelector(`.editable-element[data-element-id="${newTextElement.id}"]`));
        updatePageThumbnail(currentPageId);
        showToast("Textfeld hinzugefügt.", "info");
    });

    deleteElementBtn.addEventListener('click', () => {
        if (selectedElement) {
            const elementIdToDelete = selectedElement.dataset.elementId;
            bookPages[currentPageId].elements = bookPages[currentPageId].elements.filter(el => el.id != elementIdToDelete);
            selectedElement.remove();
            selectedElement = null;
            hidePropertyPanels();
            renderPage(currentPageId);
            updatePageThumbnail(currentPageId);
            showToast("Element gelöscht.", "info");
        }
    });

    // --- Speichern und Laden Funktionen ---

    saveProjectBtn.addEventListener('click', async () => {
        const projectName = prompt('Bitte gib einen Namen für dein Projekt ein:');
        if (!projectName) {
            showToast('Speichern abgebrochen. Projektname ist erforderlich.', 'info');
            return;
        }

        showLoading("Projekt wird gespeichert...");
        await updatePageThumbnail(currentPageId);

        try {
            const response = await fetch(`${BACKEND_BASE_URL}/save-project`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ projectName: projectName, projectData: bookPages })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! status: ${response.status} - ${errorData.error}`);
            }

            const result = await response.json();
            showToast(`Projekt "${projectName}" erfolgreich gespeichert!`, 'success');
            console.log('Projekt gespeichert:', result.filePath);
        } catch (error) {
            console.error('Fehler beim Speichern des Projekts:', error);
            showToast(`Fehler beim Speichern: ${error.message}`, 'error');
        } finally {
            hideLoading();
        }
    });

    loadProjectBtn.addEventListener('click', async () => {
        showLoading("Lade Projektliste...");
        try {
            const listResponse = await fetch(`${BACKEND_BASE_URL}/list-projects`);
            if (!listResponse.ok) {
                throw new Error(`HTTP error! status: ${listResponse.status} - Fehler beim Abrufen der Projektliste.`);
            }
            const projectsData = await listResponse.json();
            const availableProjects = projectsData.projects;
            hideLoading();

            if (availableProjects.length === 0) {
                showToast('Es sind keine Projekte zum Laden verfügbar.', 'info');
                return;
            }

            let projectToLoad = prompt(`Verfügbare Projekte:\n${availableProjects.join('\n')}\n\nBitte gib den Namen des zu ladenden Projekts ein:`);
            if (!projectToLoad) {
                showToast('Laden abgebrochen.', 'info');
                return;
            }

            if (!availableProjects.includes(projectToLoad)) {
                 showToast(`Projekt "${projectToLoad}" nicht gefunden. Bitte genauen Namen eingeben.`, 'error');
                 return;
            }

            showLoading(`Lade Projekt "${projectToLoad}"...`);
            const response = await fetch(`${BACKEND_BASE_URL}/load-project/${projectToLoad}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! status: ${response.status} - ${errorData.error}`);
            }

            const result = await response.json();
            const loadedBookPages = result.projectData;

            bookPages = loadedBookPages;
            currentPageId = Object.keys(bookPages)[0] ? parseInt(Object.keys(bookPages)[0]) : 1;
            nextPageId = Math.max(...Object.keys(bookPages).map(Number)) + 1;

            pagesThumbnailContainer.innerHTML = '';
            for (const pageId in bookPages) {
                pagesThumbnailContainer.appendChild(createPageThumbnail(parseInt(pageId)));
            }

            switchPage(currentPageId);
            
            for (const pageId in bookPages) {
                await updatePageThumbnail(parseInt(pageId));
            }

            showToast(`Projekt "${projectToLoad}" erfolgreich geladen!`, 'success');
            console.log('Projekt geladen:', loadedBookPages);

        } catch (error) {
            console.error('Fehler beim Laden des Projekts:', error);
            showToast(`Fehler beim Laden: ${error.message}`, 'error');
        } finally {
            hideLoading();
        }
    });


    // --- Weitere Event Listener ---

    addPageBtn.addEventListener('click', addPage);

    document.addEventListener('click', (e) => {
        const clickedOnElement = e.target.closest('.editable-element');
        const clickedOnResizer = e.target.classList.contains('resizer');
        const clickedOnPropertyPanel = e.target.closest('#properties-panel');

        if (!clickedOnElement && !clickedOnResizer && !clickedOnPropertyPanel) {
            if (selectedElement) {
                selectedElement.classList.remove('selected-element');
                removeResizerHandles(selectedElement);
                selectedElement = null;
            }
            hidePropertyPanels();
            generalPropertiesPanel.classList.remove('hidden');
            pageBackgroundColorInput.value = bookPages[currentPageId].backgroundColor || '#FFFFFF';
        }
    });


    // Dummy Export Button
    document.getElementById('export-pdf-btn').addEventListener('click', () => {
        showToast('PDF Export Funktion wird noch implementiert! Aktuell ist dies nur ein Platzhalter.', 'info');
    });
});