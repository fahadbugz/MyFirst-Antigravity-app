// Global App State
let appState = {
    releases: [],
    selectedUpdates: [], // Array of { id, date, type, contentText, link }
    activeFilter: 'all',
    searchQuery: '',
    lastUpdated: null,
    composerData: {
        rawUpdates: [],
        currentText: '',
        currentStyle: 'hype'
    }
};

// DOM Elements
const elements = {
    btnRefresh: document.getElementById('btn-refresh'),
    btnExportCsv: document.getElementById('btn-export-csv'),
    iconRefresh: document.getElementById('icon-refresh'),
    iconSpinner: document.getElementById('icon-spinner'),
    syncTimeText: document.getElementById('sync-time-text'),
    
    // Stats
    statReleases: document.getElementById('stat-total-releases'),
    statFeatures: document.getElementById('stat-total-features'),
    statIssues: document.getElementById('stat-total-issues'),
    statDeprecations: document.getElementById('stat-total-deprecations'),
    
    // Filters & Search
    searchInput: document.getElementById('search-input'),
    searchClear: document.getElementById('search-clear'),
    filterTabsContainer: document.getElementById('filter-tabs-container'),
    feedContainer: document.getElementById('feed-container'),
    
    // Selection Bar
    selectionBar: document.getElementById('selection-bar'),
    selectionCount: document.getElementById('selection-count'),
    btnClearSelection: document.getElementById('btn-clear-selection'),
    btnTweetSelected: document.getElementById('btn-tweet-selected'),
    
    // Tweet Modal
    tweetModal: document.getElementById('tweet-modal'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    tweetCharCount: document.getElementById('tweet-char-count'),
    tweetCharProgress: document.getElementById('tweet-char-progress'),
    templateChipsContainer: document.getElementById('template-chips-container'),
    btnCopyTweet: document.getElementById('btn-copy-tweet'),
    copyBtnText: document.getElementById('copy-btn-text'),
    btnPostTweet: document.getElementById('btn-post-tweet'),
    
    // Toast
    toastContainer: document.getElementById('toast-container')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    fetchReleases(false); // Initial load (uses cache if fresh)
    
    // Update relative time helper every 30 seconds
    setInterval(updateRelativeSyncTime, 30000);
});

// Set up event handlers
function setupEventListeners() {
    // Refresh Button
    elements.btnRefresh.addEventListener('click', () => fetchReleases(true));
    
    // Export CSV
    elements.btnExportCsv.addEventListener('click', exportFilteredToCSV);
    
    // Search
    elements.searchInput.addEventListener('input', handleSearchInput);
    elements.searchClear.addEventListener('click', clearSearch);
    
    // Filters
    elements.filterTabsContainer.addEventListener('click', handleFilterClick);
    
    // Selection Actions
    elements.btnClearSelection.addEventListener('click', clearSelection);
    elements.btnTweetSelected.addEventListener('click', () => {
        openTweetModal(appState.selectedUpdates);
    });
    
    // Modal controls
    elements.btnCloseModal.addEventListener('click', closeTweetModal);
    elements.tweetModal.addEventListener('click', (e) => {
        if (e.target === elements.tweetModal) closeTweetModal();
    });
    
    // Tweet Composer changes
    elements.tweetTextarea.addEventListener('input', handleComposerInput);
    
    // Template chips
    elements.templateChipsContainer.addEventListener('click', handleTemplateClick);
    
    // Share actions
    elements.btnCopyTweet.addEventListener('click', copyTweetToClipboard);
    elements.btnPostTweet.addEventListener('click', postTweetToTwitter);
}

