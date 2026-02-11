
import { projects, currentProjectId } from './project.js';
import { showAlert } from '../utils.js';

export let activeContextVersionName = null;
let currentVersionId = null;
let isEditingMetadata = false;
let currentEnhanceTargetId = null;

// Initialize Context Engineering Section
export function initContextEngineering() {
    // Bind listeners once
    const contextInputs = document.querySelectorAll('[id^="ctx-"]');
    contextInputs.forEach(input => {
        // Remove existing to avoid duplicates if init is called multiple times (though we try to avoid that)
        input.removeEventListener('input', updatePromptPreview);
        input.addEventListener('input', updatePromptPreview);
    });

    // Listen for state changes
    // We use a named handler to avoid adding multiple listeners if init is re-called
    window.removeEventListener('projectSelected', handleProjectSelected);
    window.addEventListener('projectSelected', handleProjectSelected);

    window.removeEventListener('sectionActivated', handleSectionActivated);
    window.addEventListener('sectionActivated', handleSectionActivated);

    // Bind buttons
    const btnGenerate = document.getElementById('btn-generate-context');
    if (btnGenerate) btnGenerate.addEventListener('click', generateContextFromGoal);

    const btnAnalyze = document.getElementById('btn-analyze-brand');
    if (btnAnalyze) btnAnalyze.addEventListener('click', analyzeBrand);

    const btnUpdateProject = document.getElementById('btn-update-project-context');
    if (btnUpdateProject) btnUpdateProject.addEventListener('click', updateProjectContext);

    const btnSaveVersion = document.getElementById('btn-save-version');
    if (btnSaveVersion) btnSaveVersion.addEventListener('click', openSaveNewVersionModal);

    const btnUpdateVersion = document.getElementById('btn-update-version');
    if (btnUpdateVersion) btnUpdateVersion.addEventListener('click', handleUpdateVersionContent);

    const btnEditVersionDetails = document.getElementById('btn-edit-version-details');
    if (btnEditVersionDetails) btnEditVersionDetails.addEventListener('click', openEditVersionMetadataModal);

    // Bind Context Actions
    document.querySelectorAll('.enhance-field-btn').forEach(btn => {
        btn.addEventListener('click', openEnhanceFieldModal);
    });

    const btnSynthesize = document.getElementById('btn-synthesize-context');
    if (btnSynthesize) btnSynthesize.addEventListener('click', synthesizeContext);

    const btnInsights = document.getElementById('btn-get-insights');
    if (btnInsights) btnInsights.addEventListener('click', openPromptInsightsModal);

    const btnCopy = document.getElementById('btn-copy-preview');
    if (btnCopy) btnCopy.addEventListener('click', copyContextPreview);

    // Bind Modal Actions
    const btnConfirmSave = document.getElementById('btn-confirm-save');
    if (btnConfirmSave) btnConfirmSave.addEventListener('click', handleModalSave);

    const closeSaveModal = document.getElementById('close-modal-save');
    if (closeSaveModal) closeSaveModal.addEventListener('click', () => {
        document.getElementById('modal-save-version').hidden = true;
    });

    const btnConfirmEnhance = document.getElementById('btn-confirm-enhance');
    if (btnConfirmEnhance) btnConfirmEnhance.addEventListener('click', handleEnhanceField);

    const closeEnhanceModal = document.getElementById('close-enhance-modal');
    if (closeEnhanceModal) closeEnhanceModal.addEventListener('click', () => {
        document.getElementById('modal-enhance-field').hidden = true;
    });

    const btnStartAnalysis = document.getElementById('btn-start-analysis');
    if (btnStartAnalysis) btnStartAnalysis.addEventListener('click', analyzePromptInsights);

    const closeInsightsModal = document.getElementById('close-modal-insights');
    if (closeInsightsModal) closeInsightsModal.addEventListener('click', () => {
        document.getElementById('modal-prompt-insights').hidden = true;
    });

    // Initial render
    renderContextView();
}

