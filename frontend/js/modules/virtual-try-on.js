
import { showAlert, setLoading } from '../utils.js';
import { currentProjectId } from './project.js';

export function initVirtualTryOn() {
    const btnTryon = document.getElementById('btn-tryon');
    const vtoPersonInput = document.getElementById('vto-person-file');
    const vtoClothInput = document.getElementById('vto-cloth-file');
    const vtoPersonPreview = document.getElementById('vto-person-preview');
    const vtoClothPreviewList = document.getElementById('vto-cloth-preview-list');
    const vtoResultContainer = document.getElementById('vto-result-container');
    const btnResetVto = document.getElementById('btn-reset-vto');

    let vtoClothingFiles = [];

    // Helper to update clothing previews
    function updateClothingPreviews() {
        if (!vtoClothPreviewList) return;
        vtoClothPreviewList.innerHTML = '';
        vtoClothingFiles.forEach((file, index) => {
            const container = document.createElement('div');
            container.className = 'preview-item';
            container.style.cssText = 'position: relative; display: inline-block; margin: 5px;';

            const img = document.createElement('img');
            img.classList.add('preview-thumb');
            img.style.cssText = 'width: 80px; height: 80px; object-fit: cover; border-radius: 8px; cursor: pointer;';
            const reader = new FileReader();
            reader.onload = (ev) => { img.src = ev.target.result; img.onclick = () => window.openSimpleLightbox(img.src); };
            reader.readAsDataURL(file);

            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '<i class="fa-solid fa-times"></i>';
            removeBtn.className = 'remove-btn';
            removeBtn.style.cssText = 'position: absolute; top: -5px; right: -5px; background: red; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px;';
            removeBtn.onclick = (e) => { e.stopPropagation(); vtoClothingFiles.splice(index, 1); updateClothingPreviews(); };

            container.appendChild(img);
            container.appendChild(removeBtn);
            vtoClothPreviewList.appendChild(container);
        });

        const uploadArea = document.getElementById('vto-cloth-upload');
        if (uploadArea) {
            const span = uploadArea.querySelector('span');
            if (span) span.textContent = vtoClothingFiles.length > 0 ? `${vtoClothingFiles.length} garments selected` : 'Upload Garment';
        }
    }

    if (btnTryon) {
        const personUploadBtn = document.getElementById('vto-person-upload');
        const clothUploadBtn = document.getElementById('vto-cloth-upload');

        if (personUploadBtn) personUploadBtn.addEventListener('click', () => vtoPersonInput.click());
        if (clothUploadBtn) clothUploadBtn.addEventListener('click', () => vtoClothInput.click());

        vtoPersonInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    vtoPersonPreview.src = ev.target.result;
                    vtoPersonPreview.hidden = false;
                    vtoPersonPreview.style.cursor = 'pointer';
                    vtoPersonPreview.onclick = () => window.openSimpleLightbox(vtoPersonPreview.src);
                    if (personUploadBtn) personUploadBtn.style.display = 'none';
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });

        vtoClothInput.addEventListener('change', (e) => {
            const newFiles = Array.from(e.target.files);
            newFiles.forEach(file => {
                if (vtoClothingFiles.length < 3) {
                    const exists = vtoClothingFiles.some(f => f.name === file.name && f.size === file.size);
                    if (!exists) vtoClothingFiles.push(file);
                } else { showAlert('Maximum 3 clothing images allowed.'); }
            });
            updateClothingPreviews();
            e.target.value = '';
        });

        if (btnResetVto) {
            btnResetVto.addEventListener('click', () => {
                vtoPersonInput.value = '';
                vtoClothInput.value = '';
                vtoClothingFiles = [];
                vtoPersonPreview.src = '';
                vtoPersonPreview.hidden = true;
                if (personUploadBtn) personUploadBtn.style.display = 'flex';
                updateClothingPreviews();
                vtoResultContainer.innerHTML = '<div class="empty-state"><i class="fa-solid fa-shirt"></i><p>Try-on result will appear here</p></div>';
            });
        }

        btnTryon.addEventListener('click', async () => {
            if (!currentProjectId) { showAlert('Please select or create a project first.'); return; }
            if (!vtoPersonInput.files[0] || vtoClothingFiles.length === 0) { showAlert('Please upload person and at least one clothing image'); return; }

            setLoading(btnTryon, true);
            const formData = new FormData();
            formData.append('person_image', vtoPersonInput.files[0]);
            vtoClothingFiles.forEach(file => formData.append('clothing_images', file));
            formData.append('project_id', currentProjectId);

            try {
                const response = await fetch('/virtual-try-on/', { method: 'POST', body: formData });
                if (response.ok) {
                    const url = await response.json();
                    vtoResultContainer.innerHTML = `
                        <img src="${url}" alt="Try-on Result" style="cursor: pointer; max-height: 50vh; object-fit: contain;" onclick="openSimpleLightbox('${url}')">
                        <div class="project-actions" style="justify-content: center; margin-top: 1rem; gap: 10px;">
                            <button class="secondary-btn" onclick="openEditModal('${url}')"><i class="fa-solid fa-wand-magic-sparkles"></i> Edit</button>
                            <button class="secondary-btn" onclick="saveImageToProject('${url}', this)"><i class="fa-regular fa-floppy-disk"></i> Save to Project</button>
                            <button class="secondary-btn" onclick="downloadImage('${url}', 'try-on-result.png')"><i class="fa-solid fa-download"></i> Download</button>
                        </div>`;
                } else {
                    const data = await response.json();
                    showAlert('Error: ' + data.detail);
                }
            } catch (e) { console.error(e); showAlert('An error occurred'); }
            finally { setLoading(btnTryon, false); }
        });
    }
}
