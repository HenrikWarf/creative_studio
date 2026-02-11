
import { setupContextAccordion } from '../context.js';
import { showAlert, setLoading } from '../../utils.js';
import { activeContextVersionName } from '../context.js';

export function initFirstLast() {
    setupContextAccordion('btn-context-accordion-vm-fl', 'context-content-vm-fl', 'context-checkboxes-vm-fl', 'btn-apply-context-vm-fl', 'vm-fl-context', 'vm-fl-context-version', 'btn-clear-context-vm-fl');

    const dropZoneVmFlFirst = document.getElementById('drop-zone-vm-fl-first');
    const fileInputVmFlFirst = document.getElementById('file-input-vm-fl-first');
    const previewContainerVmFlFirst = document.getElementById('preview-container-vm-fl-first');
    const previewImgVmFlFirst = document.getElementById('preview-img-vm-fl-first');
    const btnRemoveImgVmFlFirst = document.getElementById('btn-remove-img-vm-fl-first');

    const dropZoneVmFlLast = document.getElementById('drop-zone-vm-fl-last');
    const fileInputVmFlLast = document.getElementById('file-input-vm-fl-last');
    const previewContainerVmFlLast = document.getElementById('preview-container-vm-fl-last');
    const previewImgVmFlLast = document.getElementById('preview-img-vm-fl-last');
    const btnRemoveImgVmFlLast = document.getElementById('btn-remove-img-vm-fl-last');

    const vmFlPrompt = document.getElementById('vm-fl-prompt');
    const vmFlContext = document.getElementById('vm-fl-context');
    const btnClearContextVmFl = document.getElementById('btn-clear-context-vm-fl');
    const btnGenerateVmFl = document.getElementById('btn-generate-vm-fl');
    const vmFlResultContainer = document.getElementById('vm-fl-result-container');
    const btnOptimizeVmFl = document.getElementById('btn-optimize-vm-fl');
    const vmFlCountSlider = document.getElementById('vm-fl-count-slider');
    const vmFlCountDisplay = document.getElementById('vm-fl-count-display');

    if (vmFlCountSlider && vmFlCountDisplay) {
        vmFlCountSlider.addEventListener('input', (e) => vmFlCountDisplay.textContent = e.target.value);
    }

    let vmFlFirstFile = null;
    let vmFlLastFile = null;

    // First Frame Upload
    if (dropZoneVmFlFirst && fileInputVmFlFirst) {
        dropZoneVmFlFirst.addEventListener('click', () => fileInputVmFlFirst.click());
        dropZoneVmFlFirst.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneVmFlFirst.style.borderColor = 'var(--accent-color)'; });
        dropZoneVmFlFirst.addEventListener('dragleave', () => { if (!vmFlFirstFile) dropZoneVmFlFirst.style.borderColor = 'rgba(255, 255, 255, 0.1)'; });
        dropZoneVmFlFirst.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleVmFlFirstFile(e.dataTransfer.files[0]); });
        fileInputVmFlFirst.addEventListener('change', (e) => { if (e.target.files.length) handleVmFlFirstFile(e.target.files[0]); });
    }

    function handleVmFlFirstFile(file) {
        if (!file.type.startsWith('image/')) { showAlert('Please select an image file.'); return; }
        vmFlFirstFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImgVmFlFirst.src = e.target.result;
            previewImgVmFlFirst.style.cursor = 'pointer';
            previewImgVmFlFirst.onclick = () => window.openSimpleLightbox(e.target.result);
            dropZoneVmFlFirst.style.display = 'none';
            previewContainerVmFlFirst.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }

    if (btnRemoveImgVmFlFirst) {
        btnRemoveImgVmFlFirst.addEventListener('click', (e) => {
            e.stopPropagation(); vmFlFirstFile = null; fileInputVmFlFirst.value = ''; previewImgVmFlFirst.src = '';
            previewContainerVmFlFirst.style.display = 'none'; dropZoneVmFlFirst.style.display = 'flex';
        });
    }

    // Last Frame Upload
    if (dropZoneVmFlLast && fileInputVmFlLast) {
        dropZoneVmFlLast.addEventListener('click', () => fileInputVmFlLast.click());
        dropZoneVmFlLast.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneVmFlLast.style.borderColor = 'var(--accent-color)'; });
        dropZoneVmFlLast.addEventListener('dragleave', () => { if (!vmFlLastFile) dropZoneVmFlLast.style.borderColor = 'rgba(255, 255, 255, 0.1)'; });
        dropZoneVmFlLast.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleVmFlLastFile(e.dataTransfer.files[0]); });
        fileInputVmFlLast.addEventListener('change', (e) => { if (e.target.files.length) handleVmFlLastFile(e.target.files[0]); });
    }

    function handleVmFlLastFile(file) {
        if (!file.type.startsWith('image/')) { showAlert('Please select an image file.'); return; }
        vmFlLastFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImgVmFlLast.src = e.target.result;
            previewImgVmFlLast.style.cursor = 'pointer';
            previewImgVmFlLast.onclick = () => window.openSimpleLightbox(e.target.result);
            dropZoneVmFlLast.style.display = 'none';
            previewContainerVmFlLast.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }

    if (btnRemoveImgVmFlLast) {
        btnRemoveImgVmFlLast.addEventListener('click', (e) => {
            e.stopPropagation(); vmFlLastFile = null; fileInputVmFlLast.value = ''; previewImgVmFlLast.src = '';
            previewContainerVmFlLast.style.display = 'none'; dropZoneVmFlLast.style.display = 'flex';
        });
    }

    // Clear Context
    if (btnClearContextVmFl) {
        btnClearContextVmFl.addEventListener('click', () => {
            const versionSpan = document.getElementById('vm-fl-context-version');
            if (vmFlContext) vmFlContext.value = '';
            if (versionSpan) versionSpan.textContent = '';
        });
    }

    // Optimization
    if (btnOptimizeVmFl) {
        btnOptimizeVmFl.addEventListener('click', async () => {
            const currentPrompt = vmFlPrompt.value;
            if (!currentPrompt) { showAlert('Please enter some initial instructions.'); return; }

            const originalBtnContent = btnOptimizeVmFl.innerHTML;
            btnOptimizeVmFl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enhancing...';
            btnOptimizeVmFl.disabled = true;

            try {
                if (vmFlFirstFile) {
                    const formData = new FormData();
                    formData.append('image', vmFlFirstFile);
                    formData.append('instructions', currentPrompt);
                    const response = await fetch('/api/video-magic/optimize-prompt', { method: 'POST', body: formData });
                    if (response.ok) {
                        const data = await response.json();
                        vmFlPrompt.value = data.optimized_prompt;
                    } else {
                        const err = await response.json();
                        showAlert(`Error: ${err.detail}`);
                    }
                } else {
                    showAlert('Please upload the First Frame for best results.');
                }
            } catch (err) {
                showAlert(`Error: ${err.message}`);
            } finally {
                btnOptimizeVmFl.innerHTML = originalBtnContent;
                btnOptimizeVmFl.disabled = false;
            }
        });
    }

    // Generate
    if (btnGenerateVmFl) {
        btnGenerateVmFl.addEventListener('click', async () => {
            if (!vmFlFirstFile || !vmFlLastFile) { showAlert('Please upload both First and Last frames.'); return; }
            if (!vmFlPrompt.value) { showAlert('Please enter a prompt.'); return; }

            setLoading(btnGenerateVmFl, true);
            vmFlResultContainer.innerHTML = '<div class="loading-state"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--accent-color);"></i><p style="margin-top: 1rem;">Generating transition video with Veo...</p></div>';

            const formData = new FormData();
            formData.append('first_image', vmFlFirstFile);
            formData.append('last_image', vmFlLastFile);
            formData.append('prompt', vmFlPrompt.value);
            if (vmFlContext.value) formData.append('context', vmFlContext.value);
            if (vmFlCountSlider) formData.append('num_videos', vmFlCountSlider.value);

            try {
                const response = await fetch('/api/video-magic/first-last', { method: 'POST', body: formData });
                if (response.ok) {
                    const data = await response.json();
                    vmFlResultContainer.innerHTML = '';
                    vmFlResultContainer.style.display = 'grid';
                    vmFlResultContainer.style.gridTemplateColumns = `repeat(${data.videos.length}, 1fr)`;
                    vmFlResultContainer.style.gap = '1rem';

                    data.videos.forEach((video, index) => {
                        const card = document.createElement('div');
                        card.className = 'video-card';
                        card.innerHTML = `
                            <video controls style="width: 100%; border-radius: 8px; margin-bottom: 0.5rem;" loop>
                                <source src="${video.video_url}" type="video/mp4">
                            </video>
                            <div class="video-actions" style="display: flex; gap: 0.5rem; justify-content: center; margin-top: 0.5rem;">
                                <button class="action-btn" onclick="saveVideoToProject('${video.blob_name}', '${video.video_url}', document.getElementById('vm-fl-prompt').value, 'veo-3.1-first-last', document.getElementById('vm-fl-context').value, window.activeContextVersionName || 'Custom / Draft', this)">
                                    <i class="fa-solid fa-floppy-disk"></i> Save
                                </button>
                                <a href="${video.video_url}" download="transition-${index}.mp4" class="action-btn">
                                    <i class="fa-solid fa-download"></i>
                                </a>
                            </div>
                        `;
                        vmFlResultContainer.appendChild(card);
                    });
                } else {
                    const err = await response.json();
                    vmFlResultContainer.innerHTML = `<div class="empty-state"><p>Error: ${err.detail}</p></div>`;
                }
            } catch (e) {
                vmFlResultContainer.innerHTML = `<div class="empty-state"><p>Error: ${e.message}</p></div>`;
            } finally {
                setLoading(btnGenerateVmFl, false);
            }
        });
    }
}
