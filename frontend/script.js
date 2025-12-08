document.addEventListener('DOMContentLoaded', () => {
    // Navigation
    // Navigation & Init
    const navLinks = document.querySelectorAll('.nav-links li');
    const sections = document.querySelectorAll('section');

    // --- Projects Globals ---
    let currentProjectId = null;
    let projects = [];
    let currentProjectAssets = []; // Store assets for lightbox
    let currentLightboxIndex = 0;

    // Define globally to ensure availability
    window.openAssetInfoModal = function (assetId) {
        const asset = currentProjectAssets.find(a => a.id === assetId);
        if (!asset) {
            console.error('Asset not found:', assetId);
            return;
        }

        const modal = document.getElementById('modal-asset-info');
        if (!modal) {
            console.error('Modal not found: modal-asset-info');
            return;
        }

        const img = document.getElementById('info-asset-img');
        const prompt = document.getElementById('info-prompt');
        const modelType = document.getElementById('info-model-type');
        const contextVersion = document.getElementById('info-context-version');

        if (img) img.src = asset.url;
        if (prompt) prompt.textContent = asset.prompt || 'No prompt saved.';
        if (modelType) modelType.textContent = asset.model_type || 'Unknown';
        if (contextVersion) contextVersion.textContent = asset.context_version || 'Unknown';

        modal.hidden = false;
    };

    // Check if we are on project.html
    // Check for deep link to project
    const urlParams = new URLSearchParams(window.location.search);
    const projectIdParam = urlParams.get('id');

    if (projectIdParam) {
        openProject(projectIdParam);
    } else {
        // Handle Hash Navigation
        if (window.location.hash) {
            const targetId = window.location.hash.substring(1);
            activateSection(targetId);
        } else {
            // Default to home
            activateSection('home');
        }

        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                const targetId = link.getAttribute('data-target');
                activateSection(targetId);
            });
        });
    }

    function activateSection(targetId) {
        const targetSection = document.getElementById(targetId);
        if (!targetSection) return;

        navLinks.forEach(l => l.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active-section'));

        const activeLink = document.querySelector(`.nav-links li[data-target="${targetId}"]`);
        if (activeLink) activeLink.classList.add('active');

        targetSection.classList.add('active-section');

        if (targetId === 'projects') {
            loadProjects();
        } else if (targetId === 'context-engineering') {
            initContextEngineering();
        }
    }

    function initContextEngineering() {
        const overlay = document.getElementById('ctx-blocked-overlay');
        const projectNameHeader = document.getElementById('ctx-current-project-name');

        if (!currentProjectId) {
            if (overlay) overlay.hidden = false;
            if (projectNameHeader) projectNameHeader.textContent = 'No Project Selected';
            return;
        }

        if (overlay) overlay.hidden = true;

        // Find current project name
        const project = projects.find(p => p.id === currentProjectId);
        if (projectNameHeader) projectNameHeader.textContent = project ? project.name : 'Unknown Project';

        // Populate editor with current project data
        if (project) {
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

            // Update preview if function exists
            if (typeof updatePromptPreview === 'function') {
                updatePromptPreview();
            }
        }

        // Load versions
        loadContextVersions(currentProjectId, project);
    }

    // Expose switchTab globally
    window.switchTab = function (tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('[id^="tab-"]').forEach(tab => tab.hidden = true);

        // Find button that triggered this (event.target might be icon inside button)
        // Since we can't easily get the button element from here without passing it, 
        // let's just find the button that calls this function with this arg
        // Or better, just use the event if available, but window.event is deprecated.
        // Let's just select by onclick attribute for simplicity or assume the user clicked the right one.
        // Actually, we can just select the button by text or order.
        // Simplest:
        const btn = document.querySelector(`button[onclick="switchTab('${tabName}')"]`);
        if (btn) btn.classList.add('active');

        const tab = document.getElementById(`tab-${tabName}`);
        if (tab) tab.hidden = false;
    };
    // Home Page Button
    const btnGoProjects = document.getElementById('btn-go-projects');
    if (btnGoProjects) {
        btnGoProjects.addEventListener('click', () => {
            // Trigger click on Projects nav link
            document.querySelector('li[data-target="projects"]').click();
        });
    }

    // --- Projects ---
    // --- Projects ---
    // Globals moved to top of file

    const projectsGrid = document.getElementById('projects-grid');
    const projectListView = document.getElementById('project-list-view');
    const projectDetailsView = document.getElementById('project-details-view');
    const btnCreateProject = document.getElementById('btn-create-project');
    const createProjectModal = document.getElementById('modal-create-project');
    const closeModal = document.querySelector('.close-modal');
    const btnSaveProject = document.getElementById('btn-save-project');
    const btnBackProjects = document.getElementById('btn-back-projects');
    const btnSelectProject = document.getElementById('btn-select-project');
    const sidebarProjectDisplay = document.getElementById('sidebar-project-display');
    const sidebarProjectName = document.getElementById('sidebar-project-name');

    // Edit Project Modal Elements
    const modalEditProject = document.getElementById('modal-edit-project');
    const closeModalEditProject = document.getElementById('close-modal-edit-project');
    const editProjectName = document.getElementById('edit-project-name');
    const editProjectDesc = document.getElementById('edit-project-desc');
    const editProjectContext = document.getElementById('edit-project-context');
    const btnSaveProjectChanges = document.getElementById('btn-save-project-changes');

    // --- Initialization ---

    // Helper functions for sidebar
    function showSidebarLoading() {
        if (!sidebarProjectDisplay) return;
        sidebarProjectDisplay.hidden = false;
        sidebarProjectDisplay.style.opacity = '0.7';
        sidebarProjectName.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
    }

    function updateSidebarProject(project = null) {
        if (!sidebarProjectDisplay) return;

        sidebarProjectDisplay.hidden = false;
        if (currentProjectId && project) {
            sidebarProjectName.textContent = project.name;
            sidebarProjectDisplay.style.opacity = '1';
            sidebarProjectDisplay.querySelector('i').style.color = 'var(--accent-color)';

            // Trigger flash animation
            sidebarProjectDisplay.classList.remove('flash-active');
            void sidebarProjectDisplay.offsetWidth; // Trigger reflow
            sidebarProjectDisplay.classList.add('flash-active');
        } else {
            sidebarProjectName.textContent = 'No project selected';
            sidebarProjectDisplay.style.opacity = '0.5';
            sidebarProjectDisplay.querySelector('i').style.color = 'var(--text-secondary)';
            sidebarProjectDisplay.classList.remove('flash-active');
        }
    }

    // Check for saved project immediately
    const savedProjectIdInit = localStorage.getItem('currentProjectId');
    if (savedProjectIdInit) {
        showSidebarLoading();
    }

    loadProjects();

    // Create Project Modal
    if (btnCreateProject) {
        console.log('btnCreateProject found');
        btnCreateProject.addEventListener('click', () => {
            console.log('btnCreateProject clicked');
            if (createProjectModal) {
                console.log('Opening modal');
                createProjectModal.hidden = false;
            } else {
                console.error('createProjectModal not found');
            }
        });
    } else {
        console.log('btnCreateProject NOT found');
    }

    if (closeModal) {
        closeModal.addEventListener('click', () => {
            createProjectModal.hidden = true;
        });
    }

    // Create Project Confirm
    const btnCreateProjectConfirm = document.getElementById('btn-create-project-confirm');
    const newProjectName = document.getElementById('new-project-name');
    const newProjectDesc = document.getElementById('new-project-desc');
    const newProjectContext = document.getElementById('new-project-context');

    if (btnCreateProjectConfirm) {
        btnCreateProjectConfirm.addEventListener('click', async () => {
            const name = newProjectName.value;
            const description = newProjectDesc.value;
            const context = newProjectContext.value;

            if (!name) {
                showAlert('Project name is required');
                return;
            }

            try {
                const response = await fetch('/projects/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, description, context })
                });

                if (response.ok) {
                    const project = await response.json();
                    createProjectModal.hidden = true;
                    showAlert('Project created successfully');

                    // Clear inputs
                    newProjectName.value = '';
                    newProjectDesc.value = '';
                    newProjectContext.value = '';

                    // Refresh logic depending on page
                    if (typeof loadProjects === 'function') {
                        loadProjects();
                    }

                    // If on project page, maybe redirect or just stay? 
                    // If on index, it refreshes list.
                } else {
                    showAlert('Failed to create project');
                }
            } catch (error) {
                console.error('Error:', error);
                showAlert('An error occurred');
            }
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === createProjectModal) {
            createProjectModal.hidden = true;
        }
    });

    if (btnSaveProject) {
        btnSaveProject.addEventListener('click', async () => {
            const name = document.getElementById('new-project-name').value;
            const desc = document.getElementById('new-project-desc').value;
            const context = document.getElementById('new-project-context').value;

            const brandVibe = document.getElementById('new-brand-vibe').value;
            const brandLighting = document.getElementById('new-brand-lighting').value;
            const brandColors = document.getElementById('new-brand-colors').value;
            const brandSubject = document.getElementById('new-brand-subject').value;

            const projectVibe = document.getElementById('new-project-vibe').value;
            const projectLighting = document.getElementById('new-project-lighting').value;
            const projectColors = document.getElementById('new-project-colors').value;
            const projectSubject = document.getElementById('new-project-subject').value;

            if (!name) {
                showAlert('Project name is required');
                return;
            }

            try {
                const response = await fetch('/projects/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: name,
                        description: desc,
                        context: context,
                        brand_vibe: brandVibe,
                        brand_lighting: brandLighting,
                        brand_colors: brandColors,
                        brand_subject: brandSubject,
                        project_vibe: projectVibe,
                        project_lighting: projectLighting,
                        project_colors: projectColors,
                        project_subject: projectSubject
                    })
                });

                if (response.ok) {
                    createProjectModal.hidden = true;
                    document.getElementById('new-project-name').value = '';
                    document.getElementById('new-project-desc').value = '';
                    document.getElementById('new-project-context').value = '';
                    loadProjects();
                } else {
                    showAlert('Failed to create project');
                }
            } catch (error) {
                console.error('Error:', error);
                showAlert('An error occurred');
            }
        });
    }

    async function loadProjects() {
        try {
            const response = await fetch('/projects/');
            if (response.ok) {
                projects = await response.json();
                renderProjects();

                // Check for saved project selection
                const savedProjectId = localStorage.getItem('currentProjectId');
                if (savedProjectId) showSidebarLoading();

                if (savedProjectId) {
                    const project = projects.find(p => p.id === parseInt(savedProjectId));
                    if (project) {
                        currentProjectId = project.id;
                        updateSidebarProject(project);
                        updateSelectButtonState(project.id);
                    } else {
                        // Saved project no longer exists
                        localStorage.removeItem('currentProjectId');
                        updateSidebarProject(null);
                    }
                } else {
                    updateSidebarProject(null);
                }
            }
        } catch (error) {
            console.error('Error loading projects:', error);
        }
    }

    function renderProjects() {
        if (!projectsGrid) return;
        projectsGrid.innerHTML = '';
        projects.forEach(project => {
            const card = document.createElement('div');
            card.className = 'project-card';

            const isSelected = currentProjectId === project.id;

            card.innerHTML = `
                <h3>${project.name}</h3>
                <p>${project.description || 'No description'}</p>
                <span class="badge" style="margin-top: auto; margin-bottom: 10px;">${new Date(project.created_at).toLocaleDateString()}</span>
                
                <div class="project-actions">
                    <button class="action-btn select-btn ${isSelected ? 'active' : ''}" data-id="${project.id}">
                        <i class="fa-solid ${isSelected ? 'fa-check' : 'fa-check-circle'}"></i> 
                        ${isSelected ? 'Selected' : 'Select'}
                    </button>
                    <button class="action-btn delete-btn" data-id="${project.id}">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                </div>
            `;

            // Handle card click (open project) - EXCLUDING actions
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.action-btn')) {
                    openProject(project.id);
                }
            });

            // Handle Select Click
            const selectBtn = card.querySelector('.select-btn');
            selectBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                selectProject(project);
                renderProjects(); // Re-render to update UI state
            });

            // Handle delete click
            const deleteBtn = card.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteProject(project.id, project.name);
            });

            projectsGrid.appendChild(card);
        });
    }

    async function deleteProject(projectId, projectName) {
        if (!confirm(`Are you sure you want to delete project "${projectName}"? This will delete all associated assets.`)) {
            return;
        }

        try {
            const response = await fetch(`/projects/${projectId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                if (currentProjectId === projectId) {
                    currentProjectId = null;
                    updateSidebarProject();
                }
                loadProjects();
            } else {
                showAlert('Failed to delete project');
            }
        } catch (error) {
            console.error('Error deleting project:', error);
            showAlert('An error occurred');
        }
    }

    async function openProject(projectId) {
        // Ensure we have the currentProjectId loaded from storage if not already set
        if (!currentProjectId) {
            currentProjectId = parseInt(projectId);
            localStorage.setItem('currentProjectId', currentProjectId);
        }

        // Switch to project details view
        activateSection('project-details-view');

        // Fetch details
        try {
            const response = await fetch(`/projects/${projectId}`);
            if (response.ok) {
                const project = await response.json();
                showProjectDetails(project);
                updateSidebarProject(project);
            }
        } catch (error) {
            console.error('Error fetching project details:', error);
        }
    }

    function showProjectDetails(project) {
        const projectDetails = document.getElementById('project-details'); // Assuming this element exists in project.html
        if (!projectDetails) return;

        projectDetails.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <h2>${project.name}</h2>
                    <p class="text-muted">${project.description || 'No description'}</p>
                </div>
                <button id="btn-edit-project-meta" class="secondary-btn small-btn">
                    <i class="fa-solid fa-pen"></i> Edit
                </button>
            </div>
            <div class="glass-panel" style="margin-top: 1rem; padding: 1.5rem;">
                
                <div class="metadata-columns">
                    <!-- Brand Core Section -->
                    <div class="metadata-section">
                        <h4>Brand Core</h4>
                        <div class="metadata-grid">
                            <div class="metadata-item">
                                <strong>Vibe</strong>
                                <span>${project.brand_vibe || '-'}</span>
                            </div>
                            <div class="metadata-item">
                                <strong>Lighting</strong>
                                <span>${project.brand_lighting || '-'}</span>
                            </div>
                            <div class="metadata-item">
                                <strong>Colors</strong>
                                <span>${project.brand_colors || '-'}</span>
                            </div>
                            <div class="metadata-item">
                                <strong>Subject</strong>
                                <span>${project.brand_subject || '-'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Project Specifics Section -->
                    <div class="metadata-section">
                        <h4>Project Specifics</h4>
                        <div class="metadata-grid">
                            <div class="metadata-item">
                                <strong>Vibe</strong>
                                <span>${project.project_vibe || '-'}</span>
                            </div>
                            <div class="metadata-item">
                                <strong>Lighting</strong>
                                <span>${project.project_lighting || '-'}</span>
                            </div>
                            <div class="metadata-item">
                                <strong>Colors</strong>
                                <span>${project.project_colors || '-'}</span>
                            </div>
                            <div class="metadata-item">
                                <strong>Subject</strong>
                                <span>${project.project_subject || '-'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Overall Context -->
                <div class="metadata-section" style="margin-bottom: 0;">
                    <h4>Overall Context / Guidelines</h4>
                    <div class="metadata-item" style="width: 100%;">
                        <span>${project.context || 'No context provided.'}</span>
                    </div>
                </div>
            </div>
            
            <button id="btn-select-project-dynamic" class="primary-btn" style="margin: 1rem 0;">Select Project</button>

            <!-- Grouped Assets -->
            <div class="asset-group">
                <h3><i class="fa-solid fa-wand-magic-sparkles"></i> Images</h3>
                <div class="assets-grid" id="project-assets-image"></div>
            </div>

            <div class="asset-group">
                <h3><i class="fa-solid fa-shirt"></i> Virtual Try-on</h3>
                <div class="assets-grid" id="project-assets-tryon"></div>
            </div>

            <div class="asset-group">
                <h3><i class="fa-solid fa-video"></i> Videos</h3>
                <div class="assets-grid" id="project-assets-video"></div>
            </div>
        `;

        // Store current project data for editing
        currentProjectData = project;

        // Add listener for Edit button
        const btnEdit = document.getElementById('btn-edit-project-meta');
        if (btnEdit) {
            btnEdit.addEventListener('click', () => {
                openEditProjectModal();
            });
        }

        // Handle Select Button (Dynamic)
        const btnSelectDynamic = document.getElementById('btn-select-project-dynamic');
        if (btnSelectDynamic) {
            // Update state immediately
            if (currentProjectId === project.id) {
                btnSelectDynamic.textContent = 'Deselect Project';
                btnSelectDynamic.style.background = 'var(--sidebar-bg)';
                btnSelectDynamic.style.border = '1px solid var(--accent-color)';
            } else {
                btnSelectDynamic.textContent = 'Select Project';
                btnSelectDynamic.style.background = 'var(--accent-color)';
                btnSelectDynamic.style.border = 'none';
            }

            btnSelectDynamic.onclick = () => {
                selectProject(project);
                // Re-update button state after selection change
                if (currentProjectId === project.id) {
                    btnSelectDynamic.textContent = 'Deselect Project';
                    btnSelectDynamic.style.background = 'var(--sidebar-bg)';
                    btnSelectDynamic.style.border = '1px solid var(--accent-color)';
                } else {
                    btnSelectDynamic.textContent = 'Select Project';
                    btnSelectDynamic.style.background = 'var(--accent-color)';
                    btnSelectDynamic.style.border = 'none';
                }
            };
        }

        loadProjectAssets(project.id);
    }

    function loadProjectAssets(projectId) {
        // Clear containers
        const containers = {
            'image': document.getElementById('project-assets-image'),
            'tryon': document.getElementById('project-assets-tryon'),
            'video': document.getElementById('project-assets-video')
        };

        // Check if containers exist (they should if showProjectDetails ran)
        if (!containers['image']) return;

        Object.values(containers).forEach(el => el.innerHTML = '');

        // Prioritize currentProjectData if it matches, as it's likely the most fresh (from openProject)
        let project = null;
        if (currentProjectData && currentProjectData.id === projectId) {
            project = currentProjectData;
        } else {
            project = projects.find(p => p.id === projectId);
        }

        if (!project || !project.assets || project.assets.length === 0) {
            // Optional: Show empty message in each or just leave empty
            Object.values(containers).forEach(el => el.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem;">No assets.</p>');
            return;
        }

        // Sort assets by ID desc (newest first)
        const sortedAssets = [...project.assets].sort((a, b) => b.id - a.id);

        // Store assets for lightbox navigation
        currentProjectAssets = sortedAssets;

        sortedAssets.forEach((asset, index) => {
            const assetCard = document.createElement('div');
            assetCard.className = 'asset-card';

            let content = '';
            if (asset.type === 'video') {
                content = `<video src="${asset.url}"></video>`; // No controls in thumb
            } else {
                content = `<img src="${asset.url}" alt="Asset">`;
            }

            assetCard.innerHTML = `
                ${content}
                <div class="asset-info">
                    <span class="asset-type">${asset.type}</span>
                    <div style="display: flex; gap: 5px;">
                        ${asset.type === 'image' ? `
                            <button class="info-btn small-btn" data-id="${asset.id}" title="Asset Info"><i class="fa-solid fa-info"></i></button>
                            <button class="edit-btn small-btn" data-id="${asset.id}" title="Edit Image"><i class="fa-solid fa-wand-magic-sparkles"></i></button>
                        ` : ''}
                        <button class="delete-btn small-delete-btn" data-id="${asset.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;

            // Handle info click
            const infoBtn = assetCard.querySelector('.info-btn');
            if (infoBtn) {
                infoBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (window.openAssetInfoModal) {
                        window.openAssetInfoModal(asset.id);
                    }
                });
            }

            // Handle delete click
            const deleteBtn = assetCard.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteAsset(asset.id, project.id);
            });

            // Handle edit click
            const editBtn = assetCard.querySelector('.edit-btn');
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openEditModal(asset.url);
                });
            }

            // Handle lightbox click (only if not clicking buttons)
            assetCard.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    openLightbox(index);
                }
            });

            // Append to appropriate container
            // Map backend types to container keys if needed. 
            // Backend types: 'image', 'video' (from creation), 'tryon' (maybe? let's check backend)
            // Backend currently sets type="image" for generated images.
            // Virtual tryon sets type="image" too? Let's check.

            // If type matches key directly:
            if (containers[asset.type]) {
                containers[asset.type].appendChild(assetCard);
            } else if (asset.type === 'image') {
                // Default images go to image container
                containers['image'].appendChild(assetCard);
            } else {
                // Fallback
                containers['image'].appendChild(assetCard);
            }
        });
    }

    if (btnBackProjects) {
        btnBackProjects.addEventListener('click', () => {
            activateSection('projects');
        });
    }

    async function deleteAsset(assetId, projectId) {
        if (!confirm('Are you sure you want to delete this asset?')) {
            return;
        }

        try {
            const response = await fetch(`/ assets / ${assetId} `, {
                method: 'DELETE'
            });

            if (response.ok) {
                // Refresh project details
                openProject(projectId);
            } else {
                showAlert('Failed to delete asset');
            }
        } catch (error) {
            console.error('Error deleting asset:', error);
            showAlert('An error occurred');
        }
    }

    function selectProject(project) {
        if (typeof project === 'number') { // If projectId is passed directly
            project = projects.find(p => p.id === project);
            if (!project) return;
        }

        if (currentProjectId === project.id) {
            // Deselect
            currentProjectId = null;
            localStorage.removeItem('currentProjectId');
        } else {
            currentProjectId = project.id;
            localStorage.setItem('currentProjectId', project.id);
        }
        updateSelectButtonState(project.id);
        updateSidebarProject(project);
    }

    function updateSelectButtonState(projectId) {
        if (!btnSelectProject) return;

        if (currentProjectId === projectId) {
            btnSelectProject.textContent = 'Deselect Project';
            btnSelectProject.style.background = 'var(--sidebar-bg)';
            btnSelectProject.style.border = '1px solid var(--accent-color)';
        } else {
            btnSelectProject.textContent = 'Select Project';
            btnSelectProject.style.background = 'var(--accent-color)';
            btnSelectProject.style.border = 'none';
        }
    }

    function updateSidebarProject(project = null) {
        if (!sidebarProjectDisplay) return;
        sidebarProjectDisplay.hidden = false;
        if (currentProjectId && project) {
            sidebarProjectName.textContent = project.name;
            sidebarProjectDisplay.style.opacity = '1';
            sidebarProjectDisplay.querySelector('i').style.color = 'var(--accent-color)';

            // Trigger flash animation
            sidebarProjectDisplay.classList.remove('flash-active');
            void sidebarProjectDisplay.offsetWidth; // Trigger reflow
            sidebarProjectDisplay.classList.add('flash-active');
        } else {
            sidebarProjectName.textContent = 'No project selected';
            sidebarProjectDisplay.style.opacity = '0.5';
            sidebarProjectDisplay.querySelector('i').style.color = 'var(--text-secondary)';
            sidebarProjectDisplay.classList.remove('flash-active');
        }
    }


    // --- Alert Modal ---
    const alertModal = document.getElementById('alert-modal');
    const alertMessage = document.getElementById('alert-message');
    const btnAlertOk = document.getElementById('btn-alert-ok');

    if (btnAlertOk) {
        btnAlertOk.addEventListener('click', () => {
            if (alertModal) alertModal.hidden = true;
        });
    }

    // Make globally accessible
    window.closeAlertModal = function () {
        if (alertModal) alertModal.hidden = true;
    };

    function showAlert(message) {
        if (alertMessage) alertMessage.textContent = message;
        if (alertModal) alertModal.hidden = false;
    }

    // --- Version Management ---
    let currentVersionId = null;
    const btnDeleteVersion = document.getElementById('btn-delete-version');

    // loadContextVersions is now defined earlier with delete logic
    async function loadContextVersions(projectId, currentProject = null) {
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
                const isSelected = v.id === currentVersionId;

                // Check if this version matches the current project state
                let isCurrent = false;
                if (currentProject) {
                    // Compare relevant fields
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
                    currentVersionId = v.id; // Set global current version ID if it matches and no selection exists
                    window.activeContextVersionName = v.name;
                }

                const isActive = v.id === currentVersionId;
                item.className = `version-item ${isActive ? 'active' : ''}`;
                item.onclick = (e) => {
                    // Prevent triggering if delete button clicked
                    if (e.target.closest('.delete-version-btn')) return;
                    loadVersionIntoEditor(v);
                };

                // Format date
                const date = new Date(v.created_at).toLocaleString();

                item.innerHTML = `
                <div class="version-header">
                        <span class="version-name">
                            ${v.name}
                            ${isCurrent ? '<span class="badge" style="background: var(--accent-color); color: white; font-size: 0.7rem; margin-left: 8px;">Current</span>' : ''}
                        </span>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <span class="version-date">${date}</span>
                            <button class="delete-version-btn" onclick="deleteVersion(${v.id}, event)" style="background: none; border: none; color: #ff4d4d; cursor: pointer; padding: 2px;">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                <div class="version-desc">${v.description || 'No description'}</div>
            `;
                versionList.appendChild(item);
            });
        } catch (error) {
            console.error(error);
            versionList.innerHTML = '<p class="text-muted text-center" style="color: #ff4d4d;">Error loading history.</p>';
        }
    }
    function loadVersionIntoEditor(version) {
        currentVersionId = version.id;
        window.activeContextVersionName = version.name;

        // Update UI highlighting
        document.querySelectorAll('.version-item').forEach(item => item.classList.remove('active'));
        // Find the item that corresponds to this version and add active class
        // We can't easily find it without re-rendering or adding IDs to elements, 
        // but we can just re-render or iterate. Re-rendering is safest but slower.
        // Let's iterate based on text content or just re-render the list to be clean.
        const project = projects.find(p => p.id === currentProjectId);
        loadContextVersions(currentProjectId, project); // Re-render to update highlight

        // Show delete button in toolbar
        if (btnDeleteVersion) btnDeleteVersion.hidden = false;

        // Populate fields
        const fields = [
            'brand_vibe', 'brand_lighting', 'brand_colors', 'brand_subject',
            'project_vibe', 'project_lighting', 'project_colors', 'project_subject',
            'context'
        ];

        fields.forEach(key => {
            const elementId = key === 'context' ? 'ctx-overall' : `ctx - ${key.replace('_', '-')} `;
            const el = document.getElementById(elementId);
            if (el) el.value = version[key] || '';
        });
        updatePromptPreview();
    }

    // Expose deleteVersion globally for the list items
    window.deleteVersion = async function (versionId, event) {
        if (event) event.stopPropagation();

        if (!confirm('Are you sure you want to delete this version?')) return;

        try {
            const res = await fetch(`/ context / versions / ${versionId} `, {
                method: 'DELETE'
            });

            if (res.ok) {
                showAlert('Version deleted.');
                if (currentVersionId === versionId) {
                    currentVersionId = null;
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
    };

    // Top Delete Button Logic
    if (btnDeleteVersion) {
        btnDeleteVersion.addEventListener('click', () => {
            if (currentVersionId) {
                window.deleteVersion(currentVersionId);
            }
        });
    }

    // --- Edit Project Logic ---
    if (closeModalEditProject) {
        closeModalEditProject.addEventListener('click', () => {
            modalEditProject.hidden = true;
        });
    }

    function openEditProjectModal() {
        if (!currentProjectData) return;
        editProjectName.value = currentProjectData.name;
        editProjectDesc.value = currentProjectData.description || '';
        editProjectContext.value = currentProjectData.context || '';

        document.getElementById('edit-brand-vibe').value = currentProjectData.brand_vibe || '';
        document.getElementById('edit-brand-lighting').value = currentProjectData.brand_lighting || '';
        document.getElementById('edit-brand-colors').value = currentProjectData.brand_colors || '';
        document.getElementById('edit-brand-subject').value = currentProjectData.brand_subject || '';

        document.getElementById('edit-project-vibe').value = currentProjectData.project_vibe || '';
        document.getElementById('edit-project-lighting').value = currentProjectData.project_lighting || '';
        document.getElementById('edit-project-colors').value = currentProjectData.project_colors || '';
        document.getElementById('edit-project-subject').value = currentProjectData.project_subject || '';

        modalEditProject.hidden = false;
    }

    if (btnSaveProjectChanges) {
        btnSaveProjectChanges.addEventListener('click', async () => {
            if (!currentProjectData || !currentProjectData.id) return;

            const name = document.getElementById('edit-project-name').value;
            const desc = document.getElementById('edit-project-desc').value;
            const context = document.getElementById('edit-project-context').value;

            const brandVibe = document.getElementById('edit-brand-vibe').value;
            const brandLighting = document.getElementById('edit-brand-lighting').value;
            const brandColors = document.getElementById('edit-brand-colors').value;
            const brandSubject = document.getElementById('edit-brand-subject').value;

            const projectVibe = document.getElementById('edit-project-vibe').value;
            const projectLighting = document.getElementById('edit-project-lighting').value;
            const projectColors = document.getElementById('edit-project-colors').value;
            const projectSubject = document.getElementById('edit-project-subject').value;

            if (!name) {
                showAlert('Project name is required');
                return;
            }

            try {
                const response = await fetch(`/ projects / ${currentProjectData.id} `, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: name,
                        description: desc,
                        context: context,
                        brand_vibe: brandVibe,
                        brand_lighting: brandLighting,
                        brand_colors: brandColors,
                        brand_subject: brandSubject,
                        project_vibe: projectVibe,
                        project_lighting: projectLighting,
                        project_colors: projectColors,
                        project_subject: projectSubject
                    })
                });

                if (response.ok) {
                    const updatedProject = await response.json();
                    currentProjectData = updatedProject; // Update local data
                    modalEditProject.hidden = true;
                    showAlert('Project updated successfully');
                    loadProjects(); // Refresh projects list (e.g., for sidebar)
                    showProjectDetails(updatedProject); // Refresh details view
                    updateSidebarProject(updatedProject); // Update sidebar if selected
                } else {
                    showAlert('Failed to update project');
                }
            } catch (error) {
                console.error('Error:', error);
                showAlert('An error occurred');
            }
        });
    }

    // --- Image Creation ---
    const btnGenerateImg = document.getElementById('btn-generate-img');
    const btnResetImg = document.getElementById('btn-reset-img');
    const imgPrompt = document.getElementById('img-prompt');
    const imgStyle = document.getElementById('img-style');

    // Inputs
    const imgFilesInput = document.getElementById('img-files');
    const imgUploadArea = document.getElementById('img-upload-area');
    const imgPreviewList = document.getElementById('img-preview-list');

    const imgStyleFilesInput = document.getElementById('img-style-files');
    const imgStyleUploadArea = document.getElementById('img-style-upload-area');
    const imgStylePreviewList = document.getElementById('img-style-preview-list');

    const imgProductFilesInput = document.getElementById('img-product-files');
    const imgProductUploadArea = document.getElementById('img-product-upload-area');
    const imgProductPreviewList = document.getElementById('img-product-preview-list');

    const imgSceneFilesInput = document.getElementById('img-scene-files');
    const imgSceneUploadArea = document.getElementById('img-scene-upload-area');
    const imgScenePreviewList = document.getElementById('img-scene-preview-list');

    const imgResultContainer = document.getElementById('img-result-container');

    // Modal Controls
    const modalMap = {
        'btn-open-style': 'modal-style',
        'btn-open-product': 'modal-product',
        'btn-open-style': 'modal-style',
        'btn-open-product': 'modal-product',
        'btn-open-scene': 'modal-scene'
    };

    Object.keys(modalMap).forEach(btnId => {
        const btn = document.getElementById(btnId);
        const modalId = modalMap[btnId];
        if (btn) {
            btn.addEventListener('click', () => {
                document.getElementById(modalId).hidden = false;
            });
        }
    });

    document.querySelectorAll('.close-ref-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.target.dataset.target || e.target.closest('.modal').id;
            document.getElementById(targetId).hidden = true;
        });
    });

    // Close modals on outside click
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.hidden = true;
        }
    });

    // File Upload Handling (Image Creation)
    function setupFileUpload(uploadArea, input, previewList, badgeId) {
        if (uploadArea) {
            uploadArea.addEventListener('click', () => input.click());
            input.addEventListener('change', (e) => handleImgFilesSelect(e, previewList, uploadArea, badgeId));
        }
    }

    setupFileUpload(imgUploadArea, imgFilesInput, imgPreviewList, 'badge-general');
    setupFileUpload(imgStyleUploadArea, imgStyleFilesInput, imgStylePreviewList, 'badge-style');
    setupFileUpload(imgProductUploadArea, imgProductFilesInput, imgProductPreviewList, 'badge-product');
    setupFileUpload(imgSceneUploadArea, imgSceneFilesInput, imgScenePreviewList, 'badge-scene');

    function handleImgFilesSelect(e, previewList, uploadArea, badgeId) {
        const files = Array.from(e.target.files);
        previewList.innerHTML = '';
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.classList.add('preview-thumb'); // Add CSS for this
                previewList.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
        uploadArea.querySelector('span').textContent = `${files.length} images selected`;

        // Update Badge
        const badge = document.getElementById(badgeId);
        if (badge) {
            badge.textContent = files.length;
            badge.hidden = files.length === 0;
        }
    }

    if (btnResetImg) {
        btnResetImg.addEventListener('click', () => {
            // Clear Prompt & Style
            imgPrompt.value = '';
            imgStyle.value = '';

            // Clear Files & Previews & Badges
            const resetInput = (input, previewList, uploadArea, badgeId, defaultText) => {
                input.value = ''; // Clear file input
                previewList.innerHTML = ''; // Clear preview
                if (uploadArea) uploadArea.querySelector('span').textContent = defaultText;
                const badge = document.getElementById(badgeId);
                if (badge) {
                    badge.textContent = '0';
                    badge.hidden = true;
                }
            };

            resetInput(imgFilesInput, imgPreviewList, imgUploadArea, 'badge-general', 'Drop images or click to upload');
            resetInput(imgStyleFilesInput, imgStylePreviewList, imgStyleUploadArea, 'badge-style', 'Upload Style Image');
            resetInput(imgProductFilesInput, imgProductPreviewList, imgProductUploadArea, 'badge-product', 'Upload Product Image');
            resetInput(imgSceneFilesInput, imgScenePreviewList, imgSceneUploadArea, 'badge-scene', 'Upload Scene Image');

            // Clear Result
            imgResultContainer.innerHTML = `
                <i class="fa-regular fa-image"></i>
                <p>Generated image will appear here</p>
            `;
        });
    }

    // --- Image Editing Page Logic ---
    const editUploadArea = document.getElementById('edit-upload-area');
    const editFileInput = document.getElementById('edit-file-input');
    const editPreviewContainer = document.getElementById('edit-preview-container');
    const editPrompt = document.getElementById('edit-prompt');
    const btnGenerateEditPage = document.getElementById('btn-generate-edit-page');
    const btnResetEditPage = document.getElementById('btn-reset-edit-page');
    const editResultContainer = document.getElementById('edit-result-container');

    // Reference Images for Edit
    const editRefUploadArea = document.getElementById('edit-ref-upload-area');
    const editRefFileInput = document.getElementById('edit-ref-file-input');
    const editRefPreviewList = document.getElementById('edit-ref-preview-list');

    let currentEditImageFile = null;
    let editReferenceFiles = [];

    if (editUploadArea) {
        editUploadArea.addEventListener('click', () => editFileInput.click());
        editUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            editUploadArea.style.borderColor = 'var(--accent-color)';
        });
        editUploadArea.addEventListener('dragleave', () => {
            editUploadArea.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        });
        editUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            editUploadArea.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            if (e.dataTransfer.files.length > 0) {
                handleEditFileSelect(e.dataTransfer.files[0]);
            }
        });

        editFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleEditFileSelect(e.target.files[0]);
            }
        });
    }

    function handleEditFileSelect(file) {
        currentEditImageFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            editPreviewContainer.innerHTML = `<img src="${e.target.result}" class="preview-img" style="max-height: 200px;">`;
            editUploadArea.querySelector('span').textContent = file.name;
        };
        reader.readAsDataURL(file);
    }

    if (btnResetEditPage) {
        btnResetEditPage.addEventListener('click', () => {
            currentEditImageFile = null;
            editFileInput.value = '';
            editPreviewContainer.innerHTML = '';
            editUploadArea.querySelector('span').textContent = 'Drop image or click to upload';
            editPrompt.value = '';
            editResultContainer.innerHTML = `
                <i class="fa-regular fa-image"></i>
                <p>Edited image will appear here</p>
            `;
            // Clear references
            editReferenceFiles = [];
            if (editRefFileInput) editRefFileInput.value = '';
            if (editRefPreviewList) editRefPreviewList.innerHTML = '';
            if (editRefUploadArea) editRefUploadArea.querySelector('span').textContent = 'Add reference images';
        });
    }

    if (editRefUploadArea) {
        editRefUploadArea.addEventListener('click', () => editRefFileInput.click());
        editRefFileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            editReferenceFiles = files; // Replace or append? Let's replace for simplicity or append? 
            // Let's just replace for now to match other logic, or append if we want multiple batches.
            // The prompt says "Add reference images", usually implies appending, but standard file input replaces.
            // Let's stick to standard behavior (replace) for consistency with other inputs.

            editRefPreviewList.innerHTML = '';
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const img = document.createElement('img');
                    img.src = ev.target.result;
                    img.classList.add('preview-thumb');
                    editRefPreviewList.appendChild(img);
                };
                reader.readAsDataURL(file);
            });
            editRefUploadArea.querySelector('span').textContent = `${files.length} references selected`;
        });
    }

    if (btnGenerateEditPage) {
        btnGenerateEditPage.addEventListener('click', async () => {
            if (!currentEditImageFile) {
                showAlert('Please upload an image to edit');
                return;
            }
            if (!editPrompt.value) {
                showAlert('Please enter an edit instruction');
                return;
            }

            setLoading(btnGenerateEditPage, true);

            try {
                const formData = new FormData();
                formData.append('image', currentEditImageFile);
                formData.append('instruction', editPrompt.value);

                // Model Selection
                const modelToggle = document.getElementById('model-toggle-edit-page');
                const modelName = modelToggle && modelToggle.checked ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
                formData.append('model_name', modelName);

                const response = await fetch('/image-creation/edit', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();

                if (response.ok) {
                    // data.image_data is base64
                    const newImageSrc = `data: image / png; base64, ${data.image_data} `;

                    // Display result
                    editResultContainer.innerHTML = `
                <img src="${newImageSrc}" alt="Edited Image" style="max-height: 60vh; object-fit: contain;">
                    <div class="project-actions" style="justify-content: center; margin-top: 1rem; gap: 10px;">
                        <button class="secondary-btn" onclick="openEditModal('${newImageSrc}')">
                            <i class="fa-solid fa-wand-magic-sparkles"></i> Edit
                        </button>
                        <button class="secondary-btn" onclick="saveImageToProject('${newImageSrc}', this)">
                            <i class="fa-regular fa-floppy-disk"></i> Save to Project
                        </button>
                        <button class="secondary-btn" onclick="downloadImage('${newImageSrc}', 'edited_image.png')">
                            <i class="fa-solid fa-download"></i> Download
                        </button>
                    </div>
            `;
                } else {
                    showAlert('Error: ' + data.detail);
                }
            } catch (error) {
                console.error('Error:', error);
                showAlert('An error occurred');
            } finally {
                setLoading(btnGenerateEditPage, false);
            }
        });
    }

    // Helper for downloading (can be global or here)
    window.downloadImage = (dataUrl, filename) => {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- Edit Image Modal Logic ---
    const modalEdit = document.getElementById('modal-edit');
    const closeEditModal = document.getElementById('close-edit-modal');
    const editMainImg = document.getElementById('edit-main-img');
    const editInstruction = document.getElementById('edit-instruction');
    const btnGenerateEdit = document.getElementById('btn-generate-edit');
    const btnSaveEdit = document.getElementById('btn-save-edit');
    const editHistoryList = document.getElementById('edit-history-list');

    let currentEditImageSrc = null; // Source of the image currently being edited
    let editHistory = []; // Array of image sources

    if (closeEditModal) {
        closeEditModal.addEventListener('click', () => {
            modalEdit.hidden = true;
        });
    }

    // Helper for opening edit modal (global)
    window.openEditModal = (imageSrc) => {
        currentEditImageSrc = imageSrc;
        editMainImg.src = imageSrc;
        editInstruction.value = '';
        document.getElementById('edit-style-modal').value = '';
        editHistory = [imageSrc];
        renderEditHistory();
        modalEdit.hidden = false;
    };

    function renderEditHistory() {
        editHistoryList.innerHTML = '';
        editHistory.forEach((src, index) => {
            const thumb = document.createElement('img');
            thumb.src = src;
            thumb.classList.add('preview-thumb');
            thumb.style.cursor = 'pointer';
            thumb.style.border = src === currentEditImageSrc ? '2px solid var(--accent-color)' : 'none';
            thumb.onclick = () => {
                currentEditImageSrc = src;
                editMainImg.src = src;
                renderEditHistory();
            };
            editHistoryList.appendChild(thumb);
        });
    }

    if (btnGenerateEdit) {
        btnGenerateEdit.addEventListener('click', async () => {
            if (!currentEditImageSrc) return;
            const instruction = editInstruction.value;
            if (!instruction) {
                showAlert('Please enter an edit instruction');
                return;
            }

            setLoading(btnGenerateEdit, true);

            try {
                const formData = new FormData();
                formData.append('instruction', instruction);

                // Style Selection
                const style = document.getElementById('edit-style-modal').value;
                if (style) formData.append('style', style);

                // Model Selection
                const modelToggle = document.getElementById('model-toggle-edit-modal');
                const modelName = modelToggle && modelToggle.checked ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
                formData.append('model_name', modelName);

                // Check if currentEditImageSrc is a URL or Base64
                if (currentEditImageSrc.startsWith('http')) {
                    // It's a URL (e.g. from GCS), send as image_url
                    formData.append('image_url', currentEditImageSrc);
                } else {
                    // It's likely base64 or blob url (from local upload or previous edit)
                    // We need to convert it to a file
                    const res = await fetch(currentEditImageSrc);
                    const blob = await res.blob();
                    const file = new File([blob], "image_to_edit.png", { type: "image/png" });
                    formData.append('image', file);
                }

                // Append Reference Images
                if (editReferenceFiles && editReferenceFiles.length > 0) {
                    editReferenceFiles.forEach(file => {
                        formData.append('reference_images', file);
                    });
                }

                const response = await fetch('/image-creation/edit', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();

                if (response.ok) {
                    const newImageSrc = `data: image / png; base64, ${data.image_data} `;
                    currentEditImageSrc = newImageSrc;
                    editMainImg.src = newImageSrc;
                    editHistory.unshift(newImageSrc); // Add to top
                    renderEditHistory();
                    editInstruction.value = ''; // Clear instruction
                    document.getElementById('edit-style-modal').value = ''; // Clear style
                } else {
                    showAlert('Error: ' + data.detail);
                }
            } catch (error) {
                console.error('Error editing image:', error);
                showAlert('An error occurred');
            } finally {
                setLoading(btnGenerateEdit, false);
            }
        });
    }

    if (btnSaveEdit) {
        btnSaveEdit.addEventListener('click', () => {
            if (currentEditImageSrc) {
                saveImageToProject(currentEditImageSrc, btnSaveEdit);
            }
        });
    }

    window.saveImageToProject = async (imageSrc, btnElement = null) => {
        if (!currentProjectId) {
            showAlert('Please select a project first.');
            return;
        }

        // Set loading state
        let originalText = '';
        if (btnElement) {
            originalText = btnElement.innerHTML;
            btnElement.disabled = true;
            btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        }

        try {
            const payload = {
                project_id: currentProjectId,
                type: 'image'
            };

            // Capture Metadata
            // Model Type
            const modelToggle = document.getElementById('model-toggle-img');
            // If toggle is checked (Speed), we might want to save "Speed". If unchecked (Quality), "Quality".
            // Wait, let's check the toggle logic. 
            // In generate: checked = gemini-3-pro-image-preview (Speed?), unchecked = gemini-2.5-flash-image (Quality?)
            // The UI says "Speed" on left, "Quality" on right? Or toggle label?
            // HTML: <span class="toggle-label">Speed</span> <input type="checkbox"> <span class="toggle-label">Quality</span>
            // Usually checkbox unchecked = left, checked = right.
            // So unchecked = Speed, checked = Quality? 
            // Let's check CSS or assume standard.
            // Actually, let's just save the model name or a friendly string.
            // The user asked for "Speed or Quality".
            // Let's look at how it's sent in generate:
            // const modelName = modelToggle && modelToggle.checked ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
            // If checked is Quality (assuming right side), then gemini-3-pro is Quality? 
            // Actually, usually Flash is faster (Speed) and Pro is better (Quality).
            // But let's check the HTML again.
            // <span class="toggle-label">Speed</span> <switch> <span class="toggle-label">Quality</span>
            // If unchecked, it's usually "off" or left. So Speed.
            // If checked, it's "on" or right. So Quality.
            // So unchecked = Speed = gemini-2.5-flash-image?
            // In generate: checked ? 'gemini-3-pro...' : 'gemini-2.5-flash...'
            // So checked = Quality = Gemini 3 Pro. Unchecked = Speed = Gemini 2.5 Flash.
            // Correct.

            const isQuality = modelToggle && modelToggle.checked;
            payload.model_type = isQuality ? 'Quality' : 'Speed';

            // Capture Prompt
            let prompt = '';
            const btnSaveEdit = document.getElementById('btn-save-edit');

            if (btnElement === btnSaveEdit) {
                // Saving from Edit Modal
                const editInstruction = document.getElementById('edit-instruction');
                prompt = editInstruction ? editInstruction.value : '';
                if (!prompt) prompt = "Edited Image"; // Fallback
            } else {
                // Saving from Image Creation (default)
                const imgPrompt = document.getElementById('img-prompt');
                prompt = imgPrompt ? imgPrompt.value : '';
            }
            payload.prompt = prompt;

            // Context Version
            // We need to know which context version was used. 
            // This is tricky because the user might have changed it.
            // But usually we just take the currently active one if we are tracking it.
            // In `initContextEngineering`, we load versions.
            // We don't seem to have a global `currentContextVersionName` variable easily accessible 
            // other than maybe what's selected in the UI or if we track it.
            // Let's assume we want the name of the version if one is selected, or "Current Draft" if not.
            // But the request is "What version of the Context was used".
            // If we just generated it, it's whatever is in the text areas.
            // If we loaded a version, we might know its name.
            // Let's check if we store the loaded version name.
            // In `loadContextVersions`, we might set something.
            // For now, I'll default to "Custom/Draft" if not set.

            if (window.activeContextVersionName) {
                payload.context_version = window.activeContextVersionName;
            } else {
                payload.context_version = 'Custom / Draft';
            }

            if (imageSrc.startsWith('http')) {
                // It's a URL, send as image_url
                payload.image_url = imageSrc;
            } else if (imageSrc.startsWith('data:image')) {
                // It's base64
                payload.image_data = imageSrc.split(',')[1];
            } else {
                showAlert('Invalid image source format');
                return;
            }

            const response = await fetch('/image-creation/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showAlert('Image saved to project successfully!');
                // Optionally refresh project assets if needed
            } else {
                const data = await response.json();
                const errorMsg = typeof data.detail === 'object' ? JSON.stringify(data.detail) : data.detail;
                showAlert('Failed to save image: ' + errorMsg);
            }
        } catch (error) {
            console.error('Error saving image:', error);
            showAlert('An error occurred while saving.');
        } finally {
            // Restore button state
            if (btnElement) {
                btnElement.disabled = false;
                btnElement.innerHTML = originalText;
            }
        }
    };

    if (btnGenerateImg) {
        btnGenerateImg.addEventListener('click', async () => {
            if (!currentProjectId) {
                showAlert('Please select or create a project first.');
                return;
            }

            const prompt = imgPrompt.value;
            const style = imgStyle.value;

            if (!prompt) {
                showAlert('Please enter a prompt');
                return;
            }

            setLoading(btnGenerateImg, true);

            const formData = new FormData();
            formData.append('prompt', prompt);
            if (style) formData.append('style', style);

            // Append all file types
            const appendFiles = (files, key) => {
                for (let i = 0; i < files.length; i++) {
                    formData.append(key, files[i]);
                }
            };

            appendFiles(imgFilesInput.files, 'reference_images');
            appendFiles(imgStyleFilesInput.files, 'style_images');
            appendFiles(imgProductFilesInput.files, 'product_images');
            appendFiles(imgSceneFilesInput.files, 'scene_images');

            if (currentProjectId) {
                formData.append('project_id', currentProjectId);
            }

            // Model Selection
            const modelToggle = document.getElementById('model-toggle-img');
            const modelName = modelToggle && modelToggle.checked ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
            formData.append('model_name', modelName);

            try {
                const response = await fetch('/image-creation/generate', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();

                if (response.ok) {
                    // Display result
                    // Display result
                    imgResultContainer.innerHTML = `
                <img src="${data.image_url}" alt="Generated Image" style="max-height: 60vh; object-fit: contain;">
                    <div class="project-actions" style="justify-content: center; margin-top: 1rem; gap: 10px;">
                        <button class="secondary-btn" onclick="openEditModal('${data.image_url}')">
                            <i class="fa-solid fa-wand-magic-sparkles"></i> Edit
                        </button>
                        <button class="secondary-btn" onclick="saveImageToProject('${data.image_url}', this)">
                            <i class="fa-regular fa-floppy-disk"></i> Save to Project
                        </button>
                        <button class="secondary-btn" onclick="downloadImage('${data.image_url}', 'generated_image.png')">
                            <i class="fa-solid fa-download"></i> Download
                        </button>
                    </div>
            `;

                } else {
                    showAlert('Error: ' + data.detail);
                }
            } catch (error) {
                console.error('Error:', error);
                showAlert('An error occurred');
            } finally {
                setLoading(btnGenerateImg, false);
            }
        });
    }

    // --- Virtual Try-on ---
    const btnTryon = document.getElementById('btn-tryon');
    const vtoPersonInput = document.getElementById('vto-person-file');
    const vtoClothInput = document.getElementById('vto-cloth-file');
    const vtoPersonPreview = document.getElementById('vto-person-preview');
    const vtoClothPreviewList = document.getElementById('vto-cloth-preview-list');
    const vtoResultContainer = document.getElementById('vto-result-container');
    const btnResetVto = document.getElementById('btn-reset-vto');

    let vtoClothingFiles = []; // Store selected files

    if (btnTryon) {
        document.getElementById('vto-person-upload').addEventListener('click', () => vtoPersonInput.click());
        document.getElementById('vto-cloth-upload').addEventListener('click', () => vtoClothInput.click());

        vtoPersonInput.addEventListener('change', (e) => showPreview(e.target, vtoPersonPreview));

        // Handle multiple clothing files
        vtoClothInput.addEventListener('change', (e) => {
            const newFiles = Array.from(e.target.files);

            // Add new files to existing list, checking for duplicates and max limit
            newFiles.forEach(file => {
                if (vtoClothingFiles.length < 3) {
                    // Simple duplicate check by name and size
                    const exists = vtoClothingFiles.some(f => f.name === file.name && f.size === file.size);
                    if (!exists) {
                        vtoClothingFiles.push(file);
                    }
                } else {
                    showAlert('Maximum 3 clothing images allowed.');
                }
            });

            updateClothingPreviews();

            // Reset input so same file can be selected again if removed
            e.target.value = '';
        });

        if (btnResetVto) {
            btnResetVto.addEventListener('click', () => {
                // Clear inputs
                vtoPersonInput.value = '';
                vtoClothInput.value = '';
                vtoClothingFiles = [];

                // Reset previews
                vtoPersonPreview.src = '';
                vtoPersonPreview.hidden = true;
                document.getElementById('vto-person-upload').style.display = 'flex'; // Show upload box

                updateClothingPreviews(); // This will clear the list and reset text since array is empty

                // Reset result
                vtoResultContainer.innerHTML = `
                <div class="empty-state">
                        <i class="fa-solid fa-shirt"></i>
                        <p>Try-on result will appear here</p>
                    </div>
                `;
            });
        }
    }

    function updateClothingPreviews() {
        vtoClothPreviewList.innerHTML = '';

        vtoClothingFiles.forEach((file, index) => {
            const container = document.createElement('div');
            container.className = 'preview-item';
            container.style.position = 'relative';
            container.style.display = 'inline-block';
            container.style.margin = '5px';

            const img = document.createElement('img');
            img.classList.add('preview-thumb');
            img.style.width = '80px';
            img.style.height = '80px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '8px';
            img.style.cursor = 'pointer'; // Make clickable
            img.onclick = () => openSimpleLightbox(img.src); // Open in lightbox

            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '<i class="fa-solid fa-times"></i>';
            removeBtn.className = 'remove-btn';
            removeBtn.style.position = 'absolute';
            removeBtn.style.top = '-5px';
            removeBtn.style.right = '-5px';
            removeBtn.style.background = 'red';
            removeBtn.style.color = 'white';
            removeBtn.style.border = 'none';
            removeBtn.style.borderRadius = '50%';
            removeBtn.style.width = '20px';
            removeBtn.style.height = '20px';
            removeBtn.style.cursor = 'pointer';
            removeBtn.style.display = 'flex';
            removeBtn.style.alignItems = 'center';
            removeBtn.style.justifyContent = 'center';
            removeBtn.style.fontSize = '12px';

            removeBtn.onclick = (e) => {
                e.stopPropagation(); // Prevent bubbling
                vtoClothingFiles.splice(index, 1);
                updateClothingPreviews();
            };

            const reader = new FileReader();
            reader.onload = (ev) => {
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);

            container.appendChild(img);
            container.appendChild(removeBtn);
            vtoClothPreviewList.appendChild(container);
        });

        // Update upload text
        const uploadArea = document.getElementById('vto-cloth-upload');
        if (vtoClothingFiles.length > 0) {
            uploadArea.querySelector('span').textContent = `${vtoClothingFiles.length} garments selected`;
        } else {
            uploadArea.querySelector('span').textContent = 'Upload Garment';
        }
    }

    function showPreview(input, imgElement) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imgElement.src = e.target.result;
                imgElement.hidden = false;
                imgElement.style.cursor = 'pointer'; // Make clickable
                imgElement.onclick = () => openSimpleLightbox(imgElement.src); // Open in lightbox
                input.parentElement.style.display = 'none'; // Hide upload box
            };
            reader.readAsDataURL(input.files[0]);
        }
    }

    if (btnTryon) {
        btnTryon.addEventListener('click', async () => {
            if (!currentProjectId) {
                showAlert('Please select or create a project first.');
                return;
            }

            if (!vtoPersonInput.files[0] || vtoClothingFiles.length === 0) {
                showAlert('Please upload person and at least one clothing image');
                return;
            }

            setLoading(btnTryon, true);

            const formData = new FormData();
            formData.append('person_image', vtoPersonInput.files[0]);

            // Append multiple clothing images from array
            vtoClothingFiles.forEach(file => {
                formData.append('clothing_images', file);
            });

            if (currentProjectId) {
                formData.append('project_id', currentProjectId);
            }

            try {
                const response = await fetch('/virtual-try-on/', {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    const url = await response.json();
                    vtoResultContainer.innerHTML = `
                <img src="${url}" alt="Try-on Result" style="cursor: pointer; max-height: 50vh; object-fit: contain;" onclick="openSimpleLightbox('${url}')">
                <div class="project-actions" style="justify-content: center; margin-top: 1rem; gap: 10px;">
                        <button class="secondary-btn" onclick="openEditModal('${url}')">
                            <i class="fa-solid fa-wand-magic-sparkles"></i> Edit
                        </button>
                        <button class="secondary-btn" onclick="saveImageToProject('${url}', this)">
                            <i class="fa-regular fa-floppy-disk"></i> Save to Project
                        </button>
                        <button class="secondary-btn" onclick="downloadImage('${url}', 'try-on-result.png')">
                            <i class="fa-solid fa-download"></i> Download
                        </button>
                    </div>
            `;
                } else {
                    const data = await response.json();
                    showAlert('Error: ' + data.detail);
                }
            } catch (error) {
                console.error('Error:', error);
                showAlert('An error occurred');
            } finally {
                setLoading(btnTryon, false);
            }
        });
    }

    // --- Video Creation ---
    const btnGenerateVideo = document.getElementById('btn-generate-video');
    const videoPrompt = document.getElementById('video-prompt');
    const videoResultContainer = document.getElementById('video-result-container');

    if (btnGenerateVideo) {
        btnGenerateVideo.addEventListener('click', async () => {
            if (!currentProjectId) {
                showAlert('Please select or create a project first.');
                return;
            }

            const prompt = videoPrompt.value;
            if (!prompt) {
                showAlert('Please enter a prompt');
                return;
            }

            setLoading(btnGenerateVideo, true);

            const formData = new FormData();
            formData.append('prompt', prompt);

            if (currentProjectId) {
                formData.append('project_id', currentProjectId);
            }

            try {
                const response = await fetch('/video-creation/generate', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();

                if (response.ok) {
                    videoResultContainer.innerHTML = `<video controls src="${data.video_url}"></video>`;
                } else {
                    showAlert('Error: ' + data.detail);
                }
            } catch (error) {
                console.error('Error:', error);
                showAlert('An error occurred');
            } finally {
                setLoading(btnGenerateVideo, false);
            }
        });
    }

    function setLoading(btn, isLoading) {
        if (isLoading) {
            btn.disabled = true;
            btn.dataset.originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
        } else {
            btn.disabled = false;
            btn.innerHTML = btn.dataset.originalText;
        }
    }

    // --- Lightbox ---
    const lightboxModal = document.getElementById('lightbox-modal');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxVideo = document.getElementById('lightbox-video');
    const lightboxCaption = document.querySelector('.lightbox-caption');
    const closeLightbox = document.querySelector('.close-lightbox');
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');

    function openLightbox(index) {
        currentLightboxIndex = index;
        // Ensure nav buttons are visible for project gallery
        if (prevBtn) prevBtn.hidden = false;
        if (nextBtn) nextBtn.hidden = false;
        updateLightboxContent();
        lightboxModal.hidden = false;
    }

    // Reusable function for single images (e.g. thumbnails)
    window.openSimpleLightbox = (src) => {
        lightboxImg.src = src;
        lightboxImg.hidden = false;
        lightboxVideo.hidden = true;
        lightboxVideo.pause();

        // Hide nav buttons for single image view
        if (prevBtn) prevBtn.hidden = true;
        if (nextBtn) nextBtn.hidden = true;

        lightboxCaption.textContent = '';
        lightboxModal.hidden = false;
    };

    function closeLightboxModal() {
        lightboxModal.hidden = true;
        lightboxVideo.pause();
        lightboxVideo.src = ''; // Stop video
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

        lightboxCaption.textContent = `${asset.type} - ${new Date(asset.created_at).toLocaleString()} `;
    }

    function nextSlide() {
        currentLightboxIndex = (currentLightboxIndex + 1) % currentProjectAssets.length;
        updateLightboxContent();
    }

    function prevSlide() {
        currentLightboxIndex = (currentLightboxIndex - 1 + currentProjectAssets.length) % currentProjectAssets.length;
        updateLightboxContent();
    }

    if (closeLightbox) closeLightbox.addEventListener('click', closeLightboxModal);
    if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); nextSlide(); });
    if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); prevSlide(); });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (lightboxModal && !lightboxModal.hidden) {
            if (e.key === 'Escape') closeLightboxModal();
            if (e.key === 'ArrowRight') nextSlide();
            if (e.key === 'ArrowLeft') prevSlide();
        }
    });

    if (lightboxModal) {
        lightboxModal.addEventListener('click', (e) => {
            if (e.target === lightboxModal) closeLightboxModal();
        });
    }

    // Lightbox Edit Button
    const btnLightboxEdit = document.getElementById('btn-lightbox-edit');
    if (btnLightboxEdit) {
        btnLightboxEdit.addEventListener('click', () => {
            const asset = currentProjectAssets[currentLightboxIndex];
            if (asset && asset.type === 'image') {
                closeLightboxModal();
                openEditModal(asset.url);
            }
        });
    }

    // Update Lightbox Edit Button Visibility
    function updateLightboxEditButton() {
        const asset = currentProjectAssets[currentLightboxIndex];
        if (btnLightboxEdit) {
            btnLightboxEdit.hidden = !asset || asset.type !== 'image';
        }
    }

    // Hook into updateLightboxContent
    const originalUpdateLightboxContent = updateLightboxContent;
    updateLightboxContent = function () {
        originalUpdateLightboxContent();
        updateLightboxEditButton();
    };

    // --- Prompt Optimization ---
    const modalOptimize = document.getElementById('modal-optimize-prompt');
    const closeOptimizeModal = document.getElementById('close-optimize-modal');
    const btnConfirmOptimize = document.getElementById('btn-confirm-optimize');

    let currentOptimizeTarget = null; // 'img-prompt' or 'edit-prompt'

    function openOptimizeModal(targetId) {
        currentOptimizeTarget = targetId;
        const targetInput = document.getElementById(targetId);
        if (!targetInput || !targetInput.value.trim()) {
            showAlert('Please enter a prompt first.');
            return;
        }

        modalOptimize.hidden = false;
    }

    const btnOptimizeImg = document.getElementById('btn-optimize-img');
    if (btnOptimizeImg) {
        btnOptimizeImg.addEventListener('click', () => openOptimizeModal('img-prompt'));
    }

    const btnOptimizeEdit = document.getElementById('btn-optimize-edit');
    if (btnOptimizeEdit) {
        btnOptimizeEdit.addEventListener('click', () => openOptimizeModal('edit-prompt'));
    }

    if (closeOptimizeModal) {
        closeOptimizeModal.addEventListener('click', () => {
            modalOptimize.hidden = true;
        });
    }

    if (btnConfirmOptimize) {
        btnConfirmOptimize.addEventListener('click', async () => {
            if (!currentOptimizeTarget) return;

            const targetInput = document.getElementById(currentOptimizeTarget);
            const prompt = targetInput.value.trim();

            // Show loading state
            const originalBtnText = btnConfirmOptimize.innerHTML;
            btnConfirmOptimize.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enhancing...';
            btnConfirmOptimize.disabled = true;

            try {
                const response = await fetch('/image-creation/optimize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: prompt })
                });

                if (response.ok) {
                    const data = await response.json();
                    targetInput.value = data.optimized_prompt;
                    modalOptimize.hidden = true;
                    showAlert('Prompt enhanced successfully!');
                } else {
                    const error = await response.json();
                    showAlert(`Enhancement failed: ${error.detail} `);
                }
            } catch (error) {
                console.error('Error enhancing prompt:', error);
                showAlert('An error occurred while enhancing.');
            } finally {
                btnConfirmOptimize.innerHTML = originalBtnText;
                btnConfirmOptimize.disabled = false;
            }
        });
    }
    // Context Engineering Logic
    function renderContextAccordion(containerId, project) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        if (!project) {
            container.innerHTML = '<p class="text-muted">Please select a project to use context features.</p>';
            return;
        }

        // Reset container style to allow custom internal layout
        container.style.display = 'block';

        // Add Select/Clear All Buttons
        const controlsDiv = document.createElement('div');
        controlsDiv.style.marginBottom = '1rem';
        controlsDiv.style.display = 'flex';
        controlsDiv.style.gap = '10px';

        const btnSelectAll = document.createElement('button');
        btnSelectAll.className = 'secondary-btn small-btn';
        btnSelectAll.innerText = 'Select All';
        btnSelectAll.style.whiteSpace = 'nowrap';
        btnSelectAll.style.width = 'auto';
        btnSelectAll.onclick = () => {
            const checkboxes = container.querySelectorAll('input[type="checkbox"]:not([disabled])');
            checkboxes.forEach(cb => cb.checked = true);
        };

        const btnClearAll = document.createElement('button');
        btnClearAll.className = 'secondary-btn small-btn';
        btnClearAll.innerText = 'Clear All';
        btnClearAll.style.whiteSpace = 'nowrap';
        btnClearAll.style.width = 'auto';
        btnClearAll.onclick = () => {
            const checkboxes = container.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = false);
        };

        controlsDiv.appendChild(btnSelectAll);
        controlsDiv.appendChild(btnClearAll);
        container.appendChild(controlsDiv);

        // Create 2-column layout wrapper
        const columnsWrapper = document.createElement('div');
        columnsWrapper.style.display = 'grid';
        columnsWrapper.style.gridTemplateColumns = 'auto auto';
        columnsWrapper.style.justifyContent = 'start';
        columnsWrapper.style.gap = '40px';
        columnsWrapper.style.marginBottom = '10px';

        const leftCol = document.createElement('div');
        leftCol.style.display = 'flex';
        leftCol.style.flexDirection = 'column';
        leftCol.style.gap = '10px';

        const rightCol = document.createElement('div');
        rightCol.style.display = 'flex';
        rightCol.style.flexDirection = 'column';
        rightCol.style.gap = '10px';

        columnsWrapper.appendChild(leftCol);
        columnsWrapper.appendChild(rightCol);
        container.appendChild(columnsWrapper);

        const fields = [
            { key: 'brand_vibe', label: 'Brand Vibe' },
            { key: 'brand_lighting', label: 'Brand Lighting' },
            { key: 'brand_colors', label: 'Brand Colors' },
            { key: 'brand_subject', label: 'Brand Subject' },
            { key: 'project_vibe', label: 'Project Vibe' },
            { key: 'project_lighting', label: 'Project Lighting' },
            { key: 'project_colors', label: 'Project Colors' },
            { key: 'project_subject', label: 'Project Subject' },
            { key: 'context', label: 'Overall Context' }
        ];

        let hasData = false;

        fields.forEach(field => {
            const value = project[field.key];
            const hasValue = value && value.trim() !== '';
            if (hasValue) hasData = true;

            const div = document.createElement('div');
            div.className = 'checkbox-wrapper';
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.gap = '8px';

            const disabledStyle = !hasValue ? 'text-decoration: line-through; opacity: 0.5; filter: blur(0.5px);' : '';
            const disabledAttr = !hasValue ? 'disabled' : 'checked';
            const cursorStyle = !hasValue ? 'not-allowed' : 'pointer';

            div.innerHTML = `
                <input type="checkbox" id="ctx-${containerId}-${field.key}" value="${hasValue ? value : ''}" data-label="${field.label}" ${disabledAttr}>
                <label for="ctx-${containerId}-${field.key}" style="font-size: 0.9rem; cursor: ${cursorStyle}; ${disabledStyle}">
                    <strong>${field.label}</strong>
                    ${field.key === 'context' ? '<span class="text-muted" style="font-size: 0.8rem; margin-left: 5px; font-weight: normal;">(Select Overall Context ONLY for Token Optimized prompt)</span>' : ''}
                </label>
            `;

            // Append to appropriate column or main container
            if (field.key.startsWith('brand_')) {
                leftCol.appendChild(div);
            } else if (field.key.startsWith('project_')) {
                rightCol.appendChild(div);
            } else if (field.key === 'context') {
                // Overall Context goes below columns
                div.style.marginTop = '10px';
                container.appendChild(div);
            }
        });

        if (!hasData) {
            container.innerHTML = '<p class="text-muted">No context data available for this project.</p>';
        }
    }

    function setupContextAccordion(btnId, contentId, checkboxesId, applyBtnId, targetInputId) {
        const btn = document.getElementById(btnId);
        const content = document.getElementById(contentId);
        const applyBtn = document.getElementById(applyBtnId);
        const targetInput = document.getElementById(targetInputId);

        if (btn && content) {
            btn.addEventListener('click', () => {
                const isHidden = content.hidden;
                content.hidden = !isHidden;
                const icon = btn.querySelector('.fa-chevron-down');
                if (icon) {
                    icon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
                }

                // Re-render if opening and we have a project
                if (isHidden && currentProjectId) {
                    // We need the full project data. If we only have ID, we might need to find it in 'projects' array
                    // or fetch it. 'projects' array is populated by loadProjects.
                    const project = projects.find(p => p.id === currentProjectId);
                    if (project) {
                        renderContextAccordion(checkboxesId, project);
                    }
                }
            });
        }

        if (applyBtn && targetInput) {
            applyBtn.addEventListener('click', () => {
                const checkboxes = document.querySelectorAll(`#${checkboxesId} input[type="checkbox"]:checked`);
                if (checkboxes.length === 0) {
                    showAlert('Please select at least one context element.');
                    return;
                }

                let contextText = '';
                checkboxes.forEach(cb => {
                    contextText += `${cb.dataset.label}: ${cb.value}.`;
                });

                // Append to input
                const currentVal = targetInput.value;
                targetInput.value = currentVal ? currentVal + ' ' + contextText : contextText;

                // Visual feedback
                const originalText = applyBtn.innerText;
                applyBtn.innerText = 'Applied!';
                setTimeout(() => {
                    applyBtn.innerText = originalText;
                }, 1500);
            });
        }
    }

    // Initialize Context Accordions
    setupContextAccordion('btn-context-accordion-img', 'context-content-img', 'context-checkboxes-img', 'btn-apply-context-img', 'img-prompt');
    setupContextAccordion('btn-context-accordion-edit', 'context-content-edit', 'context-checkboxes-edit', 'btn-apply-context-edit', 'edit-prompt');

    // --- Context Engineering Page Logic ---
    // --- Context Engineering Page Logic ---
    const ctxCurrentProjectName = document.getElementById('ctx-current-project-name');
    const ctxBlockedOverlay = document.getElementById('ctx-blocked-overlay');
    const btnGenerateContext = document.getElementById('btn-generate-context');
    const btnAnalyzeBrand = document.getElementById('btn-analyze-brand');
    const btnSaveVersion = document.getElementById('btn-save-version');
    const modalSaveVersion = document.getElementById('modal-save-version');
    const btnConfirmSave = document.getElementById('btn-confirm-save');
    const closeModalSave = document.getElementById('close-modal-save');
    const versionList = document.getElementById('version-list');

    // Initialize Context Page
    async function initContextPage() {
        if (!ctxCurrentProjectName) return; // Not on context page

        const savedProjectId = localStorage.getItem('currentProjectId');

        if (savedProjectId) {
            currentProjectId = parseInt(savedProjectId);
            showSidebarLoading();

            // Fetch project details to get name and initial data
            try {
                // Always fetch fresh project data to ensure context is up-to-date
                const res = await fetch(`/projects/${currentProjectId}?t=${new Date().getTime()}`);

                if (res.ok) {
                    const project = await res.json();

                    // Update global projects list if it exists
                    if (typeof projects !== 'undefined') {
                        const idx = projects.findIndex(p => p.id === project.id);
                        if (idx !== -1) projects[idx] = project;
                        else projects.push(project);
                    } else {
                        projects = [project];
                    }

                    // Project found
                    ctxCurrentProjectName.textContent = project.name;
                    ctxBlockedOverlay.hidden = true;

                    // Update sidebar
                    updateSidebarProject(project);

                    // Load data
                    loadContextVersions(currentProjectId, project);
                    populateContextFields(project);
                } else {
                    // Project ID in local storage but not found in DB
                    console.warn('Project ID found in storage but not in project list:', currentProjectId);
                    handleNoProject();
                }
            } catch (error) {
                console.error('Error initializing context page:', error);
                handleNoProject();
            } finally {
                const loadingOverlay = document.getElementById('page-loading-overlay');
                if (loadingOverlay) {
                    loadingOverlay.style.opacity = '0';
                    setTimeout(() => loadingOverlay.hidden = true, 500);
                }
            }
        } else {
            handleNoProject();
            const loadingOverlay = document.getElementById('page-loading-overlay');
            if (loadingOverlay) {
                loadingOverlay.style.opacity = '0';
                setTimeout(() => loadingOverlay.hidden = true, 500);
            }
        }
    }

    function handleNoProject() {
        if (ctxCurrentProjectName) ctxCurrentProjectName.textContent = 'None';
        if (ctxBlockedOverlay) ctxBlockedOverlay.hidden = false;
        if (versionList) versionList.innerHTML = '';
        updateSidebarProject(null);
        clearContextFields();
    }

    // Call init on load
    if (document.getElementById('ctx-current-project-name')) {
        initContextPage();
    }

    if (btnGenerateContext) {
        btnGenerateContext.addEventListener('click', async () => {
            const goal = document.getElementById('input-goal').value;
            if (!goal) return showAlert('Please enter a project goal.');

            setLoading(btnGenerateContext, true);
            try {
                const res = await fetch('/context/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ goal })
                });
                if (res.ok) {
                    const data = await res.json();
                    populateContextFields(data, ['project_vibe', 'project_lighting', 'project_colors', 'project_subject', 'context']);
                    updatePromptPreview();
                } else {
                    showAlert('Generation failed.');
                }
            } catch (error) {
                console.error(error);
                showAlert('Error generating context.');
            } finally {
                setLoading(btnGenerateContext, false);
            }
        });
    }

    if (btnAnalyzeBrand) {
        btnAnalyzeBrand.addEventListener('click', async () => {
            const brandName = document.getElementById('input-brand-name').value;
            if (!brandName) return showAlert('Please enter a brand name.');

            setLoading(btnAnalyzeBrand, true);
            try {
                const res = await fetch('/context/analyze-brand', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ brand_name: brandName })
                });
                if (res.ok) {
                    const data = await res.json();
                    populateContextFields(data, ['brand_vibe', 'brand_lighting', 'brand_colors', 'brand_subject']);
                    updatePromptPreview();
                } else {
                    showAlert('Analysis failed.');
                }
            } catch (error) {
                console.error(error);
                showAlert('Error analyzing brand.');
            } finally {
                setLoading(btnAnalyzeBrand, false);
            }
        });
    }

    // --- From File Logic ---
    const ctxFileInput = document.getElementById('ctx-file-input');
    const ctxFileUploadArea = document.getElementById('ctx-file-upload-area');
    const ctxFilePreview = document.getElementById('ctx-file-preview');
    const btnAnalyzeFile = document.getElementById('btn-analyze-file');
    let ctxSelectedFile = null;

    if (ctxFileInput && ctxFileUploadArea) {
        ctxFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                ctxSelectedFile = file;
                ctxFilePreview.textContent = `Selected: ${file.name} `;
                ctxFileUploadArea.querySelector('span').textContent = 'Change file';
            }
        });
    }

    if (btnAnalyzeFile) {
        btnAnalyzeFile.addEventListener('click', async () => {
            if (!ctxSelectedFile) return showAlert('Please select a file first.');

            const analysisType = document.querySelector('input[name="analysis-type"]:checked').value;

            setLoading(btnAnalyzeFile, true);
            try {
                const formData = new FormData();
                formData.append('file', ctxSelectedFile);
                formData.append('analysis_type', analysisType);

                const res = await fetch('/context/analyze-file', {
                    method: 'POST',
                    body: formData
                });

                if (res.ok) {
                    const data = await res.json();

                    let targetFields = [];
                    if (analysisType === 'brand') {
                        targetFields = ['brand_vibe', 'brand_lighting', 'brand_colors', 'brand_subject'];
                    } else {
                        targetFields = ['project_vibe', 'project_lighting', 'project_colors', 'project_subject', 'context'];
                    }

                    populateContextFields(data, targetFields);
                    updatePromptPreview();
                    showAlert('File analysis complete!');
                } else {
                    const err = await res.json();
                    showAlert('Analysis failed: ' + (err.detail || 'Unknown error'));
                }
            } catch (error) {
                console.error(error);
                showAlert('Error analyzing file.');
            } finally {
                setLoading(btnAnalyzeFile, false);
            }
        });
    }

    // --- Field Enhancement Logic ---
    const enhanceButtons = document.querySelectorAll('.enhance-field-btn');
    const modalEnhance = document.getElementById('modal-enhance-field');
    const btnConfirmEnhance = document.getElementById('btn-confirm-enhance');
    const closeEnhanceModal = document.getElementById('close-enhance-modal');
    let currentEnhanceTargetId = null;

    enhanceButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentEnhanceTargetId = btn.dataset.target;
            document.getElementById('enhance-instructions').value = ''; // Clear previous instructions
            if (modalEnhance) modalEnhance.hidden = false;
        });
    });

    if (closeEnhanceModal) {
        closeEnhanceModal.addEventListener('click', () => {
            if (modalEnhance) modalEnhance.hidden = true;
            currentEnhanceTargetId = null;
        });
    }

    // Close modal on outside click
    window.addEventListener('click', (event) => {
        if (event.target === modalEnhance) {
            modalEnhance.hidden = true;
            currentEnhanceTargetId = null;
        }
    });

    if (btnConfirmEnhance) {
        btnConfirmEnhance.addEventListener('click', async () => {
            if (!currentEnhanceTargetId) return;

            const targetField = document.getElementById(currentEnhanceTargetId);
            if (!targetField) return;

            const instructions = document.getElementById('enhance-instructions').value;
            const currentValue = targetField.value;

            // Derive field name from ID (e.g., ctx-brand-vibe -> Brand Vibe)
            let fieldName = currentEnhanceTargetId.replace('ctx-', '').replace(/-/g, ' ');
            fieldName = fieldName.replace(/\b\w/g, l => l.toUpperCase());

            setLoading(btnConfirmEnhance, true);

            try {
                const res = await fetch('/context/enhance-field', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        current_value: currentValue,
                        field_name: fieldName,
                        instructions: instructions
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    targetField.value = data.enhanced_text;
                    if (typeof updatePromptPreview === 'function') {
                        updatePromptPreview();
                    }
                    if (modalEnhance) modalEnhance.hidden = true;
                    showAlert('Field enhanced!');
                } else {
                    const err = await res.json();
                    showAlert('Enhancement failed: ' + (err.detail || 'Unknown error'));
                }
            } catch (error) {
                console.error(error);
                showAlert('Error enhancing field.');
            } finally {
                setLoading(btnConfirmEnhance, false);
            }
        });
    }

    function populateContextFields(data, targetFields = null) {
        const allFields = [
            'brand_vibe', 'brand_lighting', 'brand_colors', 'brand_subject',
            'project_vibe', 'project_lighting', 'project_colors', 'project_subject',
            'context' // maps to ctx-overall
        ];

        const fieldsToUpdate = targetFields || allFields;

        fieldsToUpdate.forEach(key => {
            const elementId = key === 'context' ? 'ctx-overall' : `ctx-${key.replace('_', '-')}`;
            const el = document.getElementById(elementId);
            if (el && data[key] !== undefined) {
                el.value = data[key];
            }
        });
        updatePromptPreview();
    }

    function clearContextFields() {
        const inputs = document.querySelectorAll('[id^="ctx-"]');
        inputs.forEach(input => input.value = '');
        updatePromptPreview(); // Update the HTML preview
    }

    // Update preview when inputs change
    const contextInputs = document.querySelectorAll('[id^="ctx-"]');
    contextInputs.forEach(input => {
        input.addEventListener('input', updatePromptPreview);
    });

    function updatePromptPreview() {
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

        // Helper to generate section HTML
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
                        </div>
                `;
                }
            });

            if (hasSectionContent) {
                hasContent = true;
                return `
                <div class="preview-section">
                    <div class="preview-section-title">${title}</div>
                        ${sectionHtml}
                    </div>
                `;
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

    // Copy Preview Logic
    const btnCopyPreview = document.getElementById('btn-copy-preview');
    if (btnCopyPreview) {
        btnCopyPreview.addEventListener('click', () => {
            const contextInputs = document.querySelectorAll('[id^="ctx-"]');
            const fieldLabels = {
                'ctx-brand-vibe': 'Brand Vibe',
                'ctx-brand-lighting': 'Brand Lighting',
                'ctx-brand-colors': 'Brand Colors',
                'ctx-brand-subject': 'Brand Subject',
                'ctx-project-vibe': 'Project Vibe',
                'ctx-project-lighting': 'Project Lighting',
                'ctx-project-colors': 'Project Colors',
                'ctx-project-subject': 'Project Subject',
                'ctx-overall': 'Overall Context'
            };

            let text = '';
            contextInputs.forEach(input => {
                if (input.value && fieldLabels[input.id]) {
                    text += `${fieldLabels[input.id]}: ${input.value}.\n\n`;
                }
            });

            if (!text) {
                showAlert('Nothing to copy!');
                return;
            }

            navigator.clipboard.writeText(text).then(() => {
                const originalHtml = btnCopyPreview.innerHTML;
                btnCopyPreview.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                setTimeout(() => {
                    btnCopyPreview.innerHTML = originalHtml;
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy:', err);
                showAlert('Failed to copy to clipboard');
            });
        });
    }

    // --- Synthesize Context Logic ---
    const btnSynthesizeContext = document.getElementById('btn-synthesize-context');
    if (btnSynthesizeContext) {
        btnSynthesizeContext.addEventListener('click', async () => {
            setLoading(btnSynthesizeContext, true);
            try {
                const payload = {
                    brand_vibe: document.getElementById('ctx-brand-vibe').value,
                    brand_lighting: document.getElementById('ctx-brand-lighting').value,
                    brand_colors: document.getElementById('ctx-brand-colors').value,
                    brand_subject: document.getElementById('ctx-brand-subject').value,
                    project_vibe: document.getElementById('ctx-project-vibe').value,
                    project_lighting: document.getElementById('ctx-project-lighting').value,
                    project_colors: document.getElementById('ctx-project-colors').value,
                    project_subject: document.getElementById('ctx-project-subject').value
                };

                const res = await fetch('/context/synthesize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    const data = await res.json();
                    document.getElementById('ctx-overall').value = data.synthesized_text;
                    updatePromptPreview();
                    showAlert('Context synthesized!');
                } else {
                    const err = await res.json();
                    showAlert('Synthesis failed: ' + (err.detail || 'Unknown error'));
                }
            } catch (error) {
                console.error(error);
                showAlert('Error synthesizing context.');
            } finally {
                setLoading(btnSynthesizeContext, false);
            }
        });
    }

    // Update Project Context
    const btnUpdateProjectContext = document.getElementById('btn-update-project-context');
    if (btnUpdateProjectContext) {
        btnUpdateProjectContext.addEventListener('click', async () => {
            if (!currentProjectId) return showAlert('Please select a project first.');

            const project = projects.find(p => p.id === currentProjectId);
            if (!project) return showAlert('Project not found.');

            const payload = {
                name: project.name, // Required by backend schema
                description: project.description, // Keep description as well
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

            setLoading(btnUpdateProjectContext, true);
            try {
                const res = await fetch(`/ projects / ${currentProjectId} `, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    showAlert('Project context updated successfully!');
                    // Update the global projects list to reflect changes
                    const updatedProject = await res.json();
                    const index = projects.findIndex(p => p.id === updatedProject.id);
                    if (index !== -1) {
                        projects[index] = updatedProject;
                    }
                    // Reload versions to sync "Current" label
                    loadContextVersions(currentProjectId, updatedProject);
                } else {
                    showAlert('Failed to update project context.');
                }
            } catch (error) {
                console.error(error);
                showAlert('Error updating project context.');
            } finally {
                setLoading(btnUpdateProjectContext, false);
            }
        });
    }

    // Update Current Version
    // Update Current Version
    const btnUpdateVersion = document.getElementById('btn-update-version');
    if (btnUpdateVersion) {
        btnUpdateVersion.addEventListener('click', async () => {
            if (!currentProjectId) return showAlert('Please select a project first.');
            if (!currentVersionId) {
                // If no version is selected, prompt to save as new
                if (confirm('No version selected. Would you like to save as a new version?')) {
                    isEditingVersion = false;
                    document.getElementById('save-version-name').value = '';
                    document.getElementById('save-version-desc').value = '';
                    document.querySelector('#modal-save-version h2').innerText = 'Save New Version';
                    modalSaveVersion.hidden = false;
                }
                return;
            }

            const payload = {
                // name: Removed to prevent overwriting with default/empty
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

            setLoading(btnUpdateVersion, true);
            try {
                const res = await fetch(`/ context / versions / ${currentVersionId} `, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    showAlert('Version updated successfully!');
                    loadContextVersions(currentProjectId); // Reload list to reflect any changes
                } else {
                    const err = await res.json();
                    showAlert('Failed to update version: ' + (err.detail || 'Unknown error'));
                }
            } catch (error) {
                console.error(error);
                showAlert('Error updating version.');
            } finally {
                setLoading(btnUpdateVersion, false);
            }
        });
    }

    // Saving Versions
    let isEditingVersion = false;
    const btnEditVersionDetails = document.getElementById('btn-edit-version-details');

    if (btnEditVersionDetails) {
        btnEditVersionDetails.addEventListener('click', async () => {
            if (!currentVersionId) return showAlert('Please select a version to edit.');

            setLoading(btnEditVersionDetails, true);
            try {
                const res = await fetch(`/ context / version / ${currentVersionId} `);
                if (res.ok) {
                    const version = await res.json();
                    document.getElementById('save-version-name').value = version.name;
                    document.getElementById('save-version-desc').value = version.description || '';

                    isEditingVersion = true;
                    document.querySelector('#modal-save-version h2').innerText = 'Edit Version Details';
                    modalSaveVersion.hidden = false;
                } else {
                    showAlert('Failed to load version details.');
                }
            } catch (error) {
                console.error(error);
                showAlert('Error loading version details.');
            } finally {
                setLoading(btnEditVersionDetails, false);
            }
        });
    }

    if (btnSaveVersion) {
        btnSaveVersion.addEventListener('click', () => {
            if (!currentProjectId) return showAlert('Please select a project first.');
            isEditingVersion = false;
            document.getElementById('save-version-name').value = '';
            document.getElementById('save-version-desc').value = '';
            document.querySelector('#modal-save-version h2').innerText = 'Save New Version';
            modalSaveVersion.hidden = false;
        });
    }

    if (closeModalSave) {
        closeModalSave.addEventListener('click', () => modalSaveVersion.hidden = true);
    }

    if (btnConfirmSave) {
        btnConfirmSave.addEventListener('click', async () => {
            const name = document.getElementById('save-version-name').value;
            const desc = document.getElementById('save-version-desc').value;

            if (!name) return showAlert('Please enter a version name.');

            setLoading(btnConfirmSave, true);
            try {
                let res;
                if (isEditingVersion) {
                    // Update existing version metadata (name/desc only)
                    res = await fetch(`/ context / versions / ${currentVersionId} `, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, description: desc })
                    });
                } else {
                    // Create new version
                    const payload = {
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

                    res = await fetch('/context/versions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                }

                if (res.ok) {
                    showAlert(isEditingVersion ? 'Version details updated!' : 'Version saved successfully!');
                    modalSaveVersion.hidden = true;
                    loadContextVersions(currentProjectId);
                } else {
                    const err = await res.json();
                    showAlert('Failed: ' + (err.detail || 'Unknown error'));
                }
            } catch (error) {
                console.error(error);
                showAlert('Error saving version.');
            } finally {
                setLoading(btnConfirmSave, false);
            }
        });
    }


    // --- Prompt Insights Logic ---
    const btnGetInsights = document.getElementById('btn-get-insights');
    const modalInsights = document.getElementById('modal-prompt-insights');
    const closeModalInsights = document.getElementById('close-modal-insights');
    const btnStartAnalysis = document.getElementById('btn-start-analysis');
    const viewInitial = document.getElementById('insights-initial-view');
    const viewLoading = document.getElementById('insights-loading-view');
    const viewResults = document.getElementById('insights-results-view');

    if (btnGetInsights && modalInsights) {
        btnGetInsights.addEventListener('click', () => {
            // Reset view
            viewInitial.hidden = false;
            viewLoading.hidden = true;
            viewResults.hidden = true;
            modalInsights.hidden = false;
        });

        if (closeModalInsights) {
            closeModalInsights.addEventListener('click', () => {
                modalInsights.hidden = true;
            });
        }

        if (btnStartAnalysis) {
            btnStartAnalysis.addEventListener('click', async () => {
                // Get current prompt text
                const promptPreview = document.getElementById('prompt-preview-container');
                let promptText = '';

                // Extract text from the structured preview or construct it
                const contextInputs = document.querySelectorAll('[id^="ctx-"]');
                const fieldLabels = {
                    'ctx-brand-vibe': 'Brand Vibe',
                    'ctx-brand-lighting': 'Brand Lighting',
                    'ctx-brand-colors': 'Brand Colors',
                    'ctx-brand-subject': 'Brand Subject',
                    'ctx-project-vibe': 'Project Vibe',
                    'ctx-project-lighting': 'Project Lighting',
                    'ctx-project-colors': 'Project Colors',
                    'ctx-project-subject': 'Project Subject',
                    'ctx-overall': 'Overall Context'
                };

                contextInputs.forEach(input => {
                    if (input.value && fieldLabels[input.id]) {
                        promptText += `${fieldLabels[input.id]}: ${input.value}.\n`;
                    }
                });

                if (!promptText.trim()) {
                    showAlert('Please add some context details first.');
                    return;
                }

                // Switch to loading
                viewInitial.hidden = true;
                viewLoading.hidden = false;

                try {
                    const res = await fetch('/context/insight', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt_text: promptText })
                    });

                    if (res.ok) {
                        const data = await res.json();
                        renderInsights(data);
                        viewLoading.hidden = true;
                        viewResults.hidden = false;
                    } else {
                        const err = await res.json();
                        showAlert('Analysis failed: ' + (err.detail || 'Unknown error'));
                        viewLoading.hidden = true;
                        viewInitial.hidden = false;
                    }
                } catch (error) {
                    console.error(error);
                    showAlert('Error analyzing prompt.');
                    viewLoading.hidden = true;
                    viewInitial.hidden = false;
                }
            });
        }
    }

    function renderInsights(data) {
        if (!viewResults) return;

        let suggestionsHtml = '';
        if (data.suggestions && data.suggestions.length > 0) {
            suggestionsHtml = data.suggestions.map(s => `
                <div class="insight-suggestion">
                    <div class="suggestion-header">
                        <i class="fa-solid fa-arrow-right" style="color: var(--accent-color);"></i>
                        <span class="suggestion-text">${s.suggestion}</span>
                    </div>
                    <div class="suggestion-impact">
                        <strong>Impact:</strong> ${s.impact}
                    </div>
                </div>
                `).join('');
        }

        let featuresHtml = '';
        if (data.key_features && data.key_features.length > 0) {
            featuresHtml = '<ul class="insight-features-list">' +
                data.key_features.map(f => `<li>${f}</li>`).join('') +
                '</ul>';
        }

        viewResults.innerHTML = `
                <div class="insight-section">
                <h3><i class="fa-solid fa-palette"></i> Creative Summary</h3>
                <p>${data.creative_summary}</p>
            </div>

            <div class="insight-grid">
                <div class="insight-column">
                    <div class="insight-section">
                        <h3><i class="fa-solid fa-star"></i> Key Features</h3>
                        ${featuresHtml}
                    </div>
                </div>
                <div class="insight-column">
                    <div class="insight-section">
                        <h3><i class="fa-solid fa-glasses"></i> Style Explanation</h3>
                        <p>${data.style_explanation}</p>
                    </div>
                </div>
            </div>

            <div class="insight-section">
                <h3><i class="fa-solid fa-wand-magic-sparkles"></i> Suggestions for Improvement</h3>
                ${suggestionsHtml}
            </div>
            `;
    }

    // --- Asset Info Modal ---

    const closeInfoModal = document.getElementById('close-modal-asset-info');
    if (closeInfoModal) {
        closeInfoModal.addEventListener('click', () => {
            document.getElementById('modal-asset-info').hidden = true;
        });
    }

});
