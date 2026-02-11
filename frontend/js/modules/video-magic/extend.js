
import { setupContextAccordion } from '../context.js';
import { showAlert, setLoading } from '../../utils.js';
import { activeContextVersionName } from '../context.js';

export function initExtend() {
    setupContextAccordion('btn-context-accordion-vm-extend', 'context-content-vm-extend', 'context-checkboxes-vm-extend', 'btn-apply-context-vm-extend', 'vm-extend-context', 'vm-extend-context-label', 'btn-clear-context-vm-extend');

    const dropZoneVmExtend = document.getElementById('drop-zone-vm-extend');
    const fileInputVmExtend = document.getElementById('file-input-vm-extend');
    const previewContainerVmExtend = document.getElementById('preview-container-vm-extend');
    const previewVideoVmExtend = document.getElementById('preview-video-vm-extend');
    const btnRemoveVideoVmExtend = document.getElementById('btn-remove-video-vm-extend');

    const vmExtendPrompt = document.getElementById('vm-extend-prompt');
    const vmExtendContext = document.getElementById('vm-extend-context');
    const btnClearContextVmExtend = document.getElementById('btn-clear-context-vm-extend');
    const btnGenerateVmExtend = document.getElementById('btn-generate-vm-extend');
    const vmExtendResultContainer = document.getElementById('vm-extend-result-container');
    const btnOptimizeVmExtend = document.getElementById('btn-optimize-vm-extend');
    const vmExtendCountSlider = document.getElementById('vm-extend-count-slider');
    const vmExtendCountDisplay = document.getElementById('vm-extend-count-display');

    if (vmExtendCountSlider && vmExtendCountDisplay) {
        vmExtendCountSlider.addEventListener('input', (e) => vmExtendCountDisplay.textContent = e.target.value);
    }

    let vmExtendFile = null;

    if (dropZoneVmExtend && fileInputVmExtend) {
        dropZoneVmExtend.addEventListener('click', () => fileInputVmExtend.click());
        dropZoneVmExtend.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneVmExtend.style.borderColor = 'var(--accent-color)'; });
        dropZoneVmExtend.addEventListener('dragleave', () => { if (!vmExtendFile) dropZoneVmExtend.style.borderColor = 'rgba(255, 255, 255, 0.1)'; });
        dropZoneVmExtend.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleVmExtendFile(e.dataTransfer.files[0]); });
        fileInputVmExtend.addEventListener('change', (e) => { if (e.target.files.length) handleVmExtendFile(e.target.files[0]); });
    }

    function handleVmExtendFile(file) {
        if (!file.type.startsWith('video/')) { showAlert('Please select a video file (MP4).'); return; }
        vmExtendFile = file;
        const url = URL.createObjectURL(file);
        previewVideoVmExtend.src = url;
        dropZoneVmExtend.style.display = 'none';
        previewContainerVmExtend.style.display = 'block';
    }

    if (btnRemoveVideoVmExtend) {
        btnRemoveVideoVmExtend.addEventListener('click', (e) => {
            e.stopPropagation(); vmExtendFile = null; fileInputVmExtend.value = ''; previewVideoVmExtend.src = '';
            previewContainerVmExtend.style.display = 'none'; dropZoneVmExtend.style.display = 'flex';
        });
    }

    if (btnClearContextVmExtend) {
        btnClearContextVmExtend.addEventListener('click', () => {
            const versionSpan = document.getElementById('vm-extend-context-version');
            if (vmExtendContext) vmExtendContext.value = '';
            if (versionSpan) versionSpan.textContent = '';
        });
    }

    if (btnOptimizeVmExtend) {
        btnOptimizeVmExtend.addEventListener('click', async () => {
            if (!vmExtendFile) { showAlert('Please upload a video first.'); return; }
            if (!vmExtendPrompt.value) { showAlert('Please enter draft instructions.'); return; }

            const originalContent = btnOptimizeVmExtend.innerHTML;
            setLoading(btnOptimizeVmExtend, true);

            const formData = new FormData();
            formData.append('video', vmExtendFile);
            formData.append('instructions', vmExtendPrompt.value);

            try {
                const response = await fetch('/api/video-magic/optimize-video-prompt', { method: 'POST', body: formData });
                if (response.ok) {
                    const data = await response.json();
                    vmExtendPrompt.value = data.optimized_prompt;
                } else {
                    const err = await response.json();
                    showAlert(`Error: ${err.detail}`);
                }
            } catch (err) {
                showAlert(`Error: ${err.message}`);
            } finally {
                setLoading(btnOptimizeVmExtend, false);
                btnOptimizeVmExtend.innerHTML = originalContent;
            }
        });
    }

    if (btnGenerateVmExtend) {
        btnGenerateVmExtend.addEventListener('click', async () => {
            if (!vmExtendFile) { showAlert('Please upload a video to extend.'); return; }
            if (!vmExtendPrompt.value) { showAlert('Please enter a prompt.'); return; }

            setLoading(btnGenerateVmExtend, true);
            vmExtendResultContainer.innerHTML = '<div class="loading-state"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--accent-color);"></i><p style="margin-top: 1rem;">Extending video with Veo...</p></div>';

            const formData = new FormData();
            formData.append('video', vmExtendFile);
            formData.append('prompt', vmExtendPrompt.value);
            if (vmExtendContext.value) formData.append('context', vmExtendContext.value);
            if (vmExtendCountSlider) formData.append('num_videos', vmExtendCountSlider.value);

            try {
                const response = await fetch('/api/video-magic/extend-video', { method: 'POST', body: formData });
                if (response.ok) {
                    const data = await response.json();
                    vmExtendResultContainer.innerHTML = '';
                    vmExtendResultContainer.style.display = 'grid';
                    vmExtendResultContainer.style.gridTemplateColumns = `repeat(${data.videos.length}, 1fr)`;
                    vmExtendResultContainer.style.gap = '1rem';

                    data.videos.forEach((video, index) => {
                        const card = document.createElement('div');
                        card.className = 'video-card';
                        card.innerHTML = `
                            <video controls style="width: 100%; border-radius: 8px; margin-bottom: 0.5rem;" loop>
                                <source src="${video.video_url}" type="video/mp4">
                            </video>
                            <div class="video-actions" style="display: flex; gap: 0.5rem; justify-content: center; margin-top: 0.5rem;">
                                <button class="action-btn" onclick="saveVideoToProject('${video.blob_name}', '${video.video_url}', document.getElementById('vm-extend-prompt').value, 'veo-3.1-extend', document.getElementById('vm-extend-context').value, window.activeContextVersionName || 'Custom / Draft', this)">
                                    <i class="fa-solid fa-floppy-disk"></i> Save
                                </button>
                                <a href="${video.video_url}" download="extended-video-${index}.mp4" class="action-btn">
                                    <i class="fa-solid fa-download"></i>
                                </a>
                            </div>
                        `;
                        vmExtendResultContainer.appendChild(card);
                    });
                } else {
                    const err = await response.json();
                    vmExtendResultContainer.innerHTML = `<div class="empty-state"><p>Error: ${err.detail}</p></div>`;
                }
            } catch (e) {
                vmExtendResultContainer.innerHTML = `<div class="empty-state"><p>Error: ${e.message}</p></div>`;
            } finally {
                setLoading(btnGenerateVmExtend, false);
            }
        });
    }
}
