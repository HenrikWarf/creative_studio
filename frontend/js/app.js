
import { initNavigation } from './navigation.js';
import { initProjects } from './modules/project.js';
import { initContextEngineering } from './modules/context.js';
import { initVideoMagic } from './modules/video-magic/index.js';
import { initImageCreation } from './modules/image-creation.js';
import { initImageEditing } from './modules/image-editing.js';
import { initVirtualTryOn } from './modules/virtual-try-on.js';
import { initVideoCreation } from './modules/video-creation.js';
import { initLightbox } from './modules/lightbox.js';
import { updateToggleIcon, closeAlertModal, initTabState } from './utils.js';

// Basic UI Setup
initNavigation();

// Feature Modules
initProjects();
initContextEngineering();
initVideoMagic();
initImageCreation();
initImageEditing();
initVideoCreation();
initVirtualTryOn();
initLightbox();

// Alert Modal Close
// Alert Modal Close
const closeAlertBtn = document.getElementById('close-alert');
const okAlertBtn = document.getElementById('btn-alert-ok');

if (closeAlertBtn) closeAlertBtn.addEventListener('click', closeAlertModal);
if (okAlertBtn) okAlertBtn.addEventListener('click', closeAlertModal);

// Theme Toggle
const themeToggleBtn = document.getElementById('theme-toggle');

if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        const isLight = document.body.classList.contains('light-mode');
        if (isLight) {
            document.body.classList.remove('light-mode');
            document.body.dataset.theme = 'dark';
            localStorage.setItem('theme', 'dark');
            updateToggleIcon(false);
        } else {
            document.body.classList.add('light-mode');
            document.body.dataset.theme = 'light';
            localStorage.setItem('theme', 'light');
            updateToggleIcon(true);
        }
    });

    // Init Theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.dataset.theme = savedTheme;
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        updateToggleIcon(true);
    } else {
        document.body.classList.remove('light-mode');
        updateToggleIcon(false);
    }
}