// Fetch Releases from API
async function fetchReleases(forceRefresh = false) {
    showLoadingState(true);
    
    try {
        const url = `/api/releases${forceRefresh ? '?force_refresh=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        appState.releases = data.releases || [];
        appState.lastUpdated = data.last_updated ? new Date(data.last_updated) : new Date();
        
        if (data.warning) {
            showToast(data.warning, 'error');
        } else if (forceRefresh) {
            showToast('Feed refreshed successfully!', 'success');
        }
        
        // Clear selection on full reload
        clearSelection();
        
        // Render stats & feed
        updateStats();
        renderFeed();
        updateRelativeSyncTime();
        
    } catch (error) {
        console.error('Failed fetching release notes:', error);
        showToast('Error syncing with BigQuery release feed.', 'error');
        renderErrorState();
    } finally {
        showLoadingState(false);
    }
}

// Show/Hide Loading Spinner
function showLoadingState(isLoading) {
    if (isLoading) {
        elements.iconRefresh.classList.add('hide');
        elements.iconSpinner.classList.remove('hide');
        elements.btnRefresh.disabled = true;
        elements.syncTimeText.innerText = "Syncing with BigQuery...";
        
        // If first load, show skeletons
        if (appState.releases.length === 0) {
            renderSkeletons();
        }
    } else {
        elements.iconRefresh.classList.remove('hide');
        elements.iconSpinner.classList.add('hide');
        elements.btnRefresh.disabled = false;
    }
}

// Render Skeletons during loading
function renderSkeletons() {
    let skeletonHTML = '';
    for (let i = 0; i < 3; i++) {
        skeletonHTML += `
            <div class="skeleton-day">
                <div class="skeleton-title"></div>
                <div class="skeleton-badge"></div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line short"></div>
            </div>
        `;
    }
    elements.feedContainer.innerHTML = skeletonHTML;
}

// Render Error State
function renderErrorState() {
    elements.feedContainer.innerHTML = `
        <div class="error-state">
            <div class="state-icon-circle">
                <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
            </div>
            <h3 class="state-title">Failed to load feed</h3>
            <p class="state-desc">We encountered an issue downloading the Google Cloud release feed. Please try again in a few moments.</p>
            <button class="btn btn-primary" onclick="fetchReleases(true)">Retry Connection</button>
        </div>
    `;
}

// Relative Sync Time Update
function updateRelativeSyncTime() {
    if (!appState.lastUpdated) return;
    
    const now = new Date();
    const diffMs = now - appState.lastUpdated;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    
    let timeText = '';
    if (diffSecs < 10) {
        timeText = 'Synced just now';
    } else if (diffSecs < 60) {
        timeText = `Synced ${diffSecs}s ago`;
    } else if (diffMins === 1) {
        timeText = 'Synced 1 min ago';
    } else {
        timeText = `Synced ${diffMins} mins ago`;
    }
    
    elements.syncTimeText.innerText = timeText;
}

// Calculate Stats for Dashboard Panel
function updateStats() {
    let totalDays = appState.releases.length;
    let totalFeatures = 0;
    let totalIssues = 0;
    let totalDeprecations = 0;
    
    appState.releases.forEach(day => {
        day.updates.forEach(update => {
            const type = update.type.toLowerCase();
            if (type.includes('feature')) totalFeatures++;
            else if (type.includes('issue') || type.includes('bug') || type.includes('fix')) totalIssues++;
            else if (type.includes('deprecation') || type.includes('breaking')) totalDeprecations++;
        });
    });
    
    elements.statReleases.innerText = totalDays;
    elements.statFeatures.innerText = totalFeatures;
    elements.statIssues.innerText = totalIssues;
    elements.statDeprecations.innerText = totalDeprecations;
}

// Filter Clicks Handler
function handleFilterClick(e) {
    const tab = e.target.closest('.filter-tab');
    if (!tab) return;
    
    // Toggle active classes
    const tabs = elements.filterTabsContainer.querySelectorAll('.filter-tab');
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    appState.activeFilter = tab.dataset.filter;
    renderFeed();
}

// Search Inputs Handler
function handleSearchInput(e) {
    appState.searchQuery = e.target.value.trim().toLowerCase();
    
    if (appState.searchQuery) {
        elements.searchClear.classList.remove('hide');
    } else {
        elements.searchClear.classList.add('hide');
    }
    
    renderFeed();
}

// Clear Search box
function clearSearch() {
    elements.searchInput.value = '';
    appState.searchQuery = '';
    elements.searchClear.classList.add('hide');
    renderFeed();
}

// Helper: Check if string matches search
function textMatchesSearch(text, query) {
    return text.toLowerCase().includes(query);
}

// Render Release Feed
function renderFeed() {
    if (appState.releases.length === 0) {
        renderSkeletons();
        return;
    }
    
    let feedHTML = '';
    let renderedCount = 0;
    
    appState.releases.forEach((day, dayIndex) => {
        // Filter updates in this day card
        const filteredUpdates = day.updates.filter(update => {
            // Filter by type
            const matchesFilter = appState.activeFilter === 'all' || 
                                 update.type.toLowerCase() === appState.activeFilter.toLowerCase() ||
                                 (appState.activeFilter === 'General' && 
                                  !['feature', 'issue', 'deprecation'].includes(update.type.toLowerCase()));
            
            // Filter by search query
            const matchesSearch = !appState.searchQuery || 
                                 textMatchesSearch(update.type, appState.searchQuery) || 
                                 textMatchesSearch(update.content_text, appState.searchQuery) ||
                                 textMatchesSearch(day.date, appState.searchQuery);
                                 
            return matchesFilter && matchesSearch;
        });
        
        // If day has matching updates, render the day card
        if (filteredUpdates.length > 0) {
            renderedCount++;
            
            // Render Day Header
            let dayCardHTML = `
                <div class="day-card" id="day-card-${dayIndex}">
                    <div class="day-header">
                        <div class="day-title-section">
                            <svg class="calendar-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            <span class="day-title">${day.date}</span>
                        </div>
                        <a href="${day.link}" target="_blank" class="btn-link-out" title="Open original release notes">
                            <span>Official Docs</span>
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                        </a>
                    </div>
                    <div class="updates-list">
            `;
            
            // Render individual update items
            filteredUpdates.forEach((update, updateIndex) => {
                const itemId = `${dayIndex}-${updateIndex}`;
                const isSelected = isUpdateSelected(itemId);
                
                // Set Badge Style Class
                let badgeClass = 'badge-general';
                const lowerType = update.type.toLowerCase();
                if (lowerType.includes('feature')) badgeClass = 'badge-feature';
                else if (lowerType.includes('issue') || lowerType.includes('bug')) badgeClass = 'badge-issue';
                else if (lowerType.includes('deprecation')) badgeClass = 'badge-deprecation';
                
                dayCardHTML += `
                    <div class="update-item ${isSelected ? 'selected' : ''}" 
                         data-item-id="${itemId}" 
                         data-date="${day.date}"
                         data-link="${day.link}">
                         
                        <div class="update-checkbox-container">
                            <div class="custom-checkbox">
                                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </div>
                        </div>
                        
                        <div class="update-details">
                            <div class="update-meta-row">
                                <span class="type-badge ${badgeClass}">${update.type}</span>
                                <div class="update-actions">
                                    <button class="btn-action-copy" data-item-id="${itemId}" title="Copy description to clipboard">
                                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                        </svg>
                                    </button>
                                    <button class="btn-action-tweet" data-item-id="${itemId}" title="Tweet this update">
                                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <div class="update-body">
                                ${update.content_html}
                            </div>
                        </div>
                    </div>
                `;
            });
            
            dayCardHTML += `
                    </div>
                </div>
            `;
            
            feedHTML += dayCardHTML;
        }
    });
    
    if (renderedCount === 0) {
        renderEmptyState();
    } else {
        elements.feedContainer.innerHTML = feedHTML;
        setupFeedItemEvents();
    }
}

// Render Empty Results State
function renderEmptyState() {
    elements.feedContainer.innerHTML = `
        <div class="empty-state">
            <div class="state-icon-circle">
                <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
            </div>
            <h3 class="state-title">No matching updates</h3>
            <p class="state-desc">We couldn't find any release notes matching your search or selected filter. Try adjusting your query or tabs.</p>
            <button class="btn btn-outline" onclick="clearFiltersAndSearch()">Clear Filters & Search</button>
        </div>
    `;
}

function clearFiltersAndSearch() {
    clearSearch();
    const tabs = elements.filterTabsContainer.querySelectorAll('.filter-tab');
    tabs.forEach(t => t.classList.remove('active'));
    tabs[0].classList.add('active');
    appState.activeFilter = 'all';
    renderFeed();
}

// Bind events to dynamically rendered feed items
function setupFeedItemEvents() {
    const updateItems = elements.feedContainer.querySelectorAll('.update-item');
    
    updateItems.forEach(item => {
        // Toggle selection on clicking item card (excluding links or buttons)
        item.addEventListener('click', (e) => {
            if (e.target.closest('a') || e.target.closest('.btn-action-tweet') || e.target.closest('.btn-action-copy')) {
                return; // Let links and actions handle themselves
            }
            toggleUpdateSelection(item);
        });
        
        // Click single copy button
        const copyBtn = item.querySelector('.btn-action-copy');
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const itemId = copyBtn.dataset.itemId;
            const singleUpdate = getUpdateDetailsByItemId(itemId);
            if (singleUpdate) {
                copyTextToClipboard(singleUpdate.contentText, 'Update description copied!');
            }
        });
        
        // Click single tweet button
        const tweetBtn = item.querySelector('.btn-action-tweet');
        tweetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const itemId = tweetBtn.dataset.itemId;
            const singleUpdate = getUpdateDetailsByItemId(itemId);
            if (singleUpdate) {
                openTweetModal([singleUpdate]);
            }
        });
    });
}

// Check if update is currently selected in app state
function isUpdateSelected(itemId) {
    return appState.selectedUpdates.some(u => u.id === itemId);
}

// Toggle Selection of Update
function toggleUpdateSelection(itemEl) {
    const itemId = itemEl.dataset.itemId;
    const date = itemEl.dataset.date;
    const link = itemEl.dataset.link;
    const type = itemEl.querySelector('.type-badge').innerText;
    
    // Find text node inside detail body
    const contentText = itemEl.querySelector('.update-body').innerText.trim();
    
    if (isUpdateSelected(itemId)) {
        // Remove selection
        appState.selectedUpdates = appState.selectedUpdates.filter(u => u.id !== itemId);
        itemEl.classList.remove('selected');
    } else {
        // Add selection
        appState.selectedUpdates.push({
            id: itemId,
            date: date,
            type: type,
            contentText: contentText,
            link: link
        });
        itemEl.classList.add('selected');
    }
    
    updateSelectionBar();
}

// Update floating selection bottom bar state
function updateSelectionBar() {
    const count = appState.selectedUpdates.length;
    elements.selectionCount.innerText = count;
    
    if (count > 0) {
        elements.selectionBar.classList.add('show');
    } else {
        elements.selectionBar.classList.remove('show');
    }
}

// Clear all select states
function clearSelection() {
    appState.selectedUpdates = [];
    updateSelectionBar();
    
    const items = elements.feedContainer.querySelectorAll('.update-item');
    items.forEach(item => item.classList.remove('selected'));
}

// Find a single update's details by its structural itemId (e.g. "0-2")
function getUpdateDetailsByItemId(itemId) {
    const [dayIndex, updateIndex] = itemId.split('-').map(Number);
    const day = appState.releases[dayIndex];
    if (!day) return null;
    
    const update = day.updates[updateIndex];
    if (!update) return null;
    
    return {
        id: itemId,
        date: day.date,
        type: update.type,
        contentText: update.content_text.trim(),
        link: day.link
    };
}

/* Tweet Generation and Template logic */

function openTweetModal(updatesArray) {
    if (updatesArray.length === 0) return;
    
    appState.composerData.rawUpdates = updatesArray;
    
    // Highlight default template chip
    const chips = elements.templateChipsContainer.querySelectorAll('.chip');
    chips.forEach(c => c.classList.remove('active'));
    
    const defaultStyleChip = Array.from(chips).find(c => c.dataset.style === appState.composerData.currentStyle);
    if (defaultStyleChip) defaultStyleChip.classList.add('active');
    
    generateTweetText();
    elements.tweetModal.classList.remove('hide');
    // Trigger fade in layout
    setTimeout(() => {
        elements.tweetModal.classList.add('show');
        elements.tweetTextarea.focus();
    }, 10);
}

function closeTweetModal() {
    elements.tweetModal.classList.remove('show');
    setTimeout(() => {
        elements.tweetModal.classList.add('hide');
    }, 300);
}

function handleComposerInput(e) {
    appState.composerData.currentText = e.target.value;
    updateComposerLengthDetails();
}

function handleTemplateClick(e) {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    
    const chips = elements.templateChipsContainer.querySelectorAll('.chip');
    chips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    
    appState.composerData.currentStyle = chip.dataset.style;
    generateTweetText();
}

// Generate text content using templates based on selections
function generateTweetText() {
    const updates = appState.composerData.rawUpdates;
    const style = appState.composerData.currentStyle;
    let text = '';
    
    if (updates.length === 1) {
        // Single update templates
        const update = updates[0];
        const date = update.date;
        const type = update.type.toUpperCase();
        
        // Clean description to avoid giant text
        let desc = update.contentText;
        if (desc.length > 180) {
            desc = desc.substring(0, 177) + '...';
        }
        
        switch (style) {
            case 'hype':
                text = `🔥 NEW BIGQUERY UPDATE! 🚀\n\n📢 [${type}] (${date}):\n"${desc}"\n\nLearn more details 👇\n${update.link}\n\n#BigQuery #GoogleCloud #DataOps`;
                break;
            case 'dev':
                text = `💻 BigQuery Release - ${update.type} (${date}):\n\n${desc}\n\n🔗 Documentation: ${update.link}\n\n#BigQuery #DataEngineering #GCP`;
                break;
            case 'minimal':
                text = `BigQuery [${update.type}] (${date}):\n${desc}\n\n${update.link}`;
                break;
            case 'formal':
                text = `Google Cloud has released a new ${update.type} update for BigQuery (${date}).\n\nDetail: ${desc}\n\nFor official documentation, visit:\n${update.link}\n\n#GoogleCloud #BigQuery`;
                break;
        }
    } else {
        // Multi update templates
        // Extract unique dates or date range
        const dates = [...new Set(updates.map(u => u.date))];
        const dateHeader = dates.length === 1 ? dates[0] : `${dates[dates.length - 1]} - ${dates[0]}`;
        
        // Create bullet lists (maximum 3 bullet points to fit tweet limits)
        let bullets = '';
        updates.slice(0, 3).forEach(u => {
            let desc = u.contentText;
            if (desc.length > 55) {
                desc = desc.substring(0, 52) + '...';
            }
            bullets += `• [${u.type}] ${desc}\n`;
        });
        
        if (updates.length > 3) {
            bullets += `• And ${updates.length - 3} more updates...\n`;
        }
        
        // General link is the first one's parent link
        const generalLink = updates[0].link;
        
        switch (style) {
            case 'hype':
                text = `🔥 BIGQUERY RELEASES ROUNDUP! 🚀\n\nUpdates from ${dateHeader}:\n${bullets}\nRead the full notes here 👇\n${generalLink}\n\n#BigQuery #GoogleCloud #DataEng`;
                break;
            case 'dev':
                text = `💻 BigQuery Updates Summary (${dateHeader}):\n\n${bullets}\n🔗 Docs: ${generalLink}\n\n#BigQuery #GCP #DataOps`;
                break;
            case 'minimal':
                text = `BigQuery Updates (${dateHeader}):\n\n${bullets}\n${generalLink}`;
                break;
            case 'formal':
                text = `Summary of recent Google Cloud BigQuery developments (${dateHeader}):\n\n${bullets}\nRead details in full release notes:\n${generalLink}\n\n#GoogleCloud #BigQuery`;
                break;
        }
    }
    
    elements.tweetTextarea.value = text;
    appState.composerData.currentText = text;
    updateComposerLengthDetails();
}

