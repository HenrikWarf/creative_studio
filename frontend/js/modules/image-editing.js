
import { showAlert, setLoading } from '../utils.js';
import { setupContextAccordion } from './context.js';
import { currentProjectId } from './project.js';

export function initImageEditing() {
    // Initialize Context Accordion
    setupContextAccordion(
        'btn-context-accordion-edit',
        'context-content-edit',
        'context-checkboxes-edit',
        'btn-apply-context-edit',
        'edit-context',
        'edit-context-version',
        'btn-clear-context-edit'
    );

    const editUploadArea = document.getElementById('edit-upload-area');
    const editFileInput = document.getElementById('edit-file-input');
    const editPreviewContainer = document.getElementById('edit-preview-container');
    const editPrompt = document.getElementById('edit-prompt');
    const editContext = document.getElementById('edit-context');
    const editStyle = document.getElementById('edit-style');
    const editCountSlider = document.getElementById('edit-count-slider');
    const editCountDisplay = document.getElementById('edit-count-display');
    const btnGenerateEdit = document.getElementById('btn-generate-edit-page');
    const btnResetEdit = document.getElementById('btn-reset-edit-page');
    const resultContainer = document.getElementById('edit-result-container');

    // Reference images
    const editRefUploadArea = document.getElementById('edit-ref-upload-area');
    const editRefFileInput = document.getElementById('edit-ref-file-input');
    const editRefPreviewList = document.getElementById('edit-ref-preview-list');

    let currentEditFile = null;

    if (editCountSlider && editCountDisplay) {
        editCountSlider.addEventListener('input', (e) => {
            editCountDisplay.textContent = e.target.value;
        });
    }

    // Event Listener for external edit requests (from Project View)
    window.addEventListener('initEditImage', (e) => {
        if (e.detail && e.detail.file) {
            handleEditFile(e.detail.file);
        }
    });

    // Main Image Upload
    if (editUploadArea && editFileInput) {
        editUploadArea.addEventListener('click', () => editFileInput.click());

        editUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            editUploadArea.style.borderColor = 'var(--accent-color)';
        });
        editUploadArea.addEventListener('dragleave', () => {
            editUploadArea.style.borderColor = 'var(--border-color)';
        });
        editUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            editUploadArea.style.borderColor = 'var(--border-color)';
            if (e.dataTransfer.files.length) handleEditFile(e.dataTransfer.files[0]);
        });

        editFileInput.addEventListener('change', (e) => {
            if (e.target.files.length) handleEditFile(e.target.files[0]);
        });
    }

    function handleEditFile(file) {
        if (!file.type.startsWith('image/')) {
            showAlert('Please select an image file');
            return;
        }
        currentEditFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            editPreviewContainer.innerHTML = `
                <div style="position: relative; display: inline-block;">
                    <img src="${e.target.result}" style="max-height: 200px; border-radius: 8px;">
                    <button class="small-delete-btn" style="position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.5); color: white; border-radius: 50%;">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>`;
            editPreviewContainer.querySelector('button').onclick = (ev) => {
                ev.stopPropagation();
                currentEditFile = null;
                editPreviewContainer.innerHTML = '';
                editFileInput.value = '';
            };
        };
        reader.readAsDataURL(file);
    }

    // Ref Images Upload
    if (editRefUploadArea && editRefFileInput) {
        editRefUploadArea.addEventListener('click', () => editRefFileInput.click());
        editRefFileInput.addEventListener('change', handleRefFiles);
    }

    function handleRefFiles(e) {
        const files = Array.from(e.target.files);
        editRefPreviewList.innerHTML = '';
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = document.createElement('img');
                img.src = ev.target.result;
                img.classList.add('preview-thumb');
                editRefPreviewList.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
        if (editRefUploadArea.querySelector('span')) {
            editRefUploadArea.querySelector('span').textContent = `${files.length} images selected`;
        }
    }

    if (btnResetEdit) {
        btnResetEdit.addEventListener('click', () => {
            if (editPrompt) editPrompt.value = '';
            if (editContext) editContext.value = '';
            if (editStyle) editStyle.value = '';
            currentEditFile = null;
            if (editPreviewContainer) editPreviewContainer.innerHTML = '';
            if (editFileInput) editFileInput.value = '';
            if (editRefPreviewList) editRefPreviewList.innerHTML = '';
            if (editRefFileInput) editRefFileInput.value = '';
            if (editRefUploadArea.querySelector('span')) editRefUploadArea.querySelector('span').textContent = 'Add reference images';
            if (resultContainer) resultContainer.innerHTML = '<div class="empty-state"><i class="fa-solid fa-wand-magic-sparkles"></i><p>Edited images will appear here</p></div>';
        });
    }

    if (btnGenerateEdit) {
        btnGenerateEdit.addEventListener('click', async () => {
            if (!currentEditFile) {
                showAlert('Please upload an image to edit used.');
                return;
            }
            if (!editPrompt.value) {
                showAlert('Please enter edit instructions.');
                return;
            }

            setLoading(btnGenerateEdit, true);
            if (resultContainer) resultContainer.innerHTML = '<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i><p>Processing image...</p></div>';

            const formData = new FormData();
            formData.append('image', currentEditFile);

            const fullPrompt = editContext && editContext.value
                ? `${editPrompt.value}\n\nContext:\n${editContext.value}`
                : editPrompt.value;

            formData.append('instruction', fullPrompt); // Note: Backend likely expects 'instruction' for edits

            if (editStyle && editStyle.value) formData.append('style', editStyle.value);
            if (editCountSlider) formData.append('num_images', editCountSlider.value);

            // Model selection (optional, defaulting based on expectation)
            const modelToggle = document.getElementById('model-toggle-edit-page');
            const modelName = modelToggle && modelToggle.checked ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
            formData.append('model_name', modelName);

            // Ref images
            if (editRefFileInput && editRefFileInput.files.length) {
                for (let i = 0; i < editRefFileInput.files.length; i++) {
                    formData.append('reference_images', editRefFileInput.files[i]);
                }
            }

            try {
                // Using the edit endpoint
                const response = await fetch('/image-creation/edit', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();
                if (response.ok) {
                    if (resultContainer) {
                        resultContainer.innerHTML = '';
                        resultContainer.style.display = 'grid';
                        resultContainer.style.gridTemplateColumns = `repeat(${data.images.length}, 1fr)`;
                        resultContainer.style.gap = '1rem';

                        data.images.forEach((b64, index) => {
                            // Backend edit endpoint returns base64 strings usually
                            const src = `data:image/png;base64,${b64}`;
                            const card = document.createElement('div');
                            card.className = 'image-card';
                            card.innerHTML = `
                                <img src="${src}" alt="Edited Image ${index + 1}" style="width: 100%; border-radius: 8px;">
                                <div class="image-actions" style="margin-top: 10px; display: flex; justify-content: center; gap: 10px;">
                                    <a href="${src}" download="edited-image-${index}.png" class="action-btn"><i class="fa-solid fa-download"></i></a>
                                    <button class="action-btn" onclick="saveImageToProject('${src}', this)"><i class="fa-solid fa-floppy-disk"></i> Save</button>
                                </div>`;
                            resultContainer.appendChild(card);
                        });
                    }
                } else {
                    showAlert('Error: ' + data.detail);
                    if (resultContainer) resultContainer.innerHTML = `<div class="empty-state"><p class="error-text">Error: ${data.detail}</p></div>`;
                }
            } catch (error) {
                console.error(error);
                showAlert('An error occurred during generation.');
                if (resultContainer) resultContainer.innerHTML = `<div class="empty-state"><p class="error-text">An error occurred.</p></div>`;
            } finally {
                setLoading(btnGenerateEdit, false);
            }
        });
    }
}
