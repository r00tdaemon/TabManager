document.addEventListener('DOMContentLoaded', () => {
  const findDuplicatesBtn = document.getElementById('findDuplicates');
  const closeDuplicatesBtn = document.getElementById('closeDuplicates');
  const selectAllBtn = document.getElementById('selectAll');
  const duplicateTabsContainer = document.getElementById('duplicateTabs');
  const actionButtons = document.querySelector('.action-buttons');
  let duplicateTabs = [];
  let isAllSelected = false;

  // Function to get the matching key based on selected option
  function getMatchingKey(url, matchType) {
    try {
      const urlObj = new URL(url);
      switch (matchType) {
        case 'domain':
          return urlObj.hostname;
        case 'path':
          return `${urlObj.hostname}${urlObj.pathname}`;
        case 'full':
          return url;
        default:
          return url;
      }
    } catch (e) {
      return url;
    }
  }

  // Function to find duplicate tabs
  async function findDuplicateTabs() {
    const matchType = document.querySelector('input[name="matchType"]:checked').value;
    const tabs = await chrome.tabs.query({});

    // Group tabs by their matching key
    const tabGroups = new Map();

    tabs.forEach(tab => {
      if (tab.url.startsWith('chrome://')) return; // Skip chrome:// URLs

      const key = getMatchingKey(tab.url, matchType);
      if (!tabGroups.has(key)) {
        tabGroups.set(key, []);
      }
      tabGroups.get(key).push(tab);
    });

    // Filter out groups with only one tab
    duplicateTabs = Array.from(tabGroups.entries())
      .filter(([_, tabs]) => tabs.length > 1)
      .map(([key, tabs]) => ({ key, tabs }));

    displayDuplicateTabs();
  }

  // Function to switch to a specific tab
  async function switchToTab(tabId) {
    await chrome.tabs.update(tabId, { active: true });
    window.close(); // Close the popup after switching
  }

  // Function to toggle tab selection
  function toggleTabSelection(tabElement, tabId) {
    const checkbox = tabElement.querySelector('input[type="checkbox"]');
    checkbox.checked = !checkbox.checked;
    tabElement.classList.toggle('selected', checkbox.checked);
    updateSelectAllButton();
  }

  // Function to update select all button state
  function updateSelectAllButton() {
    const checkboxes = document.querySelectorAll('.tab-item input[type="checkbox"]');
    const checkedBoxes = document.querySelectorAll('.tab-item input[type="checkbox"]:checked');
    isAllSelected = checkboxes.length > 0 && checkboxes.length === checkedBoxes.length;
    selectAllBtn.textContent = isAllSelected ? 'Deselect All' : 'Select All';
  }

  // Function to toggle all tabs selection
  function toggleAllTabs() {
    isAllSelected = !isAllSelected;
    const checkboxes = document.querySelectorAll('.tab-item input[type="checkbox"]');
    const tabItems = document.querySelectorAll('.tab-item');

    checkboxes.forEach((checkbox, index) => {
      checkbox.checked = isAllSelected;
      tabItems[index].classList.toggle('selected', isAllSelected);
    });

    selectAllBtn.textContent = isAllSelected ? 'Deselect All' : 'Select All';
  }

  // Function to display duplicate tabs
  function displayDuplicateTabs() {
    duplicateTabsContainer.innerHTML = '';

    if (duplicateTabs.length === 0) {
      duplicateTabsContainer.innerHTML = '<p>No duplicate tabs found.</p>';
      actionButtons.classList.add('hidden');
      return;
    }

    actionButtons.classList.remove('hidden');
    isAllSelected = false;
    selectAllBtn.textContent = 'Select All';

    duplicateTabs.forEach(group => {
      const groupElement = document.createElement('div');
      groupElement.className = 'tab-group';

      const groupTitle = document.createElement('h3');
      groupTitle.textContent = group.key;
      groupElement.appendChild(groupTitle);

      group.tabs.forEach(tab => {
        const tabElement = document.createElement('div');
        tabElement.className = 'tab-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = false;

        const favicon = document.createElement('img');
        favicon.src = tab.favIconUrl || 'default-favicon.png';
        favicon.onerror = () => favicon.src = 'default-favicon.png';

        const title = document.createElement('span');
        title.className = 'tab-title';
        title.textContent = tab.title;

        tabElement.appendChild(checkbox);
        tabElement.appendChild(favicon);
        tabElement.appendChild(title);

        // Add click handlers
        tabElement.addEventListener('click', (e) => {
          if (e.target !== checkbox) {
            toggleTabSelection(tabElement, tab.id);
          }
        });

        checkbox.addEventListener('change', () => {
          tabElement.classList.toggle('selected', checkbox.checked);
          updateSelectAllButton();
        });

        // Add double click handler to switch to tab
        tabElement.addEventListener('dblclick', () => {
          switchToTab(tab.id);
        });

        groupElement.appendChild(tabElement);
      });

      duplicateTabsContainer.appendChild(groupElement);
    });
  }

  // Function to close selected tabs
  async function closeSelectedTabs() {
    const selectedTabs = Array.from(document.querySelectorAll('.tab-item input[type="checkbox"]:checked'))
      .map(checkbox => {
        const tabElement = checkbox.closest('.tab-item');
        const tabId = parseInt(tabElement.dataset.tabId);
        return tabId;
      });

    if (selectedTabs.length > 0) {
      await chrome.tabs.remove(selectedTabs);
      findDuplicateTabs(); // Refresh the list
    }
  }

  // Event listeners
  findDuplicatesBtn.addEventListener('click', findDuplicateTabs);
  closeDuplicatesBtn.addEventListener('click', closeSelectedTabs);
  selectAllBtn.addEventListener('click', toggleAllTabs);
});
