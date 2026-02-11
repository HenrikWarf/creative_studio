
export function activateSection(targetId) {
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-links li');

    const targetSection = document.getElementById(targetId);
    if (!targetSection) return;

    navLinks.forEach(l => l.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active-section'));

    const activeLink = document.querySelector(`.nav-links li[data-target="${targetId}"]`);
    if (activeLink) activeLink.classList.add('active');

    targetSection.classList.add('active-section');

    // Dispatch event for modules to listen to
    window.dispatchEvent(new CustomEvent('sectionActivated', { detail: { targetId } }));
}

export function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-links li');
    // Handle Hash Navigation
    if (window.location.hash) {
        const targetId = window.location.hash.substring(1);
        activateSection(targetId);
    } else {
        activateSection('home');
    }

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const targetId = link.getAttribute('data-target');
            activateSection(targetId);
        });
    });

    // Feature Links on Home Page
    const featureLinks = document.querySelectorAll('.feature-link');
    featureLinks.forEach(link => {
        link.addEventListener('click', () => {
            const targetId = link.getAttribute('data-target');
            activateSection(targetId);
        });
    });

    // Home Page Button
    const btnGoProjects = document.getElementById('btn-go-projects');
    if (btnGoProjects) {
        btnGoProjects.addEventListener('click', () => {
            document.querySelector('li[data-target="projects"]').click();
        });
    }
}
