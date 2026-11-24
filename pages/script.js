function applySaveData(data) {
  lessonCount = data.lessonCount ?? 0;
  unlockedCount = data.unlockedCount ?? 2;
  lessonsSinceLastUnlock = data.lessonsSinceLastUnlock ?? 0;
  lastUnlockedLesson = data.lastUnlockedLesson ?? 0;
  cycle = data.cycle ?? 1;

  // Clear first so an import fully REPLACES current stats instead of
  // merging on top of them (Object.assign alone only overwrites keys
  // that exist in the imported data, leaving stray current-session
  // letters/mistakes behind).
  for (const key in perLetterStats) delete perLetterStats[key];
  for (const key in mistakeMap) delete mistakeMap[key];

  Object.assign(perLetterStats, data.perLetterStats ?? {});
  Object.assign(mistakeMap, data.mistakeMap ?? {});

  lessonPerformanceHistory.length = 0;
  (data.lessonPerformanceHistory ?? []).forEach(entry => lessonPerformanceHistory.push(entry));
}

function buildSaveData() {
  return {
    lessonCount,
    unlockedCount,
    lessonsSinceLastUnlock,
    lastUnlockedLesson,
    cycle,
    perLetterStats,
    mistakeMap,
    lessonPerformanceHistory
  };
}

