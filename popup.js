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
    // Get the tab to find its window ID
    const tab = await chrome.tabs.get(tabId);

    // First update the window to be focused
    await chrome.windows.update(tab.windowId, { focused: true });

    // Then update the tab to be active
    await chrome.tabs.update(tabId, { active: true });

    window.close(); // Close the popup after switching
  }

  // Function to toggle tab selection
  function toggleTabSelection(tabElement, tabId) {
    const checkbox = tabElement.querySelector('input[type="checkbox"]');
    checkbox.checked = !checkbox.checked;
    tabElement.classList.toggle('selected', checkbox.checked);
    updateSelectAllButton();

    // Update the group checkbox if all tabs in the group are selected
    const groupElement = tabElement.closest('.tab-group');
    updateGroupCheckbox(groupElement);
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
    const groupCheckboxes = document.querySelectorAll('.tab-group-header input[type="checkbox"]');

    checkboxes.forEach((checkbox, index) => {
      checkbox.checked = isAllSelected;
      tabItems[index].classList.toggle('selected', isAllSelected);
    });

    // Update all group checkboxes to match the select all state
    groupCheckboxes.forEach(checkbox => {
      checkbox.checked = isAllSelected;
    });

    selectAllBtn.textContent = isAllSelected ? 'Deselect All' : 'Select All';
  }

  // Function to toggle group selection
  function toggleGroupSelection(groupElement) {
    const tabItems = groupElement.querySelectorAll('.tab-item');
    const checkboxes = groupElement.querySelectorAll('.tab-item input[type="checkbox"]');
    const groupCheckbox = groupElement.querySelector('.tab-group-header input[type="checkbox"]');

    // Check if all tabs in the group are selected
    const allSelected = Array.from(checkboxes).every(checkbox => checkbox.checked);

    // Toggle selection
    checkboxes.forEach(checkbox => {
      checkbox.checked = !allSelected;
    });

    tabItems.forEach(tabItem => {
      tabItem.classList.toggle('selected', !allSelected);
    });

    // Update group checkbox
    groupCheckbox.checked = !allSelected;
    groupCheckbox.indeterminate = false;

    // Update global select all button state
    updateSelectAllButton();
  }

  // Function to update group checkbox based on its tab selections
  function updateGroupCheckbox(groupElement) {
    const groupCheckbox = groupElement.querySelector('.tab-group-header input[type="checkbox"]');
    const tabCheckboxes = groupElement.querySelectorAll('.tab-item input[type="checkbox"]');
    const allChecked = Array.from(tabCheckboxes).every(checkbox => checkbox.checked);
    const someChecked = Array.from(tabCheckboxes).some(checkbox => checkbox.checked);

    // Update the group checkbox state
    groupCheckbox.checked = allChecked;
    groupCheckbox.indeterminate = someChecked && !allChecked;
  }

  // Function to display duplicate tabs
  function displayDuplicateTabs() {
    duplicateTabsContainer.innerHTML = '';

    if (duplicateTabs.length === 0) {
      duplicateTabsContainer.classList.remove('hidden');
      duplicateTabsContainer.innerHTML = '<p>No duplicate tabs found.</p>';
      actionButtons.classList.add('hidden');
      return;
    }

    duplicateTabsContainer.classList.remove('hidden');
    actionButtons.classList.remove('hidden');
    isAllSelected = false;
    selectAllBtn.textContent = 'Select All';

    duplicateTabs.forEach(group => {
      const groupElement = document.createElement('div');
      groupElement.className = 'tab-group';

      const groupHeader = document.createElement('div');
      groupHeader.className = 'tab-group-header';

      const groupCheckbox = document.createElement('input');
      groupCheckbox.type = 'checkbox';
      groupCheckbox.checked = false;
      groupCheckbox.addEventListener('change', () => toggleGroupSelection(groupElement));

      const groupTitle = document.createElement('h3');
      groupTitle.textContent = group.key;
      groupTitle.title = group.key; // Add tooltip with full text

      groupHeader.appendChild(groupCheckbox);
      groupHeader.appendChild(groupTitle);
      groupElement.appendChild(groupHeader);

      // Group tabs by Chrome tab group
      const tabsByChromeGroup = new Map();

      // First, organize tabs by their Chrome tab group
      group.tabs.forEach(tab => {
        const chromeGroupId = tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE ? 'ungrouped' : tab.groupId;
        if (!tabsByChromeGroup.has(chromeGroupId)) {
          tabsByChromeGroup.set(chromeGroupId, []);
        }
        tabsByChromeGroup.get(chromeGroupId).push(tab);
      });

      // Display tabs grouped by Chrome tab group
      tabsByChromeGroup.forEach((tabs, chromeGroupId) => {
        // Check if this is the only group and it's ungrouped
        const isOnlyUngrouped = tabsByChromeGroup.size === 1 && chromeGroupId === 'ungrouped';

        // Create a sub-group for Chrome tab groups
        if (chromeGroupId !== 'ungrouped') {
          const chromeGroupHeader = document.createElement('div');
          chromeGroupHeader.className = 'chrome-group-header';

          // Get the tab group title if available
          const chromeGroupTitle = document.createElement('h4');
          chromeGroupTitle.className = 'chrome-group-title';

          // Try to get the tab group title, but handle errors gracefully
          try {
            chrome.tabGroups.get(parseInt(chromeGroupId))
              .then(tabGroup => {
                chromeGroupTitle.textContent = tabGroup.title || 'Unnamed Group';
                // Apply the tab group color to the title
                if (tabGroup.color) {
                  chromeGroupTitle.style.backgroundColor = `var(--${tabGroup.color}-color)`;
                }
              })
              .catch(() => {
                chromeGroupTitle.textContent = 'Chrome Group';
              });
          } catch (error) {
            // If there's any error accessing tab groups, just show a generic label
            chromeGroupTitle.textContent = 'Chrome Group';
          }

          chromeGroupHeader.appendChild(chromeGroupTitle);
          groupElement.appendChild(chromeGroupHeader);
        } else if (!isOnlyUngrouped) {
          // For ungrouped tabs, add a header only if it's not the only group
          const ungroupedHeader = document.createElement('div');
          ungroupedHeader.className = 'chrome-group-header';
          const ungroupedTitle = document.createElement('h4');
          ungroupedTitle.textContent = 'Ungrouped';
          ungroupedTitle.className = 'chrome-group-title';
          ungroupedHeader.appendChild(ungroupedTitle);
          groupElement.appendChild(ungroupedHeader);
        }

        // Create a container for all tabs in this Chrome group
        const chromeGroupContainer = document.createElement('div');
        chromeGroupContainer.className = 'chrome-group-container';

        // If it's the only ungrouped group, remove the indentation
        if (isOnlyUngrouped) {
          chromeGroupContainer.classList.add('no-indent');
        }

        groupElement.appendChild(chromeGroupContainer);

        // Add tabs to this Chrome group
        tabs.forEach(tab => {
          const tabElement = document.createElement('div');
          tabElement.className = 'tab-item';
          tabElement.dataset.tabId = tab.id;

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = false;

          const favicon = document.createElement('img');
          favicon.src = tab.favIconUrl || 'default-favicon.png';
          favicon.onerror = () => favicon.src = 'default-favicon.png';

          const title = document.createElement('span');
          title.className = 'tab-title';
          title.textContent = tab.title;
          title.title = tab.url; // Change tooltip to show full URL instead of title

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
            updateGroupCheckbox(groupElement);
          });

          // Add click handler to title to switch to tab
          title.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent the tab selection toggle
            switchToTab(tab.id);
          });

          chromeGroupContainer.appendChild(tabElement);
        });
      });

      duplicateTabsContainer.appendChild(groupElement);
    });
  }

  // Function to close selected tabs
  async function closeSelectedTabs() {
    // Get all selected tabs
    const selectedTabs = Array.from(document.querySelectorAll('.tab-item input[type="checkbox"]:checked'))
      .map(checkbox => {
        const tabElement = checkbox.closest('.tab-item');
        const tabId = parseInt(tabElement.dataset.tabId);
        return tabId;
      });

    if (selectedTabs.length > 0) {
      const confirmed = confirm(`Are you sure you want to close ${selectedTabs.length} selected tab(s)?`);
      if (confirmed) {
        await chrome.tabs.remove(selectedTabs);
        findDuplicateTabs(); // Refresh the list
      }
    } else {
      alert('Please select at least one tab to close.');
    }
  }

  // Function to remove duplicate tabs
  async function removeDuplicateTabs() {
    // Get all selected tabs
    const selectedTabs = Array.from(document.querySelectorAll('.tab-item input[type="checkbox"]:checked'))
      .map(checkbox => {
        const tabElement = checkbox.closest('.tab-item');
        const tabId = parseInt(tabElement.dataset.tabId);
        return tabId;
      });

    if (selectedTabs.length > 0) {
      // Group the selected tabs by their group
      const tabGroups = new Map();

      // Find which group each selected tab belongs to
      duplicateTabs.forEach(group => {
        group.tabs.forEach(tab => {
          if (selectedTabs.includes(tab.id)) {
            if (!tabGroups.has(group.key)) {
              tabGroups.set(group.key, []);
            }
            tabGroups.get(group.key).push(tab.id);
          }
        });
      });

      // For each group, keep one tab and close the rest
      const tabsToClose = [];
      tabGroups.forEach((tabIds, groupKey) => {
        // Keep the first tab in each group, close the rest
        tabsToClose.push(...tabIds.slice(1));
      });

      if (tabsToClose.length > 0) {
        await chrome.tabs.remove(tabsToClose);
        findDuplicateTabs(); // Refresh the list
      }
    }
  }

  // Event listeners
  findDuplicatesBtn.addEventListener('click', findDuplicateTabs);
  closeDuplicatesBtn.addEventListener('click', removeDuplicateTabs);
  selectAllBtn.addEventListener('click', toggleAllTabs);
  document.getElementById('closeSelected').addEventListener('click', closeSelectedTabs);
});
