
import { showAlert, setLoading, base64ToBlob } from '../utils.js';
import { setupContextAccordion } from './context.js';
import { currentProjectId } from './project.js';

export function initImageCreation() {
    const btnGenerateImg = document.getElementById('btn-generate-img');
    const btnResetImg = document.getElementById('btn-reset-img');
    const imgPrompt = document.getElementById('img-prompt');
    const imgContext = document.getElementById('img-context');
    const imgStyle = document.getElementById('img-style');
    const imgCountSlider = document.getElementById('img-count-slider');
    const imgCountDisplay = document.getElementById('img-count-display');
    const imgResultContainer = document.getElementById('img-result-container');
    const btnOptimizeImg = document.getElementById('btn-optimize-img');

    // Initialize Context Accordion
    setupContextAccordion('btn-context-accordion-img', 'context-content-img', 'context-checkboxes-img', 'btn-apply-context-img', 'img-context', 'img-context-version', 'btn-clear-context-img');

    if (imgCountSlider && imgCountDisplay) {
        imgCountSlider.addEventListener('input', (e) => {
            imgCountDisplay.textContent = e.target.value;
        });
    }

    const imgFilesInput = document.getElementById('img-files');
    const imgUploadArea = document.getElementById('img-upload-area');
    const imgPreviewList = document.getElementById('img-preview-list');

    const imgStyleFilesInput = document.getElementById('img-style-files');
    const imgStyleUploadArea = document.getElementById('img-style-upload-area');
    const imgStylePreviewList = document.getElementById('img-style-preview-list');

    const imgProductFilesInput = document.getElementById('img-product-files');
    const imgProductUploadArea = document.getElementById('img-product-upload-area');
    const imgProductPreviewList = document.getElementById('img-product-preview-list');

    const imgSceneFilesInput = document.getElementById('img-scene-files');
    const imgSceneUploadArea = document.getElementById('img-scene-upload-area');
    const imgScenePreviewList = document.getElementById('img-scene-preview-list');

    function setupFileUpload(uploadArea, input, previewList, badgeId) {
        if (uploadArea) {
            uploadArea.addEventListener('click', () => input.click());
            input.addEventListener('change', (e) => handleImgFilesSelect(e, previewList, uploadArea, badgeId));

            // Drag and Drop
            uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.style.borderColor = 'var(--accent-color)'; });
            uploadArea.addEventListener('dragleave', () => { uploadArea.style.borderColor = 'rgba(255, 255, 255, 0.1)'; });
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                if (e.dataTransfer.files.length) {
                    input.files = e.dataTransfer.files; // Set input files
                    handleImgFilesSelect({ target: input }, previewList, uploadArea, badgeId);
                }
            });
        }
    }

    setupFileUpload(imgUploadArea, imgFilesInput, imgPreviewList, 'badge-general');
    setupFileUpload(imgStyleUploadArea, imgStyleFilesInput, imgStylePreviewList, 'badge-style');
    setupFileUpload(imgProductUploadArea, imgProductFilesInput, imgProductPreviewList, 'badge-product');
    setupFileUpload(imgSceneUploadArea, imgSceneFilesInput, imgScenePreviewList, 'badge-scene');

    function handleImgFilesSelect(e, previewList, uploadArea, badgeId) {
        const files = Array.from(e.target.files);
        previewList.innerHTML = '';
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.classList.add('preview-thumb');
                previewList.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
        uploadArea.querySelector('span').textContent = `${files.length} images selected`;

        const badge = document.getElementById(badgeId);
        if (badge) {
            badge.textContent = files.length;
            badge.hidden = files.length === 0;
        }
    }

    if (btnResetImg) {
        btnResetImg.addEventListener('click', () => {
            imgPrompt.value = '';
            imgStyle.value = '';
            const resetInput = (input, previewList, uploadArea, badgeId, defaultText) => {
                input.value = '';
                previewList.innerHTML = '';
                if (uploadArea) uploadArea.querySelector('span').textContent = defaultText;
                const badge = document.getElementById(badgeId);
                if (badge) { badge.textContent = '0'; badge.hidden = true; }
            };
            resetInput(imgFilesInput, imgPreviewList, imgUploadArea, 'badge-general', 'Drop images or click to upload');
            resetInput(imgStyleFilesInput, imgStylePreviewList, imgStyleUploadArea, 'badge-style', 'Upload Style Image');
            resetInput(imgProductFilesInput, imgProductPreviewList, imgProductUploadArea, 'badge-product', 'Upload Product Image');
            resetInput(imgSceneFilesInput, imgScenePreviewList, imgSceneUploadArea, 'badge-scene', 'Upload Scene Image');
            imgResultContainer.innerHTML = '<i class="fa-regular fa-image"></i><p>Generated image will appear here</p>';
        });
    }

    if (btnOptimizeImg) {
        btnOptimizeImg.addEventListener('click', async () => {
            if (!imgPrompt.value) { showAlert('Please enter a prompt to enhance'); return; }

            const originalContent = btnOptimizeImg.innerHTML;
            btnOptimizeImg.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            btnOptimizeImg.disabled = true;

            try {
                const response = await fetch('/image-creation/optimize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: imgPrompt.value })
                });

                if (response.ok) {
                    const data = await response.json();
                    imgPrompt.value = data.optimized_prompt;
                } else {
                    const err = await response.json();
                    showAlert('Error: ' + err.detail);
                }
            } catch (e) {
                console.error(e);
                showAlert('An error occurred during enhancement');
            } finally {
                btnOptimizeImg.innerHTML = originalContent;
                btnOptimizeImg.disabled = false;
            }
        });
    }

    if (btnGenerateImg) {
        btnGenerateImg.addEventListener('click', async () => {
            if (!currentProjectId) { showAlert('Please select or create a project first.'); return; }
            if (!imgPrompt.value) { showAlert('Please enter a prompt'); return; }

            setLoading(btnGenerateImg, true);

            const formData = new FormData();
            const fullPrompt = imgContext.value ? `${imgPrompt.value}\n\nContext:\n${imgContext.value}` : imgPrompt.value;
            formData.append('prompt', fullPrompt);
            if (imgStyle.value) formData.append('style', imgStyle.value);
            if (imgCountSlider) formData.append('num_images', imgCountSlider.value);
            formData.append('project_id', currentProjectId);

            const appendFiles = (files, key) => { for (let i = 0; i < files.length; i++) formData.append(key, files[i]); };
            appendFiles(imgFilesInput.files, 'reference_images');
            appendFiles(imgStyleFilesInput.files, 'style_images');
            appendFiles(imgProductFilesInput.files, 'product_images');
            appendFiles(imgSceneFilesInput.files, 'scene_images');

            const modelToggle = document.getElementById('model-toggle-img');
            const modelName = modelToggle && modelToggle.checked ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
            formData.append('model_name', modelName);

            try {
                const response = await fetch('/image-creation/generate', { method: 'POST', body: formData });
                const data = await response.json();
                if (response.ok) {
                    imgResultContainer.innerHTML = '';
                    imgResultContainer.style.display = 'grid';
                    imgResultContainer.style.gridTemplateColumns = `repeat(${data.images.length}, 1fr)`;
                    imgResultContainer.style.gap = '1rem';
                    data.images.forEach((url, index) => {
                        const card = document.createElement('div');
                        card.className = 'image-card';
                        card.innerHTML = `
                            <img src="${url}" alt="Generated Image ${index + 1}" style="width: 100%; border-radius: 8px; margin-bottom: 0.5rem;">
                            <div class="image-actions" style="display: flex; gap: 0.5rem; justify-content: center; margin-top: 0.5rem;">
                                <button class="action-btn" onclick="saveImageToProject('${url}', this)"><i class="fa-solid fa-floppy-disk"></i> Save</button>
                                <button class="action-btn" onclick="openEditModal('${url}')"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                                <a href="${url}" download="generated-image-${index}.png" class="action-btn"><i class="fa-solid fa-download"></i></a>
                            </div>`;
                        imgResultContainer.appendChild(card);
                    });
                } else {
                    showAlert('Error: ' + data.detail);
                }
            } catch (e) { console.error(e); showAlert('An error occurred'); }
            finally { setLoading(btnGenerateImg, false); }
        });
    }

    // Init Edit Page Logic & Modal Logic
    initEditLogic();
}

