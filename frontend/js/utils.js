
export function base64ToBlob(b64Data, contentType = '', sliceSize = 512) {
    const byteCharacters = atob(b64Data);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
}

export function updateToggleIcon(isLight) {
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (!themeToggleBtn) return;
    const icon = themeToggleBtn.querySelector('i');
    const text = themeToggleBtn.querySelector('span');

    if (isLight) {
        icon.className = 'fa-solid fa-sun';
        text.textContent = 'Light Mode';
    } else {
        icon.className = 'fa-solid fa-moon';
        text.textContent = 'Dark Mode';
    }
}

export function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('[id^="tab-"]').forEach(tab => tab.hidden = true);

    const btn = document.querySelector(`button[onclick="switchTab('${tabName}')"]`)
        || document.querySelector(`.tab-btn[data-tab="${tabName}"]`);

    if (btn) btn.classList.add('active');

    const tab = document.getElementById(`tab-${tabName}`) || document.getElementById(tabName);
    if (tab) tab.hidden = false;

    // Persist to localStorage
    localStorage.setItem('activeTab', tabName);
}

export function initTabState() {
    const activeTab = localStorage.getItem('activeTab');
    if (activeTab) {
        switchTab(activeTab);
    } else {
        // Default Tab (e.g. Projects or Home if set)
        switchTab('projects');
    }
}

export function showAlert(message) {
    const alertMessage = document.getElementById('alert-message');
    const alertModal = document.getElementById('alert-modal');

    if (alertMessage) alertMessage.textContent = message;
    if (alertModal) alertModal.hidden = false;
}

export function closeAlertModal() {
    const alertModal = document.getElementById('alert-modal');
    if (alertModal) alertModal.hidden = true;
}

export function setLoading(btn, isLoading) {
    if (!btn) return;
    if (isLoading) {
        btn.disabled = true;
        if (!btn.dataset.originalText) {
            btn.dataset.originalText = btn.innerHTML;
        }
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
    } else {
        btn.disabled = false;
        if (btn.dataset.originalText) {
            btn.innerHTML = btn.dataset.originalText;
        }
    }
}

export function downloadImage(dataUrl, filename) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
// Expose for inline handlers
window.downloadImage = downloadImage;
window.switchTab = switchTab;
window.closeAlertModal = closeAlertModal;
window.showAlert = showAlert;