// Compute accurate Twitter text length (Twitter links are exactly 23 chars)
function calculateTwitterLength(text) {
    const urlRegex = /https?:\/\/[^\s]+/g;
    let length = text.length;
    const urls = text.match(urlRegex);
    if (urls) {
        for (const url of urls) {
            length = length - url.length + 23;
        }
    }
    return length;
}

// Handle character calculations & counter bar
function updateComposerLengthDetails() {
    const text = appState.composerData.currentText;
    const tweetLen = calculateTwitterLength(text);
    
    elements.tweetCharCount.innerText = `${tweetLen} / 280`;
    
    // Character Limit bar calculation
    const pct = Math.min((tweetLen / 280) * 100, 100);
    elements.tweetCharProgress.style.width = `${pct}%`;
    
    // Warning thresholds
    elements.tweetCharCount.classList.remove('warning', 'danger');
    elements.tweetCharProgress.classList.remove('warning', 'danger');
    elements.btnPostTweet.disabled = false;
    
    if (tweetLen > 280) {
        elements.tweetCharCount.classList.add('danger');
        elements.tweetCharProgress.classList.add('danger');
        elements.btnPostTweet.disabled = true; // Disable posting if over limit
    } else if (tweetLen > 250) {
        elements.tweetCharCount.classList.add('warning');
        elements.tweetCharProgress.classList.add('warning');
    }
}

