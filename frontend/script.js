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

    // Check if we are on project.html
    const urlParams = new URLSearchParams(window.location.search);
    const projectIdParam = urlParams.get('id');

    if (projectIdParam && window.location.pathname.includes('project.html')) {
        // We are on project details page
        openProject(projectIdParam);
    } else {
        // We are on index.html (or similar)

        // Handle Hash Navigation (if coming from project page)
        if (window.location.hash) {
            const targetId = window.location.hash.substring(1);
            activateSection(targetId);
        }

        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                const targetId = link.getAttribute('data-target');
                activateSection(targetId);
            });
        });
    }

    function activateSection(targetId) {
        // If element doesn't exist (e.g. on project.html clicking a link that should go to index), 
        // the onclick in HTML handles the redirection. 
        // This logic is for single-page nav within index.html
        const targetSection = document.getElementById(targetId);
        if (!targetSection) return;

        navLinks.forEach(l => l.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active-section'));

        const activeLink = document.querySelector(`.nav-links li[data-target="${targetId}"]`);
        if (activeLink) activeLink.classList.add('active');

        targetSection.classList.add('active-section');

        if (targetId === 'projects') {
            loadProjects();
        }
    }
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
            const description = document.getElementById('new-project-desc').value;
            const context = document.getElementById('new-project-context').value;

            if (!name) {
                showAlert('Please enter a project name');
                return;
            }

            try {
                const response = await fetch('/projects/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ name, description, context })
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
            const savedId = localStorage.getItem('currentProjectId');
            if (savedId) currentProjectId = parseInt(savedId);
        }

        // If we are on index.html, redirect to project.html
        if (!window.location.pathname.includes('project.html')) {
            window.location.href = `project.html?id=${projectId}`;
            return;
        }

        // If we are already on project.html (or called from init), fetch details
        try {
            const response = await fetch(`/projects/${projectId}`);
            if (response.ok) {
                const project = await response.json();
                showProjectDetails(project);
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
            <div class="glass-panel" style="margin-top: 1rem; padding: 1rem;">
                <h4>Context / Guidelines</h4>
                <p>${project.context || 'No context provided.'}</p>
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
                        ${asset.type === 'image' ? `<button class="edit-btn small-btn" data-id="${asset.id}" title="Edit Image"><i class="fa-solid fa-wand-magic-sparkles"></i></button>` : ''}
                        <button class="delete-btn small-delete-btn" data-id="${asset.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;

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

            // Handle lightbox click
            assetCard.addEventListener('click', () => openLightbox(index));

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
            // These elements might not exist if we are on project.html but the button is there?
            // Actually btnBackProjects is on project.html.
            // But projectListView and btnCreateProject are NOT on project.html.
            // So this logic needs to be adjusted for project.html or index.html.

            // If on project.html, back button should just go to index.html
            if (window.location.pathname.includes('project.html')) {
                window.location.href = 'index.html#projects';
                return;
            }

            // If on index.html (old logic, but we removed the view), this code shouldn't run or exist.
            // But let's keep it safe.
            if (projectDetailsView) projectDetailsView.hidden = true;
            if (projectListView) projectListView.hidden = false;
            if (btnCreateProject) btnCreateProject.hidden = false;
            loadProjects();
        });
    }

    async function deleteAsset(assetId, projectId) {
        if (!confirm('Are you sure you want to delete this asset?')) {
            return;
        }

        try {
            const response = await fetch(`/assets/${assetId}`, {
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
    const closeAlert = document.getElementById('close-alert');

    function showAlert(message) {
        alertMessage.textContent = message;
        alertModal.hidden = false;
    }

    function closeAlertModal() {
        alertModal.hidden = true;
    }

    btnAlertOk.addEventListener('click', closeAlertModal);
    closeAlert.addEventListener('click', closeAlertModal);

    // Close alert when clicking outside
    alertModal.addEventListener('click', (e) => {
        if (e.target === alertModal) {
            closeAlertModal();
        }
    });

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
        modalEditProject.hidden = false;
    }

    if (btnSaveProjectChanges) {
        btnSaveProjectChanges.addEventListener('click', async () => {
            if (!currentProjectData || !currentProjectData.id) return;

            const name = editProjectName.value;
            const desc = editProjectDesc.value;
            const context = editProjectContext.value;

            if (!name) {
                showAlert('Project name is required');
                return;
            }

            try {
                const response = await fetch(`/projects/${currentProjectData.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, description: desc, context })
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
                    const newImageSrc = `data:image/png;base64,${data.image_data}`;

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
                showAlert('An error occurred during editing');
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
                const style = document.getElementById('edit-style').value;
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
                    const newImageSrc = `data:image/png;base64,${data.image_data}`;
                    currentEditImageSrc = newImageSrc;
                    editMainImg.src = newImageSrc;
                    editHistory.unshift(newImageSrc); // Add to top
                    renderEditHistory();
                    editInstruction.value = ''; // Clear instruction
                    document.getElementById('edit-style').value = ''; // Clear style
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

        lightboxCaption.textContent = `${asset.type} - ${new Date(asset.created_at).toLocaleString()}`;
    }

    function nextSlide() {
        currentLightboxIndex = (currentLightboxIndex + 1) % currentProjectAssets.length;
        updateLightboxContent();
    }

    function prevSlide() {
        currentLightboxIndex = (currentLightboxIndex - 1 + currentProjectAssets.length) % currentProjectAssets.length;
        updateLightboxContent();
    }

    closeLightbox.addEventListener('click', closeLightboxModal);
    nextBtn.addEventListener('click', (e) => { e.stopPropagation(); nextSlide(); });
    prevBtn.addEventListener('click', (e) => { e.stopPropagation(); prevSlide(); });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (!lightboxModal.hidden) {
            if (e.key === 'Escape') closeLightboxModal();
            if (e.key === 'ArrowRight') nextSlide();
            if (e.key === 'ArrowLeft') prevSlide();
        }
    });

    lightboxModal.addEventListener('click', (e) => {
        if (e.target === lightboxModal) closeLightboxModal();
    });

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
    const optimizeOriginalPrompt = document.getElementById('optimize-original-prompt');

    let currentOptimizeTarget = null; // 'img-prompt' or 'edit-prompt'

    function openOptimizeModal(targetId) {
        const targetInput = document.getElementById(targetId);
        if (!targetInput) return;

        const promptText = targetInput.value.trim();
        if (!promptText) {
            showAlert('Please enter a prompt to enhance.');
            return;
        }

        currentOptimizeTarget = targetId;
        optimizeOriginalPrompt.textContent = `"${promptText}"`;
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
                    showAlert(`Enhancement failed: ${error.detail}`);
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
});
