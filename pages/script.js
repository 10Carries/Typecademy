function applySaveData(data) {
  lessonCount = data.lessonCount ?? 0;
  unlockedCount = data.unlockedCount ?? 2;
  lessonsSinceLastUnlock = data.lessonsSinceLastUnlock ?? 0;
  lastUnlockedLesson = data.lastUnlockedLesson ?? 0;

  Object.assign(perLetterStats, data.perLetterStats ?? {});
  Object.assign(mistakeMap, data.mistakeMap ?? {});
}

function buildSaveData() {
  return {
    lessonCount,
    unlockedCount,
    lessonsSinceLastUnlock,
    lastUnlockedLesson,
    perLetterStats,
    mistakeMap
  };
}

function getDefaultSave() {
  return {
    lessonCount: 0,
    unlockedCount: 2,
    lessonsSinceLastUnlock: 0,
    lastUnlockedLesson: 0,
    perLetterStats: {},
    mistakeMap: {}
  };
}


import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import { 
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA-FFNExXdT3jDTNZSJKi1jFaI_qCRTMUQ",
  authDomain: "typecademy-47e1a.firebaseapp.com",
  projectId: "typecademy-47e1a",
  storageBucket: "typecademy-47e1a.firebasestorage.app",
  messagingSenderId: "578378632896",
  appId: "1:578378632896:web:b71e02b0bf7eee7430a725",
  measurementId: "G-477KLYE97L"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let isGuest = false;
let saveData = {};
let currentFocusLetters = [];

onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Signed in as:", user.email);
        currentUser = user;
        isGuest = false;
        loadUserSaveFromCloud(user.uid);
    } else {
        console.log("Guest mode");
        currentUser = null;
        isGuest = true;
        loadLocalSave();
    }
});

async function loadUserSaveFromCloud(uid) {
  const docRef = doc(db, "users", uid);
  const snap = await getDoc(docRef);

  if (snap.exists()) {
    saveData = snap.data().progress || getDefaultSave();
  } else {
    saveData = getDefaultSave();
    await setDoc(docRef, { progress: saveData });
  }

  applySaveData(saveData);
  initializeTypingApp();
}

function loadLocalSave() {
  const saved = localStorage.getItem("typingSave");

  saveData = saved ? JSON.parse(saved) : getDefaultSave();

  applySaveData(saveData);
  initializeTypingApp();
}

async function saveProgressToCloud() {
  if (!auth.currentUser) return;

  const saveObj = buildSaveData();
  const ref = doc(db, "users", auth.currentUser.uid);

  await setDoc(ref, { progress: saveObj }, { merge: true });
}