// Copy constructed tweet to clipboard
async function copyTweetToClipboard() {
    const text = elements.tweetTextarea.value;
    
    try {
        await navigator.clipboard.writeText(text);
        
        // Toggle copy button UI states
        elements.copyBtnText.innerText = 'Copied!';
        elements.btnCopyTweet.classList.add('btn-primary');
        elements.btnCopyTweet.classList.remove('btn-outline');
        
        showToast('Tweet copied to clipboard!', 'success');
        
        setTimeout(() => {
            elements.copyBtnText.innerText = 'Copy Text';
            elements.btnCopyTweet.classList.remove('btn-primary');
            elements.btnCopyTweet.classList.add('btn-outline');
        }, 2000);
        
    } catch (err) {
        console.error('Copy to clipboard failed:', err);
        showToast('Failed to copy text.', 'error');
    }
}

// Redirect client to open Twitter intent
function postTweetToTwitter() {
    const text = elements.tweetTextarea.value;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank');
    closeTweetModal();
    clearSelection();
}

// Copy generic text content to clipboard
async function copyTextToClipboard(text, successMsg = 'Copied to clipboard!') {
    try {
        await navigator.clipboard.writeText(text);
        showToast(successMsg, 'success');
        return true;
    } catch (err) {
        console.error('Copy to clipboard failed:', err);
        showToast('Failed to copy text.', 'error');
        return false;
    }
}