async function generateContextFromGoal() {
    const goalInput = document.getElementById('input-goal');
    if (!goalInput || !goalInput.value.trim()) {
        showAlert('Please enter a project goal.');
        return;
    }

    const btn = document.getElementById('btn-generate-context');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
    btn.disabled = true;

    try {
        const res = await fetch('/context/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goal: goalInput.value })
        });

        if (!res.ok) throw new Error('Generation failed');

        const data = await res.json();
        populateContextFields(data);
        showAlert('Context generated from goal successfully!');
    } catch (error) {
        console.error(error);
        showAlert('Error generating context.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function analyzeBrand() {
    const brandInput = document.getElementById('input-brand-name');
    if (!brandInput || !brandInput.value.trim()) {
        showAlert('Please enter a brand name.');
        return;
    }

    const btn = document.getElementById('btn-analyze-brand');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyzing...';
    btn.disabled = true;

    try {
        const res = await fetch('/context/analyze-brand', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brand_name: brandInput.value })
        });

        if (!res.ok) throw new Error('Analysis failed');

        const data = await res.json();
        populateContextFields(data);
        showAlert('Brand analysis complete!');
    } catch (error) {
        console.error(error);
        showAlert('Error analyzing brand.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function populateContextFields(data) {
    const map = {
        'brand_vibe': 'ctx-brand-vibe',
        'brand_lighting': 'ctx-brand-lighting',
        'brand_colors': 'ctx-brand-colors',
        'brand_subject': 'ctx-brand-subject',
        'project_vibe': 'ctx-project-vibe',
        'project_lighting': 'ctx-project-lighting',
        'project_colors': 'ctx-project-colors',
        'project_subject': 'ctx-project-subject',
        'context': 'ctx-overall'
    };

    for (const [key, elementId] of Object.entries(map)) {
        if (data[key]) {
            const el = document.getElementById(elementId);
            if (el) el.value = data[key];
        }
    }
    updatePromptPreview();
}

async function updateProjectContext() {
    if (!currentProjectId) {
        showAlert('No project selected.');
        return;
    }

    const btn = document.getElementById('btn-update-project-context');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';
    btn.disabled = true;

    const data = {
        brand_vibe: document.getElementById('ctx-brand-vibe').value,
        brand_lighting: document.getElementById('ctx-brand-lighting').value,
        brand_colors: document.getElementById('ctx-brand-colors').value,
        brand_subject: document.getElementById('ctx-brand-subject').value,
        project_vibe: document.getElementById('ctx-project-vibe').value,
        project_lighting: document.getElementById('ctx-project-lighting').value,
        project_colors: document.getElementById('ctx-project-colors').value,
        project_subject: document.getElementById('ctx-project-subject').value,
        context: document.getElementById('ctx-overall').value
    };

    try {
        // We need to fetch the current project first to preserve name and description
        // Or strictly update only context fields if backend supports PATCH or we send all data in PUT
        // The backend `update_project` expects a `ProjectCreate` schema which requires name.
        // Let's get the current project from our local list
        const project = projects.find(p => p.id === currentProjectId);
        if (!project) throw new Error('Project not found locally');

        const updatePayload = {
            name: project.name,
            description: project.description,
            ...data
        };

        const res = await fetch(`/projects/${currentProjectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload)
        });

        if (!res.ok) throw new Error('Update failed');

        const updatedProject = await res.json();

        // Update local project list
        const idx = projects.findIndex(p => p.id === currentProjectId);
        if (idx !== -1) projects[idx] = updatedProject;

        showAlert('Project context updated successfully!');
    } catch (error) {
        console.error(error);
        showAlert('Error updating project.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function openSaveNewVersionModal() {
    if (!currentProjectId) {
        showAlert('No project selected.');
        return;
    }
    isEditingMetadata = false;
    document.getElementById('modal-save-version').querySelector('h2').textContent = 'Save Context Version';
    document.getElementById('btn-confirm-save').textContent = 'Save';

    document.getElementById('save-version-name').value = '';
    document.getElementById('save-version-desc').value = '';
    document.getElementById('modal-save-version').hidden = false;
}

async function openEditVersionMetadataModal() {
    if (!currentVersionId) {
        showAlert('No version selected to edit.');
        return;
    }
    isEditingMetadata = true;
    const modal = document.getElementById('modal-save-version');
    modal.querySelector('h2').textContent = 'Edit Version Details';
    document.getElementById('btn-confirm-save').textContent = 'Update';

    // Fetch current details to be safe
    try {
        const res = await fetch(`/context/version/${currentVersionId}`);
        if (res.ok) {
            const version = await res.json();
            document.getElementById('save-version-name').value = version.name;
            document.getElementById('save-version-desc').value = version.description || '';
            modal.hidden = false;
        } else {
            showAlert('Failed to fetch version details');
        }
    } catch (e) {
        console.error(e);
        showAlert('Error loading version details');
    }
}

async function handleModalSave() {
    const name = document.getElementById('save-version-name').value;
    const desc = document.getElementById('save-version-desc').value;

    if (!name.trim()) {
        showAlert('Please enter a version name.');
        return;
    }

    const btn = document.getElementById('btn-confirm-save');
    const originalText = btn.innerText;
    btn.innerText = 'Processing...';
    btn.disabled = true;

    try {
        if (isEditingMetadata) {
            // Update Metadata Only
            const res = await fetch(`/context/versions/${currentVersionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description: desc })
            });

            if (!res.ok) throw new Error('Update failed');
            showAlert('Version details updated.');
            // Update active name if current
            activeContextVersionName = name;
        } else {
            // Create New Version
            const data = {
                project_id: currentProjectId,
                name: name,
                description: desc,
                brand_vibe: document.getElementById('ctx-brand-vibe').value,
                brand_lighting: document.getElementById('ctx-brand-lighting').value,
                brand_colors: document.getElementById('ctx-brand-colors').value,
                brand_subject: document.getElementById('ctx-brand-subject').value,
                project_vibe: document.getElementById('ctx-project-vibe').value,
                project_lighting: document.getElementById('ctx-project-lighting').value,
                project_colors: document.getElementById('ctx-project-colors').value,
                project_subject: document.getElementById('ctx-project-subject').value,
                context: document.getElementById('ctx-overall').value
            };

            const res = await fetch('/context/versions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!res.ok) throw new Error('Save failed');
            showAlert('Version saved successfully!');
        }

        document.getElementById('modal-save-version').hidden = true;
        loadContextVersions(currentProjectId); // Refresh list
    } catch (error) {
        console.error(error);
        showAlert('Error processing request.');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function handleUpdateVersionContent() {
    if (!currentVersionId) {
        // If no version selected, prompt to create new
        showAlert('No version selected. Opening "Save New Version".');
        openSaveNewVersionModal();
        return;
    }

    const btn = document.getElementById('btn-update-version');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    btn.disabled = true;

    const data = {
        brand_vibe: document.getElementById('ctx-brand-vibe').value,
        brand_lighting: document.getElementById('ctx-brand-lighting').value,
        brand_colors: document.getElementById('ctx-brand-colors').value,
        brand_subject: document.getElementById('ctx-brand-subject').value,
        project_vibe: document.getElementById('ctx-project-vibe').value,
        project_lighting: document.getElementById('ctx-project-lighting').value,
        project_colors: document.getElementById('ctx-project-colors').value,
        project_subject: document.getElementById('ctx-project-subject').value,
        context: document.getElementById('ctx-overall').value
    };

    try {
        const res = await fetch(`/context/versions/${currentVersionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!res.ok) throw new Error('Update failed');
        showAlert('Version content updated successfully!');
        loadContextVersions(currentProjectId); // Refresh to ensure consistency
    } catch (error) {
        console.error(error);
        showAlert('Error updating version content.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function handleProjectSelected(e) {
    console.log('Context received projectSelected:', e.detail);
    renderContextView();
}

function handleSectionActivated(e) {
    if (e.detail.targetId === 'context-engineering') {
        console.log('Context section activated');
        renderContextView();
    }
}

function renderContextView() {
    // IMPORTANT: re-read currentProjectId from the module binding
    // In ES modules, "currentProjectId" variable identifier is a live binding to the export.
    console.log('Rendering Context View. Current Project ID:', currentProjectId);

    const overlay = document.getElementById('ctx-blocked-overlay');
    const projectNameHeader = document.getElementById('ctx-current-project-name');

    if (!currentProjectId) {
        if (overlay) overlay.hidden = false;
        if (projectNameHeader) projectNameHeader.textContent = 'No Project Selected';
        // Clear editor fields
        clearContextFields();
        return;
    }

    if (overlay) overlay.hidden = true;

    // Find current project explicitly from the exported array
    const project = projects.find(p => p.id === currentProjectId);
    if (projectNameHeader) projectNameHeader.textContent = project ? project.name : 'Unknown Project';

    if (!project) {
        // Should not happen if currentProjectId is valid but safety check
        console.error('Project ID set but project not found in list');
        return;
    }

    const fields = [
        'brand_vibe', 'brand_lighting', 'brand_colors', 'brand_subject',
        'project_vibe', 'project_lighting', 'project_colors', 'project_subject',
        'context'
    ];

    fields.forEach(key => {
        const elementId = key === 'context' ? 'ctx-overall' : `ctx-${key.replace('_', '-')}`;
        const el = document.getElementById(elementId);
        if (el) el.value = project[key] || '';
    });

    updatePromptPreview();

    // Load versions
    loadContextVersions(currentProjectId, project);
}

// Helper: Load Versions
async function loadContextVersions(projectId, currentProject = null) {
    const versionList = document.getElementById('version-list');
    if (!versionList) return;
    versionList.innerHTML = '<p class="text-center"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</p>';

    try {
        const res = await fetch(`/context/versions/${projectId}?t=${new Date().getTime()}`);
        if (!res.ok) throw new Error('Failed to load versions');
        const versions = await res.json();

        versionList.innerHTML = '';
        if (versions.length === 0) {
            versionList.innerHTML = '<p class="text-muted text-center">No versions saved yet.</p>';
            return;
        }

        versions.forEach(v => {
            const item = document.createElement('div');
            // Check if this version matches current project data
            let isCurrent = false;
            if (currentProject) {
                const fields = [
                    'brand_vibe', 'brand_lighting', 'brand_colors', 'brand_subject',
                    'project_vibe', 'project_lighting', 'project_colors', 'project_subject',
                    'context'
                ];
                isCurrent = fields.every(field => {
                    const vVal = (v[field] || '').trim();
                    const pVal = (currentProject[field] || '').trim();
                    return vVal === pVal;
                });
            }

            if (isCurrent && !currentVersionId) {
                currentVersionId = v.id;
                activeContextVersionName = v.name;
            }

            const isActive = v.id === currentVersionId;
            item.className = `version-item ${isActive ? 'active' : ''}`;
            item.onclick = (e) => {
                if (e.target.closest('.delete-version-btn')) return;
                loadVersionIntoEditor(v);
            };

            const date = new Date(v.created_at).toLocaleString();

            item.innerHTML = `
                <div class="version-header">
                    <span class="version-name">
                        ${v.name}
                        ${isCurrent ? '<span class="badge" style="background: var(--accent-color); color: white; font-size: 0.7rem; margin-left: 8px;">Current</span>' : ''}
                    </span>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <span class="version-date">${date}</span>
                        <button class="delete-version-btn" data-id="${v.id}" style="background: none; border: none; color: #ff4d4d; cursor: pointer; padding: 2px;">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="version-desc">${v.description || 'No description'}</div>
            `;

            // Bind delete button
            const deleteBtn = item.querySelector('.delete-version-btn');
            if (deleteBtn) {
                deleteBtn.onclick = (e) => deleteVersion(v.id, e);
            }

            versionList.appendChild(item);
        });
    } catch (error) {
        console.error(error);
        versionList.innerHTML = '<p class="text-muted text-center" style="color: #ff4d4d;">Error loading history.</p>';
    }
}

function loadVersionIntoEditor(version) {
    currentVersionId = version.id;
    activeContextVersionName = version.name;

    document.querySelectorAll('.version-item').forEach(item => item.classList.remove('active'));
    // Re-render to update highlights properly or just reload
    const project = projects.find(p => p.id === currentProjectId);
    loadContextVersions(currentProjectId, project);

    const btnDeleteVersion = document.getElementById('btn-delete-version');
    if (btnDeleteVersion) btnDeleteVersion.hidden = false;

    const fields = [
        'brand_vibe', 'brand_lighting', 'brand_colors', 'brand_subject',
        'project_vibe', 'project_lighting', 'project_colors', 'project_subject',
        'context'
    ];

    fields.forEach(key => {
        const elementId = key === 'context' ? 'ctx-overall' : `ctx-${key.replace('_', '-')}`;
        const el = document.getElementById(elementId);
        if (el) el.value = version[key] || '';
    });
    updatePromptPreview();
}

export async function deleteVersion(versionId, event) {
    if (event) event.stopPropagation();
    if (!confirm('Are you sure you want to delete this version?')) return;

    try {
        const res = await fetch(`/context/versions/${versionId}`, { method: 'DELETE' });
        if (res.ok) {
            showAlert('Version deleted.');
            if (currentVersionId === versionId) {
                currentVersionId = null;
                const btnDeleteVersion = document.getElementById('btn-delete-version');
                if (btnDeleteVersion) btnDeleteVersion.hidden = true;
                clearContextFields();
            }
            loadContextVersions(currentProjectId);
        } else {
            showAlert('Failed to delete version.');
        }
    } catch (error) {
        console.error(error);
        showAlert('Error deleting version.');
    }
}

export function clearContextFields() {
    const inputs = document.querySelectorAll('[id^="ctx-"]');
    inputs.forEach(input => input.value = '');
    updatePromptPreview();
}

export function updatePromptPreview() {
    const container = document.getElementById('prompt-preview-container');
    if (!container) return;

    const brandFields = [
        { id: 'ctx-brand-vibe', label: 'Brand Vibe' },
        { id: 'ctx-brand-lighting', label: 'Brand Lighting' },
        { id: 'ctx-brand-colors', label: 'Brand Colors' },
        { id: 'ctx-brand-subject', label: 'Brand Subject' }
    ];
    const projectFields = [
        { id: 'ctx-project-vibe', label: 'Project Vibe' },
        { id: 'ctx-project-lighting', label: 'Project Lighting' },
        { id: 'ctx-project-colors', label: 'Project Colors' },
        { id: 'ctx-project-subject', label: 'Project Subject' }
    ];
    const overallField = { id: 'ctx-overall', label: 'Overall Context' };

    let html = '';
    let hasContent = false;

    const generateSection = (title, fields) => {
        let sectionHtml = '';
        let hasSectionContent = false;
        fields.forEach(field => {
            const el = document.getElementById(field.id);
            if (el && el.value.trim()) {
                hasSectionContent = true;
                sectionHtml += `
                <div class="preview-item">
                    <span class="preview-label">${field.label}</span>
                    <span class="preview-value">${el.value.trim()}</span>
                </div>`;
            }
        });
        if (hasSectionContent) {
            hasContent = true;
            return `<div class="preview-section"><div class="preview-section-title">${title}</div>${sectionHtml}</div>`;
        }
        return '';
    };

    html += generateSection('Brand Core', brandFields);
    html += generateSection('Project Specifics', projectFields);
    html += generateSection('Overall Context', [overallField]);

    if (!hasContent) {
        container.innerHTML = '<p class="text-muted text-center" style="padding: 20px;">Start editing context fields to see the preview.</p>';
    } else {
        container.innerHTML = html;
    }
}

// --- New Feature Implementations ---

function openEnhanceFieldModal(e) {
    const btn = e.target.closest('button');
    currentEnhanceTargetId = btn.dataset.target;

    document.getElementById('enhance-instructions').value = '';
    document.getElementById('modal-enhance-field').hidden = false;
}

async function handleEnhanceField() {
    if (!currentEnhanceTargetId) return;

    const targetInput = document.getElementById(currentEnhanceTargetId);
    if (!targetInput) return;

    const instructions = document.getElementById('enhance-instructions').value;
    const btn = document.getElementById('btn-confirm-enhance');
    const originalText = btn.innerHTML;

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enhancing...';
    btn.disabled = true;

    try {
        const res = await fetch('/context/enhance-field', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                current_value: targetInput.value,
                field_name: targetInput.previousElementSibling ? targetInput.previousElementSibling.innerText : 'Context Field',
                instructions: instructions
            })
        });

        if (res.ok) {
            const data = await res.json();
            targetInput.value = data.enhanced_text;
            updatePromptPreview();
            document.getElementById('modal-enhance-field').hidden = true;
            showAlert('Field enhanced successfully!');
        } else {
            showAlert('Failed to enhance field.');
        }
    } catch (e) {
        console.error(e);
        showAlert('Error enhancing field.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function synthesizeContext() {
    const btn = document.getElementById('btn-synthesize-context');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;

    const data = {
        brand_vibe: document.getElementById('ctx-brand-vibe').value,
        brand_lighting: document.getElementById('ctx-brand-lighting').value,
        brand_colors: document.getElementById('ctx-brand-colors').value,
        brand_subject: document.getElementById('ctx-brand-subject').value,
        project_vibe: document.getElementById('ctx-project-vibe').value,
        project_lighting: document.getElementById('ctx-project-lighting').value,
        project_colors: document.getElementById('ctx-project-colors').value,
        project_subject: document.getElementById('ctx-project-subject').value
    };

    try {
        const res = await fetch('/context/synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            const result = await res.json();
            document.getElementById('ctx-overall').value = result.synthesized_text;
            updatePromptPreview();
            showAlert('Context synthesized!');
        } else {
            showAlert('Failed to synthesize context.');
        }
    } catch (e) {
        console.error(e);
        showAlert('Error synthesizing context.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function openPromptInsightsModal() {
    document.getElementById('insights-initial-view').hidden = false;
    document.getElementById('insights-loading-view').hidden = true;
    document.getElementById('insights-results-view').hidden = true;
    document.getElementById('modal-prompt-insights').hidden = false;
}

async function analyzePromptInsights() {
    // Construct the prompt to analyze (from Overall Context or Preview)
    let promptText = document.getElementById('ctx-overall').value;
    if (!promptText.trim()) {
        // Fallback to constructing from preview logic if overall is empty
        const previewItems = document.querySelectorAll('.preview-item');
        promptText = Array.from(previewItems).map(item => {
            const label = item.querySelector('.preview-label').innerText;
            const value = item.querySelector('.preview-value').innerText;
            return `${label}: ${value}`;
        }).join('\n');
    }

    if (!promptText.trim()) {
        showAlert('No context data to analyze.');
        return;
    }

    document.getElementById('insights-initial-view').hidden = true;
    document.getElementById('insights-loading-view').hidden = false;

    try {
        const res = await fetch('/context/insight', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt_text: promptText })
        });

        if (res.ok) {
            const data = await res.json();
            renderInsightsResults(data);
        } else {
            showAlert('Failed to analyze prompt.');
            document.getElementById('insights-initial-view').hidden = false;
            document.getElementById('insights-loading-view').hidden = true;
        }
    } catch (e) {
        console.error(e);
        showAlert('Error during analysis.');
        document.getElementById('insights-initial-view').hidden = false;
        document.getElementById('insights-loading-view').hidden = true;
    }
}

function renderInsightsResults(data) {
    const resultsView = document.getElementById('insights-results-view');
    document.getElementById('insights-loading-view').hidden = true;
    resultsView.hidden = false;

    let tipsHtml = (data.suggestions || []).map(s => `
        <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin-bottom: 10px;">
            <div style="color: var(--accent-color); font-weight: 600; margin-bottom: 5px;">
                <i class="fa-solid fa-lightbulb"></i> ${s.suggestion}
            </div>
            <div style="color: var(--text-secondary); font-size: 0.9em;">${s.impact}</div>
        </div>
    `).join('');

    resultsView.innerHTML = `
        <div style="margin-bottom: 2rem;">
            <h3 style="color: var(--accent-color);">Creative Summary</h3>
            <p style="font-size: 1.1rem; line-height: 1.6;">${data.creative_summary}</p>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
            <div>
                <h4>Key Features</h4>
                <ul style="list-style-position: inside; color: var(--text-secondary); line-height: 1.6;">
                    ${(data.key_features || []).map(f => `<li>${f}</li>`).join('')}
                </ul>
            </div>
            <div>
                <h4>Style Analysis</h4>
                <p style="color: var(--text-secondary);">${data.style_explanation}</p>
            </div>
        </div>

        <div>
            <h4>Suggestions for Improvement</h4>
            ${tipsHtml}
        </div>
    `;
}

function copyContextPreview() {
    const container = document.getElementById('prompt-preview-container');
    if (!container || !container.innerText.trim()) {
        showAlert('Nothing to copy!');
        return;
    }

    // Format nicely
    let textToCopy = '';
    const sections = container.querySelectorAll('.preview-section');
    sections.forEach(section => {
        textToCopy += section.querySelector('.preview-section-title').innerText + '\n';
        section.querySelectorAll('.preview-item').forEach(item => {
            textToCopy += `${item.querySelector('.preview-label').innerText}: ${item.querySelector('.preview-value').innerText}\n`;
        });
        textToCopy += '\n';
    });

    navigator.clipboard.writeText(textToCopy.trim()).then(() => {
        const btn = document.getElementById('btn-copy-preview');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
        setTimeout(() => btn.innerHTML = originalHtml, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
        showAlert('Failed to copy to clipboard');
    });
}


// Accordion Helper
export function setupContextAccordion(btnId, contentId, checkboxesId, applyBtnId, contextOutputId, versionLabelId, clearBtnId = null) {
    const btn = document.getElementById(btnId);
    const content = document.getElementById(contentId);
    const applyBtn = document.getElementById(applyBtnId);
    const contextOutput = document.getElementById(contextOutputId);
    const versionLabel = document.getElementById(versionLabelId);
    const clearBtn = clearBtnId ? document.getElementById(clearBtnId) : null;

    if (btn && content) {
        btn.addEventListener('click', () => {
            const isHidden = content.hidden;
            content.hidden = !isHidden;
            const icon = btn.querySelector('.fa-chevron-down');
            if (icon) {
                icon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
            }

            if (isHidden && currentProjectId) {
                const project = projects.find(p => p.id === currentProjectId);
                if (project) {
                    renderContextAccordion(checkboxesId, project);
                }
            }
        });
    }

    if (applyBtn && contextOutput) {
        applyBtn.addEventListener('click', () => {
            const checkboxes = document.querySelectorAll(`#${checkboxesId} input[type="checkbox"]:checked`);
            if (checkboxes.length === 0) {
                showAlert('Please select at least one context element.');
                return;
            }

            let contextText = '';
            checkboxes.forEach(cb => {
                contextText += `${cb.dataset.label}: ${cb.value}.\n`;
            });

            contextOutput.value = contextText.trim();

            if (versionLabel) {
                if (versionLabel.type === 'checkbox') {
                    versionLabel.checked = true;
                    const label = document.querySelector(`label[for="${versionLabel.id}"]`);
                    if (label) {
                        label.innerText = "Context Applied";
                        label.style.color = "var(--accent-color)";
                    }
                } else {
                    versionLabel.innerText = "(Applied)";
                }
            }

            const originalText = applyBtn.innerText;
            applyBtn.innerText = 'Applied!';
            setTimeout(() => applyBtn.innerText = originalText, 1500);
        });
    }

    if (clearBtn && contextOutput) {
        clearBtn.addEventListener('click', () => {
            contextOutput.value = '';
            if (versionLabel) {
                if (versionLabel.type === 'checkbox') {
                    versionLabel.checked = false;
                    const label = document.querySelector(`label[for="${versionLabel.id}"]`);
                    if (label) {
                        label.innerText = "Apply Context";
                        label.style.color = "var(--text-color)";
                    }
                } else {
                    versionLabel.innerText = "";
                }
            }
        });
    }
}

