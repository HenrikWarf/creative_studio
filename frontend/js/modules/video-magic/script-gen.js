
import { setupContextAccordion } from '../context.js';
import { showAlert, setLoading } from '../../utils.js';

let currentScriptData = null;

export function initScriptGen() {
    setupContextAccordion('btn-context-accordion-vm-script', 'context-content-vm-script', 'context-checkboxes-vm-script', 'btn-apply-context-vm-script', 'vm-script-context', 'vm-script-context-checkbox', 'btn-clear-context-vm-script');

    const vmScriptPrompt = document.getElementById('vm-script-prompt');
    const vmScriptContext = document.getElementById('vm-script-context');
    const btnGenerateScript = document.getElementById('btn-generate-script');
    const vmScriptOutput = document.getElementById('vm-script-output');
    const btnEditScript = document.getElementById('btn-edit-script');
    const btnClearScriptInputs = document.getElementById('btn-clear-script-inputs');
    const btnClearScriptOutput = document.getElementById('btn-clear-script-output');

    if (btnClearScriptInputs) {
        btnClearScriptInputs.addEventListener('click', () => {
            if (vmScriptPrompt) vmScriptPrompt.value = '';
            if (vmScriptContext) vmScriptContext.value = '';
            // Reset context UI
            const contextCheckbox = document.getElementById('vm-script-context-checkbox');
            const contextLabel = document.getElementById('vm-script-context-label');
            if (contextCheckbox) {
                contextCheckbox.checked = false;
                contextCheckbox.disabled = true;
            }
            if (contextLabel) {
                contextLabel.textContent = 'Context not applied';
                contextLabel.style.color = 'var(--text-secondary)';
            }
        });
    }

    if (btnClearScriptOutput) {
        btnClearScriptOutput.addEventListener('click', () => {
            if (!vmScriptOutput) return;
            vmScriptOutput.innerHTML = `
                <div class="placeholder-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                    <i class="fa-solid fa-scroll" style="font-size: 3rem; color: var(--text-secondary); opacity: 0.5;"></i>
                    <p style="margin-top: 1rem; color: var(--text-secondary);">Generated script will appear here</p>
                </div>`;
            if (btnEditScript) btnEditScript.hidden = true;
            currentScriptData = null;
        });
    }

    if (btnGenerateScript) {
        btnGenerateScript.addEventListener('click', async () => {
            if (!vmScriptPrompt.value) {
                showAlert('Please enter a prompt for the script.');
                return;
            }

            setLoading(btnGenerateScript, true);
            vmScriptOutput.innerHTML = `
                <div class="loading-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                    <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--accent-color);"></i>
                    <p style="margin-top: 1rem;">Generating script with Gemini ...</p>
                </div>
            `;

            try {
                const formData = new FormData();
                formData.append('prompt', vmScriptPrompt.value);
                if (vmScriptContext.value) formData.append('context', vmScriptContext.value);

                const response = await fetch('/video-magic/script/generate', {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    const data = await response.json();
                    currentScriptData = data.script;
                    renderScript(data.script);
                    if (btnEditScript) btnEditScript.hidden = false;
                } else {
                    const error = await response.json();
                    vmScriptOutput.innerHTML = `<div class="error-state"><i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; color: var(--error-color);"></i><p style="margin-top: 1rem;">Error: ${error.detail || 'Failed to generate script'}</p></div>`;
                }
            } catch (error) {
                console.error('Error generating script:', error);
                vmScriptOutput.innerHTML = `<div class="error-state"><i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; color: var(--error-color);"></i><p style="margin-top: 1rem;">An error occurred. Please try again.</p></div>`;
            } finally {
                setLoading(btnGenerateScript, false);
            }
        });
    }

    // Edit Script
    if (btnEditScript) {
        btnEditScript.addEventListener('click', () => {
            const modalEnhance = document.getElementById('modal-enhance-field');
            const instructions = document.getElementById('enhance-instructions');
            const btnConfirm = document.getElementById('btn-confirm-enhance');

            if (modalEnhance && instructions && btnConfirm) {
                instructions.value = '';
                modalEnhance.hidden = false;

                const newBtn = btnConfirm.cloneNode(true);
                btnConfirm.parentNode.replaceChild(newBtn, btnConfirm);

                newBtn.addEventListener('click', async () => {
                    if (!instructions.value) {
                        showAlert('Please enter instructions.');
                        return;
                    }

                    setLoading(newBtn, true);
                    try {
                        const formData = new FormData();
                        // Backend expects 'current_script' as a JSON string
                        formData.append('current_script', JSON.stringify(currentScriptData));
                        formData.append('instructions', instructions.value);

                        const response = await fetch('/video-magic/script/edit', {
                            method: 'POST',
                            body: formData
                        });

                        if (response.ok) {
                            const data = await response.json();
                            currentScriptData = data.script;
                            renderScript(data.script);
                            modalEnhance.hidden = true;
                            showAlert('Script updated successfully!');
                        } else {
                            const error = await response.json();
                            showAlert('Failed to update script: ' + (error.detail || 'Unknown error'));
                        }
                    } catch (error) {
                        console.error('Error editing script:', error);
                        showAlert('An error occurred.');
                    } finally {
                        setLoading(newBtn, false);
                    }
                });
            }
        });
    }

    // Window globals for inline calls (e.g. copyScene)
    window.copyScene = function (index) {
        if (!currentScriptData) return;
        let scene;
        if (Array.isArray(currentScriptData)) scene = currentScriptData[index];
        else if (currentScriptData.scenes) scene = currentScriptData.scenes[index];
        else return;

        if (!scene) return;
        const textToCopy = `Visual: ${scene.visual}\nAudio: ${scene.audio}`;
        navigator.clipboard.writeText(textToCopy).then(() => showAlert('Scene copied to clipboard!')).catch(err => {
            console.error(err); showAlert('Failed to copy scene.');
        });
    };

    window.makeVideoFromScene = function (index) {
        if (!currentScriptData) return;
        let scene;
        let globalElements = null;
        if (Array.isArray(currentScriptData)) scene = currentScriptData[index];
        else if (currentScriptData.scenes) {
            scene = currentScriptData.scenes[index];
            globalElements = currentScriptData.global_elements;
        } else return;

        if (!scene) return;

        let prompt = "";
        if (globalElements) {
            prompt += "Global Context:\n";
            for (const [key, value] of Object.entries(globalElements)) {
                const title = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                prompt += `- ${title}: ${value}\n`;
            }
            prompt += "\n";
        }
        prompt += `Scene Visual: ${scene.visual}\nScene Audio: ${scene.audio}`;

        const videoPrompt = document.getElementById('bg-prompt'); // Assuming this ID from video creation section? Wait, line 3886 said 'video-prompt'.
        // In script.js line 3886: const videoPrompt = document.getElementById('video-prompt');
        // I need to confirm where 'video-prompt' is. It's likely in the Video Creation (top level) section.
        // But in this refactor I should probably dispatch an event or use a known ID.
        // I'll stick to 'video-prompt' as used in script.js, assuming HTML hasn't changed.
        const videoPromptInput = document.getElementById('video-prompt');
        if (videoPromptInput) videoPromptInput.value = prompt;

        // Trigger navigation
        const videoCreationLink = document.querySelector('.nav-links li[data-target="video-creation"]');
        if (videoCreationLink) videoCreationLink.click();

        if (videoPromptInput) {
            setTimeout(() => {
                videoPromptInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                videoPromptInput.focus();
            }, 300);
        }
    };
}

function renderScript(scriptData) {
    const vmScriptOutput = document.getElementById('vm-script-output');
    if (!vmScriptOutput) return;
    if (!scriptData) {
        vmScriptOutput.innerHTML = '<p>Invalid script format received.</p>';
        return;
    }

    let scenes = [];
    let globalElements = null;

    if (Array.isArray(scriptData)) scenes = scriptData;
    else if (scriptData.scenes) {
        scenes = scriptData.scenes;
        globalElements = scriptData.global_elements;
    } else {
        vmScriptOutput.innerHTML = '<p>Invalid script format received.</p>';
        return;
    }

    let html = '<div class="script-container">';

    if (globalElements) {
        html += '<div class="global-elements-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">';
        const elementIcons = {
            character: 'fa-user', visual_style: 'fa-eye', audio_vibe: 'fa-music', costume: 'fa-shirt',
            color_palette: 'fa-palette', set_design: 'fa-couch', objects_props: 'fa-box-open',
            filming_techniques: 'fa-video', voice: 'fa-microphone'
        };

        for (const [key, rawValue] of Object.entries(globalElements)) {
            const title = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const icon = elementIcons[key] || 'fa-star';
            let value = rawValue;
            if (typeof rawValue === 'object' && rawValue !== null) value = Object.entries(rawValue).map(([k, v]) => `${k}: ${v}`).join(', ');

            html += `
                <div class="global-element-card" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 1rem; position: relative;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                        <div style="display: flex; align-items: center; gap: 8px; color: var(--accent-color);">
                            <i class="fa-solid ${icon}"></i>
                            <strong style="font-size: 0.9rem; text-transform: uppercase;">${title}</strong>
                        </div>
                        <button class="icon-btn small-btn" onclick="navigator.clipboard.writeText('${String(value).replace(/'/g, "\\'")}')" title="Copy">
                            <i class="fa-regular fa-copy"></i>
                        </button>
                    </div>
                    <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.4;">${value}</p>
                </div>
            `;
        }
        html += '</div>';
    }

    scenes.forEach((scene, index) => {
        html += `
            <div class="script-scene">
                <div class="scene-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <span><i class="fa-solid fa-clapperboard"></i> Scene ${index + 1}</span>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="icon-btn small-btn" onclick="makeVideoFromScene(${index})" title="Make Video">
                            <i class="fa-solid fa-video"></i>
                        </button>
                        <button class="icon-btn small-btn" onclick="copyScene(${index})" title="Copy Scene">
                            <i class="fa-regular fa-copy"></i>
                        </button>
                    </div>
                </div>
                <div class="scene-content">
                    <div class="scene-col scene-visual">
                        <strong><i class="fa-solid fa-eye"></i> Visual</strong>
                        <p>${scene.visual}</p>
                    </div>
                    <div class="scene-col scene-audio">
                        <strong><i class="fa-solid fa-microphone-lines"></i> Audio</strong>
                        <p>${scene.audio}</p>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    vmScriptOutput.innerHTML = html;
}