let wordList = [];
    let lessonCount = 0;
    const unlockSequence = ["f","j","d","k","s","l","a","g","h","q","p","w","o","e","i","r","u","t","y","v","n","b","c","m","x","z"];
    let unlockedCount = 2;
    let lessonsSinceLastUnlock = 0;
    let lastUnlockedLesson = -1;

    let exampleString = "loading...";
    let currentIndex = 0;
    const correctedIndexes = new Set();
    const wrongIndexes = new Set();
    let correctTyped = 0;
    let startTime = null;
    const mistakeMap = {};
    const perLetterStats = {}; // { letter: { correct: 0, total: 0, history: [true, false, ...] } }

    const keyboardContainer = document.getElementById("keyboard");
    const textDisplay = document.getElementById("text-display");
    const statsDisplay = document.getElementById("stats");

    const shiftMap = {
      "1": "!", "2": "@", "3": "#", "4": "$", "5": "%", "6": "^",
      "7": "&", "8": "*", "9": "(", "0": ")", "-": "_", "=": "+",
      "[": "{", "]": "}", "\\": "|", ";": ":", "'": '"', ",": "<",
      ".": ">", "/": "?"
    };

    const ignoredKeys = ["Shift", "ShiftLeft", "ShiftRight", "CapsLock", "Tab", "Control", "Alt", "Meta", "Enter"];

    const keyLayout = [
      ["1","2","3","4","5","6","7","8","9","0","-","=","Backspace"],
      ["Tab","q","w","e","r","t","y","u","i","o","p","[","]","\\"],
      ["CapsLock","a","s","d","f","g","h","j","k","l",";","'","Enter"],
      ["ShiftLeft","z","x","c","v","b","n","m",",",".","/","ShiftRight"],
      ["Space"]
    ];

    async function loadWordList() {
      const res = await fetch("words_dictionary.json");
      const data = await res.json();
      wordList = Object.keys(data);
      generateLesson();
    }

    // === Export Save Function ===
    function exportSaveData() {
      const saveData = {
        lessonCount,
        unlockedCount,
        lessonsSinceLastUnlock,
        correctTyped,
        mistakeMap,
        perLetterStats,
      };
      const blob = new Blob([JSON.stringify(saveData    )], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const tempInput = document.createElement('textarea');
      tempInput.value = JSON.stringify(saveData, null, 2);
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand('copy');
      document.body.removeChild(tempInput);

      alert("Save data copied to clipboard!");
    }

    // === Load Save File Function ===
    document.getElementById("export-btn").addEventListener("click", () => {
      const saveData = {
        lessonCount,
        unlockedCount,
        lessonsSinceLastUnlock,
        lastUnlockedLesson,
        perLetterStats,
        mistakeMap
      };
      const json = JSON.stringify(saveData, null, 2);
      navigator.clipboard.writeText(json).then(() => alert("Save data copied to clipboard."));
    });

    document.getElementById("import-input").addEventListener("change", event => {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const saveData = JSON.parse(reader.result);
          lessonCount = saveData.lessonCount || 0;
          unlockedCount = saveData.unlockedCount || 2;
          lessonsSinceLastUnlock = saveData.lessonsSinceLastUnlock || 0;
          lastUnlockedLesson = saveData.lastUnlockedLesson || 0;
          Object.assign(perLetterStats, saveData.perLetterStats || {});
          Object.assign(mistakeMap, saveData.mistakeMap || {});
          generateLesson();
        } catch (err) {
          alert("Failed to load save data.");
        }
      };
      reader.readAsText(file);
    });

    function updateStatsOnKeyPress(correctChar, inputChar) {
      if (!perLetterStats[correctChar]) {
        perLetterStats[correctChar] = { history: [], totalCorrect: 0, totalAttempts: 0 };
      }
      const stats = perLetterStats[correctChar];
      stats.history.push(correctChar === inputChar);
      if (stats.history.length > 100) stats.history.shift();
      stats.totalAttempts++;
      if (correctChar === inputChar) stats.totalCorrect++;

      if (correctChar !== inputChar) {
        if (!mistakeMap[inputChar]) mistakeMap[inputChar] = {};
        mistakeMap[inputChar][correctChar] = (mistakeMap[inputChar][correctChar] || 0) + 1;
      }
    }
    
    function renderLetterStatus() {
      const container = document.getElementById("letter-status");
      container.innerHTML = "";
      unlockSequence.forEach((letter, index) => {
        const div = document.createElement("div");
        div.className = "letter-box";
        if (index >= unlockedCount) div.classList.add("locked");
        div.textContent = letter;

        const tooltip = document.createElement("div");
        tooltip.className = "tooltip";

        const stats = perLetterStats[letter] || { totalAttempts: 0, totalCorrect: 0, history: [] };
        const totalRecent = stats.history.length;
        const correctRecent = stats.history.filter(x => x).length;
        const accRecent = totalRecent ? (correctRecent / totalRecent * 100).toFixed(1) : "N/A";

        const accTotal = stats.totalAttempts ? (stats.totalCorrect / stats.totalAttempts * 100).toFixed(1) : "N/A";

        let confusedWith = null;
        let maxCount = 0;
        for (const [wrongKey, mapping] of Object.entries(mistakeMap)) {
          const count = mapping[letter] || 0;
          if (count > maxCount) {
            maxCount = count;
            confusedWith = wrongKey;
          }
        }

        tooltip.innerHTML =
          `Total accuracy: ${accTotal}%<br>` +
          `Accuracy (last 100): ${accRecent}%<br>` +
          `Total attempts: ${stats.totalAttempts}<br>` +
          `Most confused with: ${confusedWith || 'N/A'}`;

        div.appendChild(tooltip);
        container.appendChild(div);
      });
    }
    
    function getUnlockedLetters() {
      return unlockSequence.slice(0, unlockedCount);
    }

    function checkUnlockConditions() {
      const unlockedLetters = getUnlockedLetters();
      const allAbove80 = unlockedLetters.every(letter => {
        const stats = perLetterStats[letter];
        if (!stats || stats.totalAttempts === 0) return false;
        return (stats.totalCorrect / stats.totalAttempts) >= 0.8;
      });

      if ((lessonCount - lastUnlockedLesson >= 4) && allAbove80 && unlockedCount < unlockSequence.length) {
        unlockedCount++;
        lastUnlockedLesson = lessonCount;
        lessonsSinceLastUnlock = 0;
      }
    }

    function generateLesson() {
      const allowed = new Set(unlockSequence.slice(0, unlockedCount));
      const validWords = wordList.filter(word => [...word].every(ch => allowed.has(ch.toLowerCase())));
      const totalCount = Math.floor(Math.random() * 16) + 15;

      const words = [];
      let reinforcePlan = [];
      currentFocusLetters = [];

      const newLetterIndex = unlockedCount - 1;
      const isNewLetterPhase = unlockedCount > 2 && (lessonCount - lastUnlockedLesson < 4);
      const newLetter = unlockSequence[newLetterIndex];

      if (isNewLetterPhase) {
        const amount = Math.floor(totalCount * 0.75);
        for (let i = 0; i < amount; i++) reinforcePlan.push(newLetter);
        while (reinforcePlan.length < totalCount) reinforcePlan.push(null);
        for (let i = reinforcePlan.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [reinforcePlan[i], reinforcePlan[j]] = [reinforcePlan[j], reinforcePlan[i]];
        }
        currentFocusLetters.push(newLetter);
      } else if (lessonsSinceLastUnlock >= 4 && unlockedCount > 2) {
        const letterAccuracies = Object.entries(perLetterStats)
          .filter(([letter]) => allowed.has(letter))
          .map(([letter, stats]) => {
            const acc = stats.totalAttempts ? stats.totalCorrect / stats.totalAttempts : 1;
            return { letter, acc };
          })
          .sort((a, b) => a.acc - b.acc);

        const leastAccurate = letterAccuracies.slice(0, 3).map(x => x.letter);
        currentFocusLetters.push(...leastAccurate);

        const portions = [0.5, 0.25, 0.1];
        for (let i = 0; i < portions.length; i++) {
          const amount = Math.floor(totalCount * portions[i]);
          for (let j = 0; j < amount; j++) reinforcePlan.push(leastAccurate[i]);
        }
        while (reinforcePlan.length < totalCount) reinforcePlan.push(null);
        for (let i = reinforcePlan.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [reinforcePlan[i], reinforcePlan[j]] = [reinforcePlan[j], reinforcePlan[i]];
        }
      }

      for (let i = 0; i < totalCount; i++) {
        const focusLetter = reinforcePlan[i] || null;
        let choices = focusLetter
          ? validWords.filter(word => word.includes(focusLetter))
          : validWords;

        if (choices.length === 0) choices = validWords;
        const chosen = choices[Math.floor(Math.random() * choices.length)];
        words.push(chosen);
      }

      exampleString = words.join(" ");
      currentIndex = 0;
      correctTyped = 0;
      startTime = null;
      correctedIndexes.clear();
      wrongIndexes.clear();
      renderText();
      updateStats();
      updateCurrentKeyHighlight();

      const focusDiv = document.getElementById("focus-letters");
      focusDiv.textContent = "Focus letters:" + (currentFocusLetters.length > 0 ? " " + currentFocusLetters.join(", ") : " None");
      renderLetterStatus();
    }

    function renderText() {
      textDisplay.innerHTML = "";
      const lineLength = 40;
      let currentLine = document.createElement("div");
      currentLine.className = "line";
      for (let i = 0; i < exampleString.length; i++) {
        const span = document.createElement("span");
        const char = exampleString[i];
        span.textContent = char === " " ? "\u00A0" : char;
        span.className = "char";
        if (i === currentIndex) span.classList.add("cursor");
        currentLine.appendChild(span);
        if ((i + 1) % lineLength === 0) {
          textDisplay.appendChild(currentLine);
          currentLine = document.createElement("div");
          currentLine.className = "line";
        }
      }
      textDisplay.appendChild(currentLine);
    }

    function updateStats() {
      if (!startTime) return;
      const elapsedMinutes = (Date.now() - startTime) / 60000;
      const wordCount = exampleString.slice(0, currentIndex).split(/\s+/).filter(Boolean).length;
      const wpm = Math.round(wordCount / elapsedMinutes);
      const accuracy = currentIndex ? Math.round((correctTyped / currentIndex) * 100) : 100;
      statsDisplay.innerHTML = `WPM: ${wpm} | Accuracy: ${accuracy}%`;
      updateLetterAccuracyDisplay();
    }

    function updateLetterAccuracyDisplay() {
      const container = document.getElementById("letter-accuracy");
      let html = "<strong>Letter Accuracy (last 100):</strong><br />";
      const letters = Object.keys(perLetterStats).sort();
      for (const letter of letters) {
        const stats = perLetterStats[letter];
        const total = stats.history.length;
        const correct = stats.history.filter(x => x).length;
        const acc = total > 0 ? Math.round((correct / total) * 100) : 0;
        html += `${letter}: ${acc}% (${correct}/${total})<br />`;
      }
      container.innerHTML = html;
    }


    document.addEventListener("keydown", e => {
      const expectedChar = exampleString[currentIndex];
      const actualChar = e.key;
      const isCorrect = actualChar == expectedChar;

      highlightKey(e.code, e.key, isCorrect ? 'correct-pressed' : 'incorrect-pressed');

      if (e.key === "Enter" && currentIndex >= exampleString.length) {
        lessonCount++;
        lessonsSinceLastUnlock++;
        checkUnlockConditions();
        generateLesson();
        return;
      }

      if (currentIndex < exampleString.length && /^[a-zA-Z ]$/.test(e.key)) {
        const expected = exampleString[currentIndex];
        const typed = e.key;
        updateStatsOnKeyPress(expected, typed);
      }

      if (ignoredKeys.includes(e.key) || ignoredKeys.includes(e.code)) return;

      if (startTime === null) startTime = Date.now();

      const span = [...textDisplay.querySelectorAll('.char')][currentIndex];
      if (!span) return;

      if (e.key === "Backspace") {
        if (currentIndex > 0) {
          currentIndex--;
          const prev = [...textDisplay.querySelectorAll('.char')][currentIndex];
          prev.classList.remove("correct", "error", "fixed");
          if (wrongIndexes.has(currentIndex)) {
            correctedIndexes.delete(currentIndex);
          } else {
            wrongIndexes.delete(currentIndex);
            correctTyped--;
          }
          document.querySelectorAll('.cursor').forEach(c => c.classList.remove('cursor'));
          prev.classList.add("cursor");
        }
        updateCurrentKeyHighlight();
        return;
      }

      const expected = exampleString[currentIndex];
      const typedChar = e.key;

      span.classList.remove("cursor");

      const expectedLower = expected.toLowerCase();
      const typedLower = typedChar.toLowerCase();

      if (!perLetterStats[expectedLower]) perLetterStats[expectedLower] = { correct: 0, total: 0, history: [] };

      if (typedChar === expected) {
        correctTyped++;
        if (wrongIndexes.has(currentIndex)) {
          span.classList.add("fixed");
          correctedIndexes.add(currentIndex);
        } else {
          span.classList.add("correct");
        }
        perLetterStats[expectedLower].correct++;
        perLetterStats[expectedLower].history.push(true);
      } else {
        span.classList.add("error");
        const wrong = document.createElement("div");
        wrong.className = "incorrect";
        wrong.textContent = typedChar;
        span.appendChild(wrong);
        wrongIndexes.add(currentIndex);

        const mistyped = typedLower;
        if (!mistakeMap[expectedLower]) mistakeMap[expectedLower] = {};
        mistakeMap[expectedLower][mistyped] = (mistakeMap[expectedLower][mistyped] || 0) + 1;

        perLetterStats[expectedLower].history.push(false);
      }

      perLetterStats[expectedLower].total++;
      if (perLetterStats[expectedLower].history.length > 100) {
        const removed = perLetterStats[expectedLower].history.shift();
        if (removed) perLetterStats[expectedLower].correct--;
      }

      currentIndex++;
      const next = [...textDisplay.querySelectorAll('.char')][currentIndex];
      if (next) next.classList.add("cursor");

      updateStats();
      updateCurrentKeyHighlight();
      if (isGuest) {
        localStorage.setItem("typingSave", JSON.stringify(buildSaveData()));
      } else {
          saveProgressToCloud();
      }
    });

    function highlightKey(code, key, status = "pressed") {
      const shiftSymbolMap = {
        "~": "`", "!": "1", "@": "2", "#": "3", "$": "4",
        "%": "5", "^": "6", "&": "7", "*": "8", "(": "9",
        ")": "0", "_": "-", "+": "=", "{": "[", "}": "]",
        "|": "\\", ":": ";", "\"": "'", "<": ",", ">": ".", "?": "/"
      };

      const lowerKey = key.toLowerCase();
      // SELECTOR STUFF
      let selector = `[data-key="${key}"]`;

      if (shiftSymbolMap[key]) {
        selector = `[data-key="${shiftSymbolMap[key]}"]`;
      }

      if (/^[A-Z]$/.test(key)) {
        selector = `[data-key="${lowerKey}"]`;
      }

      if (key === "\\" || code === "Backslash") {
        selector = '[data-key="\\\\"]';
      }

      if (key === " ") {
        selector = `[data-key=" "]`;
      }

      const specialKeys = [
        "Backspace", "Tab", "CapsLock", "Enter",
        "ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight",
        "AltLeft", "AltRight", "MetaLeft", "MetaRight"
      ];
      if (specialKeys.includes(code)) {
        selector = `[data-key="${code}"]`;
      }

      const keyEl = document.querySelector(selector);
      if (keyEl) {
        keyEl.classList.add(status);
        setTimeout(() => keyEl.classList.remove(status), 150);
      } else {
        console.warn("Key not found for selector:", selector, "| code:", code, "| key:", key);
      }
    }

    function updateCurrentKeyHighlight() {

      document.querySelectorAll('.key').forEach(k => k.classList.remove('current'));

      const char = exampleString[currentIndex];
      if (!char) {

        const enterKey = document.querySelector('.key[data-key="Enter"]');
        if (enterKey) enterKey.classList.add('current');
        return;
      }

      const lowerChar = char.toLowerCase();
      const isUpper = char !== lowerChar;
      let baseKey = lowerChar;
      let requiresShift = false;

      const shiftMap = {
        '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6',
        '&': '7', '*': '8', '(': '9', ')': '0', '_': '-', '+': '=',
        '{': '[', '}': ']', '|': '\\', ':': ';', '"': '\'', '<': ',', '>': '.', '?': '/' 
      };

      if (char === ' ') {
        baseKey = ' ';
      } else if (shiftMap[char]) {
        baseKey = shiftMap[char];
        requiresShift = true;
      } else if (isUpper && /[a-zA-Z]/.test(char)) {
        requiresShift = true;
      }

      const baseSelector = `.key[data-key="${baseKey}"]`;
      const base = document.querySelector(baseSelector);
      if (base) base.classList.add('current');

      if (requiresShift && base) {
        const baseRect = base.getBoundingClientRect();
        const keyboardRect = document.querySelector('.keyboard')?.getBoundingClientRect();
        if (keyboardRect) {
          const centerX = keyboardRect.left + keyboardRect.width / 2;
          const isRightHalf = baseRect.left > centerX;
          const shiftKey = document.querySelector(`.key[data-key="${isRightHalf ? 'ShiftLeft' : 'ShiftRight'}"]`);
          if (shiftKey) shiftKey.classList.add('current');
        } else {

          const shiftLeft = document.querySelector('.key[data-key="ShiftLeft"]');
          const shiftRight = document.querySelector('.key[data-key="ShiftRight"]');
          if (shiftLeft) shiftLeft.classList.add('current');
          if (shiftRight) shiftRight.classList.add('current');
        }
      }
    }

    function saveProgress() {
      const saveData = {
        lessonCount,
        unlockedCount,
        lessonsSinceLastUnlock,
        lastUnlockedLesson,
        perLetterStats,
        mistakeMap
      };
      const blob = new Blob([JSON.stringify(saveData)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "typing-progress.json";
      a.click();
      URL.revokeObjectURL(url);
    }

    //renderKeyboard();
    loadWordList();
    function initializeTypingApp() {
      generateLesson();
    }
    document.getElementById("settings-btn").onclick = () => {
        document.getElementById("settings-popup").style.display = "flex";
    };

    // Settings popup close
    document.getElementById("close-settings").onclick = () => {
        document.getElementById("settings-popup").style.display = "none";
    };

    // Help button (placeholder)
    document.getElementById("help-btn").onclick = () => {
        alert("Help section coming soon!");
    };
    


    onAuthStateChanged(auth, (user) => {
        if (user) {
            document.getElementById("login-btn").style.display = "none";
            document.getElementById("profile-btn").style.display = "inline-block";
        } else {
            document.getElementById("login-btn").style.display = "inline-block";
            document.getElementById("profile-btn").style.display = "none";
        }
    });

    // Login button leads to login page
    document.getElementById("login-btn").onclick = () => {
        window.location.href = "login.html"; // Or your login page
    };

    // Profile button (placeholder)
    document.getElementById("profile-btn").onclick = () => {
        alert("Profile page coming soon!");
    };