
import { setupContextAccordion, activeContextVersionName } from '../context.js';
import { showAlert, setLoading } from '../../utils.js';

export function initImageToVideo() {
    // Initialize Context Accordion for Image to Video
    setupContextAccordion('btn-context-accordion-vm-img', 'context-content-vm-img', 'context-checkboxes-vm-img', 'btn-apply-context-vm-img', 'vm-img-context', 'vm-img-context-label', 'btn-clear-context-vm-img');

    const dropZoneVmImg = document.getElementById('drop-zone-vm-img');
    const fileInputVmImg = document.getElementById('file-input-vm-img');
    const previewContainerVmImg = document.getElementById('preview-container-vm-img');
    const previewImgVmImg = document.getElementById('preview-img-vm-img');
    const btnRemoveImgVmImg = document.getElementById('btn-remove-img-vm-img');
    const vmImgPrompt = document.getElementById('vm-img-prompt');
    const vmImgContext = document.getElementById('vm-img-context');
    const btnGenerateVmImg = document.getElementById('btn-generate-vm-img');
    const vmImgResultContainer = document.getElementById('vm-img-result-container');
    const btnOptimizeVmImg = document.getElementById('btn-optimize-vm-img');
    const vmImgCountSlider = document.getElementById('vm-img-count-slider');
    const vmImgCountDisplay = document.getElementById('vm-img-count-display');

    if (vmImgCountSlider && vmImgCountDisplay) {
        vmImgCountSlider.addEventListener('input', (e) => {
            vmImgCountDisplay.textContent = e.target.value;
        });
    }

    let vmImgFile = null;

    if (dropZoneVmImg && fileInputVmImg) {
        dropZoneVmImg.addEventListener('click', () => fileInputVmImg.click());

        dropZoneVmImg.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZoneVmImg.style.borderColor = 'var(--accent-color)';
            dropZoneVmImg.style.backgroundColor = 'rgba(124, 77, 255, 0.05)';
        });

        dropZoneVmImg.addEventListener('dragleave', () => {
            dropZoneVmImg.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            dropZoneVmImg.style.backgroundColor = 'transparent';
        });

        dropZoneVmImg.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZoneVmImg.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            dropZoneVmImg.style.backgroundColor = 'transparent';
            if (e.dataTransfer.files.length) {
                handleVmImgFile(e.dataTransfer.files[0]);
            }
        });

        fileInputVmImg.addEventListener('change', (e) => {
            if (e.target.files.length) {
                handleVmImgFile(e.target.files[0]);
            }
        });
    }

    function handleVmImgFile(file) {
        if (!file.type.startsWith('image/')) {
            showAlert('Please select an image file.');
            return;
        }
        vmImgFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImgVmImg.src = e.target.result;
            dropZoneVmImg.style.display = 'none';
            previewContainerVmImg.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }

    if (btnRemoveImgVmImg) {
        btnRemoveImgVmImg.addEventListener('click', (e) => {
            e.stopPropagation();
            vmImgFile = null;
            fileInputVmImg.value = '';
            previewImgVmImg.src = '';
            previewContainerVmImg.style.display = 'none';
            dropZoneVmImg.style.display = 'flex';
        });
    }

    if (btnOptimizeVmImg) {
        btnOptimizeVmImg.addEventListener('click', async () => {
            if (!vmImgFile) {
                showAlert('Please upload an image first to use image-aware enhancement.');
                return;
            }
            if (!vmImgPrompt.value) {
                showAlert('Please enter some initial instructions.');
                return;
            }

            const originalBtnContent = btnOptimizeVmImg.innerHTML;
            btnOptimizeVmImg.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enhancing...';
            btnOptimizeVmImg.disabled = true;

            const formData = new FormData();
            formData.append('image', vmImgFile);
            formData.append('instructions', vmImgPrompt.value);

            try {
                const response = await fetch('/video-magic/optimize-prompt', {
                    method: 'POST',
                    body: formData
                });
                if (response.ok) {
                    const data = await response.json();
                    vmImgPrompt.value = data.optimized_prompt;
                } else {
                    const err = await response.json();
                    showAlert(`Error: ${err.detail}`);
                }
            } catch (err) {
                showAlert('Error optimizing prompt');
            } finally {
                btnOptimizeVmImg.innerHTML = originalBtnContent;
                btnOptimizeVmImg.disabled = false;
            }
        });
    }

    if (btnGenerateVmImg) {
        btnGenerateVmImg.addEventListener('click', async () => {
            if (!vmImgFile) {
                showAlert('Please upload an image first.');
                return;
            }
            if (!vmImgPrompt.value) {
                showAlert('Please enter a prompt.');
                return;
            }

            setLoading(btnGenerateVmImg, true);
            vmImgResultContainer.innerHTML = `
                <div class="loading-state">
                    <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--accent-color);"></i>
                    <p style="margin-top: 1rem;">Generating video with Veo...</p>
                </div>
            `;

            const formData = new FormData();
            formData.append('image', vmImgFile);
            formData.append('prompt', vmImgPrompt.value);
            if (vmImgContext.value) {
                formData.append('context', vmImgContext.value);
            }
            if (vmImgCountSlider) {
                formData.append('num_videos', vmImgCountSlider.value);
            }

            try {
                const response = await fetch('/video-magic/image-to-video', {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    const data = await response.json();
                    vmImgResultContainer.innerHTML = '';
                    vmImgResultContainer.style.display = 'grid';
                    vmImgResultContainer.style.gridTemplateColumns = `repeat(${data.videos.length}, 1fr)`;
                    vmImgResultContainer.style.gap = '1rem';

                    data.videos.forEach((video, index) => {
                        const card = document.createElement('div');
                        card.className = 'video-card';
                        card.innerHTML = `
                            <video controls style="width: 100%; border-radius: 8px; margin-bottom: 0.5rem;">
                                <source src="${video.video_url}" type="video/mp4">
                                Your browser does not support the video tag.
                            </video>
                            <div class="video-actions" style="display: flex; gap: 0.5rem; justify-content: center; margin-top: 0.5rem;">
                                <button class="action-btn" onclick="saveVideoToProject('${video.blob_name}', '${video.video_url}', document.getElementById('vm-img-prompt').value, 'veo-3.1', document.getElementById('vm-img-context').value, window.activeContextVersionName || 'Custom / Draft', this)">
                                    <i class="fa-solid fa-floppy-disk"></i> Save
                                </button>
                                <a href="${video.download_url || video.video_url}" download="generated-video-${index}.mp4" class="action-btn">
                                    <i class="fa-solid fa-download"></i>
                                </a>
                            </div>
                        `;
                        vmImgResultContainer.appendChild(card);
                    });
                } else {
                    const err = await response.json();
                    vmImgResultContainer.innerHTML = `<div class="empty-state"><p>Error: ${err.detail}</p></div>`;
                }
            } catch (error) {
                vmImgResultContainer.innerHTML = `<div class="empty-state"><p>Error: ${error.message}</p></div>`;
            } finally {
                setLoading(btnGenerateVmImg, false);
            }
        });
    }
}
