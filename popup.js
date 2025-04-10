document.addEventListener('DOMContentLoaded', () => {
  const findDuplicatesBtn = document.getElementById('findDuplicates');
  const closeDuplicatesBtn = document.getElementById('closeDuplicates');
  const duplicateTabsContainer = document.getElementById('duplicateTabs');
  let duplicateTabs = [];

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

  // Function to display duplicate tabs
  function displayDuplicateTabs() {
    duplicateTabsContainer.innerHTML = '';

    if (duplicateTabs.length === 0) {
      duplicateTabsContainer.innerHTML = '<p>No duplicate tabs found.</p>';
      closeDuplicatesBtn.classList.add('hidden');
      return;
    }

    closeDuplicatesBtn.classList.remove('hidden');

    duplicateTabs.forEach(group => {
      const groupElement = document.createElement('div');
      groupElement.className = 'tab-group';

      const groupTitle = document.createElement('h3');
      groupTitle.textContent = group.key;
      groupElement.appendChild(groupTitle);

      group.tabs.forEach(tab => {
        const tabElement = document.createElement('div');
        tabElement.className = 'tab-item';

        const favicon = document.createElement('img');
        favicon.src = tab.favIconUrl || 'default-favicon.png';
        favicon.onerror = () => favicon.src = 'default-favicon.png';

        const title = document.createElement('span');
        title.textContent = tab.title;

        tabElement.appendChild(favicon);
        tabElement.appendChild(title);
        groupElement.appendChild(tabElement);
      });

      duplicateTabsContainer.appendChild(groupElement);
    });
  }

  // Function to close duplicate tabs
  async function closeDuplicateTabs() {
    const tabsToClose = duplicateTabs.flatMap(group =>
      group.tabs.slice(1).map(tab => tab.id)
    );

    await chrome.tabs.remove(tabsToClose);
    findDuplicateTabs(); // Refresh the list
  }

  // Event listeners
  findDuplicatesBtn.addEventListener('click', findDuplicateTabs);
  closeDuplicatesBtn.addEventListener('click', closeDuplicateTabs);
});
