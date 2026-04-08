// === 1. DATA EXTRACTION ===
function extractRawData() {
  const rows = document.querySelectorAll('tr');
  const rawData = [];

  rows.forEach((row, index) => {
    const cells = row.querySelectorAll('td');
    
    // Ensure the row has enough columns (at least 5 expected based on structure)
    if (cells.length >= 5) {
      // Column 3 (index 2) contains Subject Name
      const subjectText = cells[2].innerText.trim();
      
      // Column 4 (index 3) contains Exam Info with Semester
      const examText = cells[3].innerText.trim();
      
      // Column 5 (index 4) contains Download button/link
      const linkElement = cells[4].querySelector('a');
      const url = linkElement ? linkElement.href : null;

      // Debugging logs to verify what we captured
      console.log(`[Row ${index}] Subject: "${subjectText}" | Exam: "${examText}" | URL: ${url}`);

      if (url) { // Ignore rows with missing links
        rawData.push({ subjectText, examText, url });
      } else {
        console.log(`[Row ${index}] Skipped: No valid download link found.`);
      }
    }
  });

  return rawData;
}

// === 2. DATA CLEANING + PARSING ===
function parsePaper(rawItem) {
  // Extract semester using regex (S1 to S8) from the EXAM text, not subject text
  const semesterMatch = rawItem.examText.match(/\b(S[1-8])\b/i);
  const semester = semesterMatch ? semesterMatch[1].toUpperCase() : 'Unknown';

  // Clean subject name: remove brackets and content inside, filter specials, trim, to lowercase
  let cleanName = rawItem.subjectText
    .replace(/\([^)]*\)/g, '')   // Remove brackets and content inside e.g., (100908/MA100A)
    .replace(/[^a-zA-Z0-9\s]/g, ' ') // Remove special characters
    .replace(/\s+/g, ' ')        // Replace multiple spaces with single space
    .trim()                      // Trim ends
    .toLowerCase();              // Convert to lowercase

  return {
    name: cleanName,
    semester: semester,
    url: rawItem.url
  };
}

function getParsedData() {
  const rawData = extractRawData();
  const parsedData = rawData.map(item => {
    const parsed = parsePaper(item);
    console.log(`Parsed -> Name: "${parsed.name}", Semester: "${parsed.semester}"`);
    return parsed;
  });
  return parsedData;
}

// === 3. DYNAMIC SUBJECT LIST ===
function getUniqueSubjects(parsedData) {
  const subjects = new Set();
  parsedData.forEach(item => {
    if (item.name) {
      subjects.add(item.name);
    }
  });
  return Array.from(subjects);
}

// === 4. SMART MATCHING FUNCTION ===
function isSmartMatch(input, subjectName) {
  if (!input) return true; // Empty input matches everything

  const cleanInput = input.replace(/[^a-zA-Z0-9\s]/g, ' ').trim().replace(/\s+/g, ' ').toLowerCase();
  if (!cleanInput) return true;

  const inputWords = cleanInput.split(' ').filter(Boolean);
  const subjectWords = subjectName.split(' ').filter(Boolean);

  // Every input word must match the start of ANY subject word
  return inputWords.every(iWord => {
    return subjectWords.some(sWord => sWord.startsWith(iWord));
  });
}

// === 5. FILTERING LOGIC ===
function filterPapers(parsedData, targetSemester, searchInput) {
  return parsedData.filter(item => {
    const semesterMatch = targetSemester === 'All' || item.semester === targetSemester;
    const subjectMatch = isSmartMatch(searchInput, item.name);
    return semesterMatch && subjectMatch;
  });
}

// === 9. CONTENT SCRIPT MESSAGING ===
// Listen for messages from popup.js
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "get_data") {
      try {
        console.group("Extension: Extracting Data");
        const parsedData = getParsedData();
        const uniqueSubjects = getUniqueSubjects(parsedData);
        console.groupEnd();
        
        sendResponse({ 
          success: true, 
          data: parsedData,
          subjects: uniqueSubjects
        });
      } catch (error) {
        console.error("Error extracting data:", error);
        sendResponse({ success: false, error: error.message });
      }
      return true; // Keep message channel open for asynchronous response
    }

    if (message.action === "filter_papers") {
      try {
        const parsedData = getParsedData();
        const filtered = filterPapers(parsedData, message.semester, message.input);
        
        sendResponse({
          success: true,
          filteredData: filtered
        });
      } catch (error) {
        console.error("Error filtering papers:", error);
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }
  });
}
