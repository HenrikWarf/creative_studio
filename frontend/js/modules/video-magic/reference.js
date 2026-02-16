
import { setupContextAccordion } from '../context.js';
import { showAlert, setLoading } from '../../utils.js';
import { activeContextVersionName } from '../context.js';

export function initReference() {
    setupContextAccordion('btn-context-accordion-vm-ref', 'context-content-vm-ref', 'context-checkboxes-vm-ref', 'btn-apply-context-vm-ref', 'vm-ref-context', 'vm-ref-context-label', 'btn-clear-context-vm-ref');

    const dropZoneVmRef = document.getElementById('drop-zone-vm-ref');
    const fileInputVmRef = document.getElementById('file-input-vm-ref');
    const previewContainerVmRef = document.getElementById('preview-container-vm-ref');
    const previewImgVmRef = document.getElementById('preview-img-vm-ref');
    const btnRemoveImgVmRef = document.getElementById('btn-remove-img-vm-ref');

    const vmRefPrompt = document.getElementById('vm-ref-prompt');
    const vmRefContext = document.getElementById('vm-ref-context');
    const btnClearContextVmRef = document.getElementById('btn-clear-context-vm-ref');
    const btnGenerateVmRef = document.getElementById('btn-generate-vm-ref');
    const vmRefResultContainer = document.getElementById('vm-ref-result-container');
    const btnOptimizeVmRef = document.getElementById('btn-optimize-vm-ref');
    const vmRefCountSlider = document.getElementById('vm-ref-count-slider');
    const vmRefCountDisplay = document.getElementById('vm-ref-count-display');

    if (vmRefCountSlider && vmRefCountDisplay) {
        vmRefCountSlider.addEventListener('input', (e) => vmRefCountDisplay.textContent = e.target.value);
    }

    let vmRefFile = null;

    if (dropZoneVmRef && fileInputVmRef) {
        dropZoneVmRef.addEventListener('click', () => fileInputVmRef.click());
        dropZoneVmRef.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneVmRef.style.borderColor = 'var(--accent-color)'; });
        dropZoneVmRef.addEventListener('dragleave', () => { if (!vmRefFile) dropZoneVmRef.style.borderColor = 'rgba(255, 255, 255, 0.1)'; });
        dropZoneVmRef.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleVmRefFile(e.dataTransfer.files[0]); });
        fileInputVmRef.addEventListener('change', (e) => { if (e.target.files.length) handleVmRefFile(e.target.files[0]); });
    }

    function handleVmRefFile(file) {
        if (!file.type.startsWith('image/')) { showAlert('Please select an image file.'); return; }
        vmRefFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImgVmRef.src = e.target.result;
            previewImgVmRef.style.cursor = 'pointer';
            previewImgVmRef.onclick = () => window.openSimpleLightbox(e.target.result);
            dropZoneVmRef.style.display = 'none';
            previewContainerVmRef.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }

    if (btnRemoveImgVmRef) {
        btnRemoveImgVmRef.addEventListener('click', (e) => {
            e.stopPropagation(); vmRefFile = null; fileInputVmRef.value = ''; previewImgVmRef.src = '';
            previewContainerVmRef.style.display = 'none'; dropZoneVmRef.style.display = 'flex';
        });
    }

    if (btnClearContextVmRef) {
        btnClearContextVmRef.addEventListener('click', () => {
            const versionSpan = document.getElementById('vm-ref-context-version');
            if (vmRefContext) vmRefContext.value = '';
            if (versionSpan) versionSpan.textContent = '';
        });
    }

    if (btnOptimizeVmRef) {
        btnOptimizeVmRef.addEventListener('click', async () => {
            const currentPrompt = vmRefPrompt.value;
            if (!currentPrompt) { showAlert('Please enter some initial instructions.'); return; }

            const originalBtnContent = btnOptimizeVmRef.innerHTML;
            btnOptimizeVmRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enhancing...';
            btnOptimizeVmRef.disabled = true;

            try {
                if (vmRefFile) {
                    const formData = new FormData();
                    formData.append('image', vmRefFile);
                    formData.append('instructions', currentPrompt);
                    const response = await fetch('/video-magic/optimize-prompt', { method: 'POST', body: formData });
                    if (response.ok) {
                        const data = await response.json();
                        vmRefPrompt.value = data.optimized_prompt;
                    } else {
                        const err = await response.json();
                        showAlert(`Error: ${err.detail}`);
                    }
                } else {
                    showAlert('Please upload the Subject Image.');
                }
            } catch (err) {
                showAlert(`Error: ${err.message}`);
            } finally {
                btnOptimizeVmRef.innerHTML = originalBtnContent;
                btnOptimizeVmRef.disabled = false;
            }
        });
    }

    if (btnGenerateVmRef) {
        btnGenerateVmRef.addEventListener('click', async () => {
            if (!vmRefFile) { showAlert('Please upload a Subject Reference image.'); return; }
            if (!vmRefPrompt.value) { showAlert('Please enter a prompt.'); return; }

            setLoading(btnGenerateVmRef, true);
            vmRefResultContainer.innerHTML = '<div class="loading-state"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--accent-color);"></i><p style="margin-top: 1rem;">Generating video from reference with Veo...</p></div>';

            const formData = new FormData();
            formData.append('image', vmRefFile);
            formData.append('prompt', vmRefPrompt.value);
            if (vmRefContext.value) formData.append('context', vmRefContext.value);
            if (vmRefCountSlider) formData.append('num_videos', vmRefCountSlider.value);

            try {
                const response = await fetch('/video-magic/reference-image', { method: 'POST', body: formData });
                if (response.ok) {
                    const data = await response.json();
                    vmRefResultContainer.innerHTML = '';
                    vmRefResultContainer.style.display = 'grid';
                    vmRefResultContainer.style.gridTemplateColumns = `repeat(${data.videos.length}, 1fr)`;
                    vmRefResultContainer.style.gap = '1rem';

                    data.videos.forEach((video, index) => {
                        const card = document.createElement('div');
                        card.className = 'video-card';
                        card.innerHTML = `
                            <video controls style="width: 100%; border-radius: 8px; margin-bottom: 0.5rem;" loop>
                                <source src="${video.video_url}" type="video/mp4">
                            </video>
                            <div class="video-actions" style="display: flex; gap: 0.5rem; justify-content: center; margin-top: 0.5rem;">
                                <button class="action-btn" onclick="saveVideoToProject('${video.blob_name}', '${video.video_url}', document.getElementById('vm-ref-prompt').value, 'veo-3.1-ref-img', document.getElementById('vm-ref-context').value, window.activeContextVersionName || 'Custom / Draft', this)">
                                    <i class="fa-solid fa-floppy-disk"></i> Save
                                </button>
                                <a href="${video.download_url || video.video_url}" download="ref-video-${index}.mp4" class="action-btn">
                                    <i class="fa-solid fa-download"></i>
                                </a>
                            </div>
                        `;
                        vmRefResultContainer.appendChild(card);
                    });
                } else {
                    const err = await response.json();
                    vmRefResultContainer.innerHTML = `<div class="empty-state"><p>Error: ${err.detail}</p></div>`;
                }
            } catch (e) {
                vmRefResultContainer.innerHTML = `<div class="empty-state"><p>Error: ${e.message}</p></div>`;
            } finally {
                setLoading(btnGenerateVmRef, false);
            }
        });
    }
}