function initEditLogic() {
    // Initialize Context Accordion for Edit Modal
    setupContextAccordion('btn-context-accordion-edit-modal', 'context-content-edit-modal', 'context-checkboxes-edit-modal', 'btn-apply-context-edit-modal', 'edit-instruction', 'edit-context-version', 'btn-clear-context-edit-modal');

    const modalEdit = document.getElementById('modal-edit');
    const closeEditModal = document.getElementById('close-edit-modal');
    const editMainImg = document.getElementById('edit-main-img');
    const editInstruction = document.getElementById('edit-instruction');
    const btnGenerateEdit = document.getElementById('btn-generate-edit');
    const btnSaveEdit = document.getElementById('btn-save-edit');
    const editHistoryList = document.getElementById('edit-history-list');

    let currentEditImageSrc = null;
    let editHistory = [];

    if (closeEditModal) closeEditModal.addEventListener('click', () => modalEdit.hidden = true);

    window.openEditModal = (imageSrc) => {
        currentEditImageSrc = imageSrc;
        editMainImg.src = imageSrc;
        editInstruction.value = '';
        const styleSelect = document.getElementById('edit-style-modal');
        if (styleSelect) styleSelect.value = '';
        editHistory = [imageSrc];
        renderEditHistory();
        modalEdit.hidden = false;
    };

    function renderEditHistory() {
        editHistoryList.innerHTML = '';
        editHistory.forEach((src) => {
            const thumb = document.createElement('img');
            thumb.src = src;
            thumb.classList.add('preview-thumb');
            thumb.style.cursor = 'pointer';
            thumb.style.border = src === currentEditImageSrc ? '2px solid var(--accent-color)' : 'none';
            thumb.onclick = () => { currentEditImageSrc = src; editMainImg.src = src; renderEditHistory(); };
            editHistoryList.appendChild(thumb);
        });
    }

    if (btnGenerateEdit) {
        btnGenerateEdit.addEventListener('click', async () => {
            if (!currentEditImageSrc) return;
            const instruction = editInstruction.value;
            if (!instruction) { showAlert('Please enter an edit instruction'); return; }

            setLoading(btnGenerateEdit, true);

            try {
                const formData = new FormData();
                formData.append('instruction', instruction);
                const styleSelect = document.getElementById('edit-style-modal');
                if (styleSelect && styleSelect.value) formData.append('style', styleSelect.value);

                const modelToggle = document.getElementById('model-toggle-edit-modal');
                const modelName = modelToggle && modelToggle.checked ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
                formData.append('model_name', modelName);

                if (currentEditImageSrc.startsWith('http')) {
                    formData.append('image_url', currentEditImageSrc);
                } else {
                    const res = await fetch(currentEditImageSrc);
                    const blob = await res.blob();
                    formData.append('image', new File([blob], "image_to_edit.png", { type: "image/png" }));
                }

                // Reference Images handling omitted for brevity but should be here if Edit Modal handles it.
                // script.js lines 1545 check editReferenceFiles from Edit Page (not Modal?).
                // Wait, script.js mixed Edit Page and Edit Modal logic?
                // Lines 1269+ "Image Editing Page Logic". Lines 1461+ "Edit Image Modal Logic".
                // I am implementing Modal Logic.
                // The Modal doesn't seem to have file upload for references in the HTML we saw?
                // script.js 1461+ just handles instruction and style.
                // I'll stick to that.

                const response = await fetch('/image-creation/edit', { method: 'POST', body: formData });
                const data = await response.json();

                if (response.ok) {
                    const b64 = data.images && data.images.length > 0 ? data.images[0] : null;
                    if (b64) {
                        const blob = base64ToBlob(b64, 'image/png');
                        const newImageSrc = URL.createObjectURL(blob);
                        currentEditImageSrc = newImageSrc;
                        editMainImg.src = newImageSrc;
                        editHistory.unshift(newImageSrc);
                        renderEditHistory();
                        editInstruction.value = '';
                    } else { showAlert('No image returned'); }
                } else { showAlert('Error: ' + data.detail); }
            } catch (e) { console.error(e); showAlert('An error occurred'); }
            finally { setLoading(btnGenerateEdit, false); }
        });
    }

    if (btnSaveEdit) {
        btnSaveEdit.addEventListener('click', () => {
            if (currentEditImageSrc) window.saveImageToProject(currentEditImageSrc, btnSaveEdit);
        });
    }
}
