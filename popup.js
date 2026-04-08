// === 8. POPUP LOGIC ===
let availableSubjects = [];

document.addEventListener('DOMContentLoaded', () => {
  const semesterSelect = document.getElementById('semester');
  const subjectInput = document.getElementById('subject');
  const searchBtn = document.getElementById('searchBtn');
  const suggestionsBox = document.getElementById('suggestions');
  const resultsDiv = document.getElementById('results');
  const loading = document.getElementById('loading');

  // Initialize: request available subjects from content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "get_data" }, (response) => {
        if (chrome.runtime.lastError) {
          // Content script hasn't loaded (e.g. invalid tab, internal page)
          resultsDiv.innerHTML = `<div class="empty">Unable to access page data. Please open a valid college website page.</div>`;
          return;
        }
        
        if (response && response.success) {
          availableSubjects = response.subjects || [];
        }
      });
    }
  });

  // --- SMART MATCHING LOGIC (for Autocomplete) ---
  function isSmartMatch(input, subjectName) {
    if (!input) return true;
    const cleanInput = input.replace(/[^a-zA-Z0-9\s]/g, ' ').trim().replace(/\s+/g, ' ').toLowerCase();
    if (!cleanInput) return true;
    
    const inputWords = cleanInput.split(' ').filter(Boolean);
    const subjectWords = subjectName.split(' ').filter(Boolean);
    
    // Every input word must match the start of ANY subject word
    return inputWords.every(iWord => subjectWords.some(sWord => sWord.startsWith(iWord)));
  }

  // --- SHOW SUGGESTIONS UI ---
  function showSuggestions(inputVal) {
    suggestionsBox.innerHTML = '';
    if (!inputVal.trim()) {
      suggestionsBox.style.display = 'none';
      return;
    }

    const matches = availableSubjects.filter(sub => isSmartMatch(inputVal, sub)).slice(0, 5); // Limit limit 5
    
    if (matches.length > 0) {
      matches.forEach(match => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.textContent = match;
        div.addEventListener('click', () => {
          subjectInput.value = match;
          suggestionsBox.style.display = 'none';
          // Auto search on suggestion click
          performSearch();
        });
        suggestionsBox.appendChild(div);
      });
      suggestionsBox.style.display = 'block';
    } else {
      suggestionsBox.style.display = 'none';
    }
  }

  // Live typing event listener
  subjectInput.addEventListener('input', (e) => {
    showSuggestions(e.target.value);
  });

  // Hide suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (e.target !== subjectInput && e.target !== suggestionsBox) {
      suggestionsBox.style.display = 'none';
    }
  });

  // Search button click
  searchBtn.addEventListener('click', performSearch);
  
  // Enter key press in input
  subjectInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      suggestionsBox.style.display = 'none';
      performSearch();
    }
  });

  // --- PERFORM SEARCH ---
  function performSearch() {
    const semester = semesterSelect.value;
    const subject = subjectInput.value;

    resultsDiv.innerHTML = '';
    loading.style.display = 'block';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) return;

      chrome.tabs.sendMessage(tabs[0].id, { 
        action: "filter_papers",
        semester: semester,
        input: subject
      }, (response) => {
        loading.style.display = 'none';
        
        if (chrome.runtime.lastError) {
          resultsDiv.innerHTML = `<div class="empty">Please refresh the college page. Extension couldn't connect.</div>`;
          return;
        }

        if (response && response.success) {
          displayResults(response.filteredData);
        } else {
          resultsDiv.innerHTML = `<div class="empty">Error fetching results.</div>`;
        }
      });
    });
  }

  // --- RENDER RESULTS ---
  function displayResults(data) {
    resultsDiv.innerHTML = '';
    
    if (!data || data.length === 0) {
      resultsDiv.innerHTML = `<div class="empty">No papers found matching your criteria.</div>`;
      return;
    }

    data.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'result-item';

      const nameDiv = document.createElement('div');
      nameDiv.className = 'result-name';
      nameDiv.textContent = item.name;

      const metaDiv = document.createElement('div');
      metaDiv.className = 'result-meta';
      
      const semSpan = document.createElement('span');
      semSpan.textContent = `Semester: ${item.semester}`;
      metaDiv.appendChild(semSpan);

      const link = document.createElement('a');
      link.className = 'result-link';
      link.href = item.url;
      link.target = '_blank';
      link.textContent = 'Download PDF';

      itemDiv.appendChild(nameDiv);
      itemDiv.appendChild(metaDiv);
      itemDiv.appendChild(link);

      resultsDiv.appendChild(itemDiv);
    });
  }
});
