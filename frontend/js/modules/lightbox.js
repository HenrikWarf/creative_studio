
import { currentProjectAssets } from './project.js';

let currentLightboxIndex = 0;

export function initLightbox() {
    const lightboxModal = document.getElementById('lightbox-modal');
    const closeLightbox = document.querySelector('.close-lightbox');
    const prevBtn = document.querySelector('.lightbox-prev');
    const nextBtn = document.querySelector('.lightbox-next');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxVideo = document.getElementById('lightbox-video');
    const lightboxCaption = document.getElementById('lightbox-caption');

    if (!lightboxModal) return;

    // Global Functions for Lightbox
    window.openSimpleLightbox = (src) => {
        lightboxImg.src = src;
        lightboxImg.hidden = false;
        if (lightboxVideo) {
            lightboxVideo.hidden = true;
            lightboxVideo.pause();
        }

        if (prevBtn) prevBtn.hidden = true;
        if (nextBtn) nextBtn.hidden = true;

        if (lightboxCaption) lightboxCaption.textContent = '';
        lightboxModal.hidden = false;
    };

    window.openLightbox = (index) => {
        currentLightboxIndex = index;
        updateLightboxContent();

        if (prevBtn) prevBtn.hidden = false;
        if (nextBtn) nextBtn.hidden = false;

        lightboxModal.hidden = false;
    };

    function closeLightboxModal() {
        lightboxModal.hidden = true;
        if (lightboxVideo) {
            lightboxVideo.pause();
            lightboxVideo.src = '';
        }
    }

    function updateLightboxContent() {
        const asset = currentProjectAssets[currentLightboxIndex];
        if (!asset) return;

        if (asset.type === 'video') {
            lightboxImg.hidden = true;
            lightboxVideo.hidden = false;
            lightboxVideo.src = asset.url;
            lightboxVideo.load();
        } else {
            lightboxVideo.hidden = true;
            lightboxImg.hidden = false;
            lightboxImg.src = asset.url;
        }

        if (lightboxCaption) lightboxCaption.textContent = `${asset.type} - ${new Date(asset.created_at).toLocaleString()} `;
    }

    function nextSlide() {
        if (currentProjectAssets.length === 0) return;
        currentLightboxIndex = (currentLightboxIndex + 1) % currentProjectAssets.length;
        updateLightboxContent();
    }

    function prevSlide() {
        if (currentProjectAssets.length === 0) return;
        currentLightboxIndex = (currentLightboxIndex - 1 + currentProjectAssets.length) % currentProjectAssets.length;
        updateLightboxContent();
    }

    if (closeLightbox) closeLightbox.addEventListener('click', closeLightboxModal);
    if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); nextSlide(); });
    if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); prevSlide(); });

    document.addEventListener('keydown', (e) => {
        if (lightboxModal && !lightboxModal.hidden) {
            if (e.key === 'Escape') closeLightboxModal();
            if (e.key === 'ArrowRight') nextSlide();
            if (e.key === 'ArrowLeft') prevSlide();
        }
    });

    lightboxModal.addEventListener('click', (e) => {
        if (e.target === lightboxModal) closeLightboxModal();
    });
}
