
import { initScriptGen } from './script-gen.js';
import { initImageToVideo } from './image-to-video.js';
import { initFirstLast } from './first-last.js';
import { initReference } from './reference.js';
import { initExtend } from './extend.js';

export function initVideoMagic() {
    // Tabs Logic
    const videoMagicTabs = document.querySelectorAll('#video-magic .tab-btn');
    const videoMagicContents = document.querySelectorAll('#video-magic .tab-content');

    videoMagicTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            videoMagicTabs.forEach(t => t.classList.remove('active'));
            videoMagicContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const contentId = tab.dataset.tab;
            const content = document.getElementById(contentId);
            if (content) content.classList.add('active');
        });
    });

    // Initialize Sub-modules
    initScriptGen();
    initImageToVideo();
    initFirstLast();
    initReference();
    initExtend();
}
