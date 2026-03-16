// CMS logica voor artikelbeheer en statistieken

// Statistieken ophalen en tonen
async function loadStats() {
    const statsContainer = document.getElementById('stats-container');
    statsContainer.innerHTML = 'Statistieken laden...';
    try {
        const res = await fetch(`${API_BASE_URL}/stats`);
        const stats = await res.json();
        const views = stats.viewsPerArticle || [];
        const maxViews = Math.max(1, ...views.map(a => a.views || 0));
        statsContainer.innerHTML = `
            <div class="stats-cards">
                <div class="stats-card">
                    <div class="stats-label">Meeste bezoekers (laatste 7 dagen)</div>
                    <div class="stats-value">${stats.mostVisited.title} <span>(${stats.mostVisited.views})</span></div>
                </div>
                <div class="stats-card">
                    <div class="stats-label">Totaal aantal bezoekers</div>
                    <div class="stats-value">${stats.totalViews}</div>
                </div>
                <div class="stats-card">
                    <div class="stats-label">Meest aangeklikte artikel</div>
                    <div class="stats-value">${stats.mostClicked.title} <span>(${stats.mostClicked.clicks})</span></div>
                </div>
            </div>
            <div class="views-section">
                <h3>Views per artikel</h3>
                <div class="views-list">
                    ${views.map(a => {
                        const safeViews = a.views || 0;
                        const pct = Math.round((safeViews / maxViews) * 100);
                        return `
                            <div class="views-item">
                                <div class="views-title">${a.title}</div>
                                <div class="views-bar">
                                    <div class="views-bar-fill" style="width:${pct}%"></div>
                                </div>
                                <div class="views-value">${safeViews}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    } catch (e) {
        statsContainer.innerHTML = 'Fout bij laden van statistieken.';
    }
}

// Artikels ophalen en tonen
async function loadArticles() {
    const container = document.getElementById('articles-container');
    container.innerHTML = 'Artikels laden...';
    try {
        const res = await fetch(`${API_BASE_URL}/articles`);
        const articles = await res.json();
        container.innerHTML = articles.map(article => `
            <div class="cms-article-card">
                <h3><a class="cms-article-link" href="/article/${article.id}" target="_blank" rel="noopener">${article.title}</a></h3>
                <button onclick="editArticle('${article.id}')">Aanpassen</button>
                <a class="cms-button cms-button-small" href="/article/${article.id}" target="_blank" rel="noopener">Bekijk</a>
                <button onclick="deleteArticle('${article.id}')">Verwijderen</button>
                <span>Views: ${article.views} | Clicks: ${article.clicks}</span>
            </div>
        `).join('');
    } catch (e) {
        container.innerHTML = 'Fout bij laden van artikels.';
    }
}

// Artikel aanpassen
window.editArticle = function(id) {
    window.location.href = `cms-edit.html?id=${encodeURIComponent(id)}`;
}

// Artikel verwijderen
window.deleteArticle = async function(id) {
    if (!confirm('Weet je zeker dat je dit artikel wilt verwijderen?')) return;
    try {
        await fetch(`${API_BASE_URL}/articles/${id}`, { method: 'DELETE' });
        loadArticles();
    } catch (e) {
        alert('Fout bij verwijderen.');
    }
}

// Nieuw artikel toevoegen
const addBtn = document.getElementById('add-article-btn');
if (addBtn) {
    addBtn.onclick = () => {
        window.location.href = 'cms-create.html';
    };
}

// Init
async function loadHomepageSettings() {
    const statusEl = document.getElementById('homepage-status');
    try {
        const res = await fetch(`${API_BASE_URL}/site`);
        if (!res.ok) {
            throw new Error('Instellingen niet gevonden');
        }
        const data = await res.json();
        document.getElementById('newsletterTitleInput').value = data.newsletterTitle || '';
        document.getElementById('newsletterTextInput').value = data.newsletterText || '';
        document.getElementById('newsletterButtonTextInput').value = data.newsletterButtonText || '';
        document.getElementById('newsletterButtonLinkInput').value = data.newsletterButtonLink || '';
        document.getElementById('workshopTitleInput').value = data.workshopTitle || '';
        document.getElementById('workshopTextInput').value = data.workshopText || '';
        document.getElementById('workshopButtonTextInput').value = data.workshopButtonText || '';
        document.getElementById('workshopButtonLinkInput').value = data.workshopButtonLink || '';
        if (statusEl) statusEl.textContent = '';
    } catch (e) {
        if (statusEl) statusEl.textContent = 'Fout bij laden van homepage instellingen.';
    }
}

async function saveHomepageSettings() {
    const statusEl = document.getElementById('homepage-status');
    if (statusEl) statusEl.textContent = 'Opslaan...';
    const payload = {
        newsletterTitle: document.getElementById('newsletterTitleInput').value.trim(),
        newsletterText: document.getElementById('newsletterTextInput').value.trim(),
        newsletterButtonText: document.getElementById('newsletterButtonTextInput').value.trim(),
        newsletterButtonLink: document.getElementById('newsletterButtonLinkInput').value.trim(),
        workshopTitle: document.getElementById('workshopTitleInput').value.trim(),
        workshopText: document.getElementById('workshopTextInput').value.trim(),
        workshopButtonText: document.getElementById('workshopButtonTextInput').value.trim(),
        workshopButtonLink: document.getElementById('workshopButtonLinkInput').value.trim()
    };
    try {
        const res = await fetch(`${API_BASE_URL}/site`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            throw new Error('Opslaan mislukt');
        }
        if (statusEl) statusEl.textContent = 'Opgeslagen.';
    } catch (e) {
        if (statusEl) statusEl.textContent = 'Fout bij opslaan.';
    }
}

const saveHomepageBtn = document.getElementById('save-homepage-btn');
if (saveHomepageBtn) {
    saveHomepageBtn.addEventListener('click', saveHomepageSettings);
}

loadStats();
loadArticles();
loadHomepageSettings();