// Export currently filtered updates list to a CSV file
function exportFilteredToCSV() {
    if (appState.releases.length === 0) {
        showToast('No data available to export.', 'error');
        return;
    }
    
    const csvRows = [];
    // CSV headers
    csvRows.push(['Date', 'Type', 'Description', 'Link'].map(escapeCSV).join(','));
    
    let exportCount = 0;
    appState.releases.forEach(day => {
        day.updates.forEach(update => {
            // Apply current filters
            const matchesFilter = appState.activeFilter === 'all' || 
                                 update.type.toLowerCase() === appState.activeFilter.toLowerCase() ||
                                 (appState.activeFilter === 'General' && 
                                  !['feature', 'issue', 'deprecation'].includes(update.type.toLowerCase()));
            
            const matchesSearch = !appState.searchQuery || 
                                   textMatchesSearch(update.type, appState.searchQuery) || 
                                   textMatchesSearch(update.content_text, appState.searchQuery) ||
                                   textMatchesSearch(day.date, appState.searchQuery);
                                   
            if (matchesFilter && matchesSearch) {
                csvRows.push([
                    day.date,
                    update.type,
                    update.content_text.trim(),
                    day.link
                ].map(escapeCSV).join(','));
                exportCount++;
            }
        });
    });
    
    if (exportCount === 0) {
        showToast('No matching updates to export.', 'error');
        return;
    }
    
    // Generate blob and download link
    const csvContent = "\uFEFF" + csvRows.join("\n"); // UTF-8 BOM for Excel compatibility
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    // Dynamic filename based on current filter states
    let filename = 'bigquery_releases';
    if (appState.activeFilter !== 'all') {
        filename += `_${appState.activeFilter.toLowerCase()}`;
    }
    if (appState.searchQuery) {
        filename += `_search`;
    }
    filename += `_${new Date().toISOString().slice(0, 10)}.csv`;
    
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(`Successfully exported ${exportCount} rows to CSV!`, 'success');
}

// Escape values for CSV compatibility
function escapeCSV(val) {
    if (val === undefined || val === null) return '';
    let str = String(val);
    if (str.includes(',') || str.includes('\n') || str.includes('"') || str.includes('\r')) {
        str = str.replace(/"/g, '""');
        return `"${str}"`;
    }
    return str;
}

/* Toast Notifications System */
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Icon based on toast type
    let iconHTML = '';
    if (type === 'success') {
        iconHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
        `;
    } else {
        iconHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
        `;
    }
    
    toast.innerHTML = `
        ${iconHTML}
        <span>${message}</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Animate out & remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 350);
    }, 3000);
}