export function renderContextAccordion(containerId, project) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!project) {
        container.innerHTML = '<p class="text-muted">Please select a project to use context features.</p>';
        return;
    }

    // ... (Existing Rendering Logic)
    // Simplified checks for brevity but retains functionality
    const controlsDiv = document.createElement('div');
    controlsDiv.style.cssText = 'margin-bottom: 1rem; display: flex; gap: 10px;';

    const createBtn = (text, onClick) => {
        const btn = document.createElement('button');
        btn.className = 'secondary-btn small-btn';
        btn.innerText = text;
        btn.onclick = onClick;
        return btn;
    };

    controlsDiv.appendChild(createBtn('Select All', () => container.querySelectorAll('input:not([disabled])').forEach(cb => cb.checked = true)));
    controlsDiv.appendChild(createBtn('Clear All', () => container.querySelectorAll('input').forEach(cb => cb.checked = false)));
    container.appendChild(controlsDiv);

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: grid; grid-template-columns: auto auto; gap: 40px; margin-bottom: 10px; justify-content: start;';
    const left = document.createElement('div'); left.style.cssText = 'display: flex; flex-direction: column; gap: 10px';
    const right = document.createElement('div'); right.style.cssText = 'display: flex; flex-direction: column; gap: 10px';
    wrapper.appendChild(left); wrapper.appendChild(right);
    container.appendChild(wrapper);

    const fields = [
        { key: 'brand_vibe', label: 'Brand Vibe' }, { key: 'brand_lighting', label: 'Brand Lighting' },
        { key: 'brand_colors', label: 'Brand Colors' }, { key: 'brand_subject', label: 'Brand Subject' },
        { key: 'project_vibe', label: 'Project Vibe' }, { key: 'project_lighting', label: 'Project Lighting' },
        { key: 'project_colors', label: 'Project Colors' }, { key: 'project_subject', label: 'Project Subject' },
        { key: 'context', label: 'Overall Context' }
    ];

    let hasData = false;
    fields.forEach(field => {
        const value = project[field.key];
        const hasValue = value && value.trim() !== '';
        if (hasValue) hasData = true;

        const div = document.createElement('div');
        div.className = 'checkbox-wrapper';
        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="ctx-${containerId}-${field.key}" value="${hasValue ? value : ''}" data-label="${field.label}" ${!hasValue ? 'disabled' : 'checked'}>
                <label for="ctx-${containerId}-${field.key}" style="font-size: 0.9rem; cursor: ${!hasValue ? 'not-allowed' : 'pointer'}; ${!hasValue ? 'text-decoration: line-through; opacity: 0.5;' : ''}">
                    <strong>${field.label}</strong>
                    ${field.key === 'context' ? '<small class="text-muted" style="margin-left: 5px;">(Overall)</small>' : ''}
                </label>
            </div>`;

        if (field.key.startsWith('brand_')) left.appendChild(div);
        else if (field.key.startsWith('project_')) right.appendChild(div);
        else { div.style.marginTop = '10px'; container.appendChild(div); }
    });

    if (!hasData) container.innerHTML = '<p class="text-muted">No context data available.</p>';
}