function getDefaultSave() {
  return {
    lessonCount: 0,
    unlockedCount: 2,
    lessonsSinceLastUnlock: 0,
    lastUnlockedLesson: 0,
    cycle: 1,
    perLetterStats: {},
    mistakeMap: {},
    lessonPerformanceHistory: []
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

function persistProgress() {
  if (isGuest) {
    localStorage.setItem("typingSave", JSON.stringify(buildSaveData()));
  } else {
    saveProgressToCloud();
  }
}

let wordList = [];
    let lessonCount = 0;
    const unlockSequence = ["f","j","d","k","s","l","a","g","h","q","p","w","o","e","i","r","u","t","y","v","n","b","c","m","x","z"];
    let unlockedCount = 2;
    let lessonsSinceLastUnlock = 0;
    let lastUnlockedLesson = -1;

    // === Cycle / difficulty scaling ===
    // Once every letter is unlocked, the alphabet relocks and you go through
    // it again, but the accuracy and speed required to unlock each letter
    // increases with every cycle you complete.
    let cycle = 1;
    const MIN_UNLOCKED_LETTERS = 2;         // can't lock below the starting f/j pair
    const LESSONS_TO_UNLOCK = 4;            // lessons required since the last unlock
    const PERFORMANCE_HISTORY_SIZE = 4;     // rolling window the averages are drawn from
    const BASE_ACCURACY_REQUIREMENT = 80;   // %, required in cycle 1
    const ACCURACY_INCREMENT_PER_CYCLE = 4; // % added each time you complete a cycle
    const MAX_ACCURACY_REQUIREMENT = 99;    // 100% isn't realistically achievable
    const BASE_SPEED_REQUIREMENT = 15;      // WPM, required in cycle 1
    const SPEED_INCREMENT_PER_CYCLE = 8;    // WPM added each time you complete a cycle
    const lessonPerformanceHistory = [];    // rolling log of { accuracy, wpm } for the last few lessons

    let exampleString = "loading...";
    let currentIndex = 0;
    const correctedIndexes = new Set();
    const wrongIndexes = new Set();
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

    // === Export: download current progress as a JSON file ===
    function exportSaveData() {
      const data = buildSaveData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const dateStr = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = url;
      a.download = `typecademy-progress-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    document.getElementById("export-btn").addEventListener("click", exportSaveData);

    // === Import: restore progress from a previously exported JSON file ===
    document.getElementById("import-input").addEventListener("change", event => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const importedData = JSON.parse(reader.result);
          applySaveData(importedData);
          persistProgress();
          generateLesson();
          updateLetterAccuracyDisplay(); // refresh immediately, not just after next keystroke
          alert("Progress imported successfully!");
        } catch (err) {
          console.error(err);
          alert("Failed to load save data. Make sure you selected a valid Typecademy export file.");
        }
      };
      reader.readAsText(file);

      // Reset so importing the same filename again still triggers change
      event.target.value = "";
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
    
    function getRequiredAccuracy() {
      return Math.min(MAX_ACCURACY_REQUIREMENT, BASE_ACCURACY_REQUIREMENT + (cycle - 1) * ACCURACY_INCREMENT_PER_CYCLE);
    }

    function getRequiredSpeed() {
      return BASE_SPEED_REQUIREMENT + (cycle - 1) * SPEED_INCREMENT_PER_CYCLE;
    }

    // Average accuracy/WPM over the last few completed lessons. Rounded,
    // since that's both what gets compared against the requirement and what
    // is shown on screen (keeps the two in agreement). null if no lessons yet.
    function getRecentAverage(key) {
      if (lessonPerformanceHistory.length === 0) return null;
      const sum = lessonPerformanceHistory.reduce((total, entry) => total + entry[key], 0);
      return Math.round(sum / lessonPerformanceHistory.length);
    }

    function checkUnlockConditions() {
      const requiredAccuracy = getRequiredAccuracy();
      const requiredSpeed = getRequiredSpeed();
      const avgAccuracy = getRecentAverage("accuracy");
      const avgSpeed = getRecentAverage("wpm");

      const meetsRequirements =
        avgAccuracy !== null && avgAccuracy >= requiredAccuracy &&
        avgSpeed !== null && avgSpeed >= requiredSpeed;

      if ((lessonCount - lastUnlockedLesson >= LESSONS_TO_UNLOCK) && meetsRequirements) {
        if (unlockedCount < unlockSequence.length) {
          unlockedCount++;
        } else {
          // Fully unlocked the whole alphabet: relock it and start a new,
          // harder cycle from scratch.
          cycle++;
          unlockedCount = MIN_UNLOCKED_LETTERS;
        }
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
      startTime = null;
      correctedIndexes.clear();
      wrongIndexes.clear();
      renderText();
      updateStats();
      updateCurrentKeyHighlight();

      const focusDiv = document.getElementById("focus-letters");
      focusDiv.textContent = "Focus letters:" + (currentFocusLetters.length > 0 ? " " + currentFocusLetters.join(", ") : " None");
      renderLetterStatus();
      updateAdvancedSettingsDisplay();
      updateUnlockRequirementsDisplay();
      persistProgress();
    }

    // === Advanced settings: manually step letter unlocks / lesson progress
    // back and forward, e.g. for testing or undoing an accidental unlock. ===
    function adjustUnlockedLetters(delta) {
      const max = unlockSequence.length;
      unlockedCount = Math.min(max, Math.max(MIN_UNLOCKED_LETTERS, unlockedCount + delta));
      generateLesson();
    }

    function adjustLessonProgress(delta) {
      lessonsSinceLastUnlock = Math.min(LESSONS_TO_UNLOCK, Math.max(0, lessonsSinceLastUnlock + delta));
      // Keep lastUnlockedLesson in sync so checkUnlockConditions' own
      // (lessonCount - lastUnlockedLesson) math agrees with this value.
      lastUnlockedLesson = lessonCount - lessonsSinceLastUnlock;
      generateLesson();
    }

    function updateAdvancedSettingsDisplay() {
      const letterDisplay = document.getElementById("letter-progress-display");
      const letterBackBtn = document.getElementById("letter-back-btn");
      const letterForwardBtn = document.getElementById("letter-forward-btn");
      if (letterDisplay) {
        const unlocked = unlockSequence.slice(0, unlockedCount);
        letterDisplay.textContent = `${unlockedCount} unlocked: ${unlocked.join(" ")}`;
      }
      if (letterBackBtn) letterBackBtn.disabled = unlockedCount <= MIN_UNLOCKED_LETTERS;
      if (letterForwardBtn) letterForwardBtn.disabled = unlockedCount >= unlockSequence.length;

      const lessonDisplay = document.getElementById("lesson-progress-display");
      const lessonBackBtn = document.getElementById("lesson-back-btn");
      const lessonForwardBtn = document.getElementById("lesson-forward-btn");
      if (lessonDisplay) {
        lessonDisplay.textContent = `Progress to next letter: ${lessonsSinceLastUnlock} / ${LESSONS_TO_UNLOCK}`;
      }
      if (lessonBackBtn) lessonBackBtn.disabled = lessonsSinceLastUnlock <= 0;
      if (lessonForwardBtn) lessonForwardBtn.disabled = lessonsSinceLastUnlock >= LESSONS_TO_UNLOCK;
    }

    document.getElementById("letter-back-btn").addEventListener("click", () => adjustUnlockedLetters(-1));
    document.getElementById("letter-forward-btn").addEventListener("click", () => adjustUnlockedLetters(1));
    document.getElementById("lesson-back-btn").addEventListener("click", () => adjustLessonProgress(-1));
    document.getElementById("lesson-forward-btn").addEventListener("click", () => adjustLessonProgress(1));

    // Shows the current cycle plus how your recent accuracy/speed compare
    // to what's required to unlock the next letter.
    function updateUnlockRequirementsDisplay() {
      const el = document.getElementById("unlock-requirements");
      if (!el) return;

      const requiredAccuracy = getRequiredAccuracy();
      const requiredSpeed = getRequiredSpeed();
      const avgAccuracy = getRecentAverage("accuracy");
      const avgSpeed = getRecentAverage("wpm");

      const accuracyText = avgAccuracy === null ? "\u2014" : `${avgAccuracy}%`;
      const speedText = avgSpeed === null ? "\u2014" : `${avgSpeed} WPM`;

      const accuracyOK = avgAccuracy !== null && avgAccuracy >= requiredAccuracy;
      const speedOK = avgSpeed !== null && avgSpeed >= requiredSpeed;

      const lessonsProgress = Math.min(lessonsSinceLastUnlock, LESSONS_TO_UNLOCK);
      const nextStep = unlockedCount < unlockSequence.length
        ? "To unlock next letter"
        : "To start next cycle";

      el.innerHTML =
        `<strong>Cycle ${cycle}</strong> \u2014 lessons since last unlock: ${lessonsProgress}/${LESSONS_TO_UNLOCK}<br>` +
        `${nextStep}: ` +
        `<span class="${accuracyOK ? 'req-met' : 'req-unmet'}">accuracy ${accuracyText} (need ${requiredAccuracy}%)</span>` +
        ` &nbsp;|&nbsp; ` +
        `<span class="${speedOK ? 'req-met' : 'req-unmet'}">speed ${speedText} (need ${requiredSpeed} WPM)</span>`;
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

    // Accuracy over the first `uptoIndex` characters of the sentence. Every
    // position that was EVER mistyped counts against you, even after you
    // backspace and fix it. wrongIndexes is a Set, so each position only
    // costs you once no matter how many times you retry it.
    function calculateAccuracy(uptoIndex) {
      if (uptoIndex <= 0) return 100;
      let wrongCount = 0;
      wrongIndexes.forEach(i => { if (i < uptoIndex) wrongCount++; });
      return Math.round(((uptoIndex - wrongCount) / uptoIndex) * 100);
    }

    function calculateWpm(uptoIndex) {
      if (!startTime) return 0;
      const elapsedMinutes = (Date.now() - startTime) / 60000;
      const wordCount = exampleString.slice(0, uptoIndex).split(/\s+/).filter(Boolean).length;
      return Math.round(wordCount / elapsedMinutes);
    }

    function recordLessonPerformance(accuracy, wpm) {
      lessonPerformanceHistory.push({ accuracy, wpm });
      if (lessonPerformanceHistory.length > PERFORMANCE_HISTORY_SIZE) {
        lessonPerformanceHistory.shift();
      }
    }

    function updateStats() {
      if (!startTime) return;
      const wpm = calculateWpm(currentIndex);
      const accuracy = calculateAccuracy(currentIndex);
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
      persistProgress();
      const expectedChar = exampleString[currentIndex];
      const actualChar = e.key;
      const isCorrect = actualChar == expectedChar;

      highlightKey(e.code, e.key, isCorrect ? 'correct-pressed' : 'incorrect-pressed');

      if (e.key === "Enter" && currentIndex >= exampleString.length) {
        recordLessonPerformance(calculateAccuracy(currentIndex), calculateWpm(currentIndex));
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
      persistProgress();
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

    //renderKeyboard();
    loadWordList();
    function initializeTypingApp() {
      generateLesson();
    }
    document.getElementById("settings-btn").onclick = () => {
        document.getElementById("settings-popup").style.display = "flex";
        updateAdvancedSettingsDisplay();
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
