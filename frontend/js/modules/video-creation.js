
import { showAlert, setLoading } from '../utils.js';
import { currentProjectId } from './project.js';
import { setupContextAccordion } from './context.js';

export function initVideoCreation() {
    const btnGenerateVideo = document.getElementById('btn-generate-video');
    const videoPrompt = document.getElementById('video-prompt');
    const videoContext = document.getElementById('video-context');
    const videoResultContainer = document.getElementById('video-result-container');
    const modelSelect = document.getElementById('video-model-select');
    const aspectRatioSelect = document.getElementById('video-aspect-ratio');

    // Initialize Context Accordion
    setupContextAccordion('btn-context-accordion-video', 'context-content-video', 'context-checkboxes-video', 'btn-apply-context-video', 'video-context', 'video-context-version', 'btn-clear-context-video');

    const videoCountSlider = document.getElementById('video-count-slider');
    const videoCountDisplay = document.getElementById('video-count-display');

    if (videoCountSlider && videoCountDisplay) {
        videoCountSlider.addEventListener('input', (e) => {
            videoCountDisplay.textContent = e.target.value;
        });
    }

    if (btnGenerateVideo) {
        btnGenerateVideo.addEventListener('click', async () => {
            if (!currentProjectId) {
                showAlert('Please select or create a project first.');
                return;
            }
            if (!videoPrompt.value) {
                showAlert('Please enter a prompt.');
                return;
            }

            setLoading(btnGenerateVideo, true);
            videoResultContainer.innerHTML = `
                <div class="loading-state">
                    <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--accent-color);"></i>
                    <p style="margin-top: 1rem;">Generating video...</p>
                </div>
            `;

            const formData = new FormData();
            const fullPrompt = videoContext.value ? `${videoPrompt.value}\n\nContext:\n${videoContext.value}` : videoPrompt.value;

            formData.append('prompt', fullPrompt);
            formData.append('project_id', currentProjectId);

            if (videoCountSlider) {
                formData.append('num_videos', videoCountSlider.value);
            }

            // Add other parameters if available in HTML (model, aspect ratio etc.)
            // Assuming simplified logic for now matching Image Creation style or backend requirements

            try {
                // Determine endpoint based on model selection if implemented
                // For now assuming Veo via Video Magic or standard Video Creation endpoint
                // Since this is "Video Creation" tab, let's assume it uses the /video-creation/generate endpoint if it exists
                // Or /video-magic/generate if utilizing that.
                // Checking backend routers list... there is video_creation.router.

                const response = await fetch('/video-creation/generate', {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    const data = await response.json();
                    videoResultContainer.innerHTML = '';

                    // Handle result (assuming list of videos or single video)
                    // Handle result (assuming list of videos or single video)
                    // Backend returns list of objects: {video_url, blob_name}
                    let videos = [];
                    if (data.videos) {
                        videos = data.videos;
                    } else if (data.video_url) {
                        videos = [data]; // Treat single response as list of one object
                    }

                    videos.forEach((video, index) => {
                        const url = typeof video === 'string' ? video : video.video_url;
                        const blobName = typeof video === 'string' ? (data.blob_name || '') : video.blob_name;

                        const card = document.createElement('div');
                        card.className = 'video-card';
                        card.innerHTML = `
                            <video controls style="width: 100%; border-radius: 8px; margin-bottom: 0.5rem;">
                                <source src="${url}" type="video/mp4">
                                Your browser does not support video.
                            </video>
                             <div class="video-actions" style="display: flex; gap: 0.5rem; justify-content: center; margin-top: 0.5rem;">
                                <button class="action-btn" onclick="saveVideoToProject('${blobName}', '${url}', document.getElementById('video-prompt').value, 'veo', document.getElementById('video-context').value, 'Custom', this)">
                                    <i class="fa-solid fa-floppy-disk"></i> Save
                                </button>
                                <a href="${url}" download="generated-video-${index}.mp4" class="action-btn">
                                    <i class="fa-solid fa-download"></i>
                                </a>
                            </div>
                        `;
                        videoResultContainer.appendChild(card);
                    });

                } else {
                    const error = await response.json();
                    videoResultContainer.innerHTML = `<p class="error-text">Error: ${error.detail}</p>`;
                }
            } catch (error) {
                console.error(error);
                videoResultContainer.innerHTML = `<p class="error-text">An error occurred.</p>`;
            } finally {
                setLoading(btnGenerateVideo, false);
            }
        });
    }
}
