import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const questionEl = document.getElementById("question");
const hintEl = document.getElementById("hint");
const progressEl = document.getElementById("progress");
const dudu = document.getElementById("dudu");
const optionsContainer = document.getElementById("optionsContainer");
const nextBtn = document.getElementById("nextBtn");
const resultEl = document.getElementById("result");
const statTotal = document.getElementById("statTotal");
const statPassed = document.getElementById("statPassed");
const statCorrect = document.getElementById("statCorrect");
const statWrong = document.getElementById("statWrong");

const defaultDudu = "./public/dudu/happy.png";
const finalGif = "./public/dudu/final/tenor-final.gif";
const responseId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

let questions = [];
let currentIndex = 0;
let isLocked = false;
let passedCount = 0;
let correctCount = 0;
let wrongCount = 0;

/* ---------- Question Animation ---------- */
function animateQuestion(type = "fade-in") {
  questionEl.classList.remove("fade-in", "slide-up", "scale-pop");
  void questionEl.offsetWidth; // reflow
  questionEl.classList.add(type || "fade-in");
}

/* ---------- Dudu Animation ---------- */
function resetDuduAnimation() {
  dudu.className = "";      // 🔥 remove ALL classes
  dudu.id = "dudu";        // 🔥 re-assign id
  void dudu.offsetHeight;  // 🔥 force reflow
}

function normalizeGifInput(value, prefix = "") {
  if (!value) return "";
  let cleaned = value.trim();

  cleaned = cleaned.replace(/^\.\/public\//, "");
  cleaned = cleaned.replace(/^\/public\//, "");
  cleaned = cleaned.replace(/^public\//, "");

  cleaned = cleaned.replace(/^dudu\/anger\b/, "dudu/angry");
  cleaned = cleaned.replace(/^dudu\/sad\b/, "dudu/angry");
  cleaned = cleaned.replace(/^anger\//, "angry/");
  cleaned = cleaned.replace(/^sad\//, "angry/");

  if (cleaned.startsWith("happy/") || cleaned.startsWith("angry/")) {
    cleaned = `dudu/${cleaned}`;
  }

  if (!cleaned.includes("/") && prefix) {
    cleaned = `${prefix}/${cleaned}`;
  }

  if (!/\.(gif|png|jpg|jpeg|webp)$/i.test(cleaned)) {
    cleaned = `${cleaned}.gif`;
  }

  return cleaned;
}

function resolveGifPath(value) {
  if (!value) return "";
  if (value.startsWith("http")) return value;
  if (value.startsWith("./") || value.startsWith("/")) return value;
  return `./public/${value}`;
}

function setDuduImage(src, bust = false, prefix = "") {
  const normalized = normalizeGifInput(src, prefix);
  if (!normalized) return;

  const candidates = [];
  if (normalized.startsWith("http") || normalized.startsWith("./") || normalized.startsWith("/")) {
    candidates.push(normalized);
    if (normalized.includes("/public/")) {
      candidates.push(normalized.replace("/public/", "/"));
    }
    if (normalized.startsWith("./public/")) {
      candidates.push(`./${normalized.slice("./public/".length)}`);
    }
  } else {
    candidates.push(`./public/${normalized}`);
    candidates.push(`./${normalized}`);
  }

  const resolvedCandidates = candidates.map(item => {
    const resolved = resolveGifPath(item);
    return bust
      ? `${resolved}${resolved.includes("?") ? "&" : "?"}v=${Date.now()}`
      : resolved;
  });

  let index = 0;
  const tryNext = () => {
    if (index >= resolvedCandidates.length) {
      dudu.src = defaultDudu;
      return;
    }
    dudu.src = resolvedCandidates[index];
    index += 1;
  };

  dudu.onerror = () => {
    tryNext();
  };

  tryNext();
}

function disableOptions(disabled) {
  const buttons = optionsContainer.querySelectorAll("button");
  buttons.forEach(btn => {
    btn.disabled = disabled;
  });
}

function updateStats() {
  statTotal.textContent = questions.length.toString();
  statPassed.textContent = passedCount.toString();
  statCorrect.textContent = correctCount.toString();
  statWrong.textContent = wrongCount.toString();
}

async function saveAnswer(answer, isCorrect) {
  const q = questions[currentIndex];
  if (!q) return;

  try {
    await addDoc(collection(db, "responses"), {
      responseId,
      questionId: q.id || null,
      questionText: q.text,
      type: q.type,
      answer,
      correct: isCorrect,
      time: serverTimestamp()
    });
  } catch (err) {
    console.error("Error saving answer:", err);
  }
}

function handleAnswer(answer) {
  if (isLocked) return;
  isLocked = true;
  disableOptions(true);
  nextBtn.style.display = "inline-block";
  nextBtn.disabled = false;

  const q = questions[currentIndex];
  if (!q) return;

  const isCorrect = answer === q.correctAnswer;
  passedCount += 1;
  if (isCorrect) {
    correctCount += 1;
  } else {
    wrongCount += 1;
  }
  updateStats();

  resultEl.textContent = isCorrect ? "Right ✅" : "Wrong ❌";
  resultEl.classList.toggle("good", isCorrect);
  resultEl.classList.toggle("bad", !isCorrect);

  const gifPath = isCorrect ? q.happyGif : q.angryGif;
  const gifPrefix = isCorrect ? "dudu/happy" : "dudu/angry";
  if (gifPath) {
    setDuduImage(gifPath, true, gifPrefix);
  }

  saveAnswer(answer, isCorrect);

}

function renderOptions(question) {
  optionsContainer.innerHTML = "";

  if (question.type === "yesno") {
    createOptionButton("yes", "Yes 😍");
    createOptionButton("no", "No 😏");
  }

  if (question.type === "mcq") {
    (question.options || []).forEach(option => {
      createOptionButton(option, option);
    });
  }
}

function createOptionButton(value, label) {
  const btn = document.createElement("button");
  btn.textContent = label;

  btn.addEventListener("click", () => {
    handleAnswer(value);
  });

  optionsContainer.appendChild(btn);
}

function showQuestion() {
  const q = questions[currentIndex];
  if (!q) return;

  setDuduImage(defaultDudu);
  questionEl.textContent = q.text;
  animateQuestion(q.questionAnimation || "fade-in");
  renderOptions(q);
  disableOptions(false);
  nextBtn.style.display = "none";
  nextBtn.disabled = true;
  resultEl.textContent = "";
  resultEl.classList.remove("good", "bad");

  hintEl.textContent = q.type === "mcq" ? "Choose one option 💫" : "Pick Yes or No 💕";
  progressEl.textContent = `Question ${currentIndex + 1} of ${questions.length}`;

  isLocked = false;
}

function showEmptyState() {
  questionEl.textContent = "No questions yet 💌";
  hintEl.textContent = "Ask the admin to add some questions.";
  progressEl.textContent = "";
  optionsContainer.innerHTML = "";
  nextBtn.style.display = "none";
  resultEl.textContent = "";
  resultEl.classList.remove("good", "bad");
  passedCount = 0;
  correctCount = 0;
  wrongCount = 0;
  updateStats();
}

function nextQuestion() {
  currentIndex++;

  if (currentIndex < questions.length) {
    setTimeout(showQuestion, 500);
  } else {
    questionEl.textContent = "Yay! That’s all 💕";
    hintEl.textContent = "";
    progressEl.textContent = "";
    optionsContainer.innerHTML = "";
    nextBtn.style.display = "none";
    resultEl.textContent = "";
    resultEl.classList.remove("good", "bad");
    setDuduImage(finalGif, true);
  }
}

nextBtn.addEventListener("click", () => {
  if (!isLocked) return;
  nextBtn.disabled = true;
  nextQuestion();
});

function normalizeQuestion(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    type: data.type || "yesno",
    text: data.text || "",
    options: data.options || [],
    correctAnswer: data.correctAnswer || "yes",
    questionAnimation: data.questionAnimation || "fade-in",
    happyAnim: data.happyAnim || "dudu-happy",
    angryAnim: data.angryAnim || "dudu-angry",
    happyGif: data.happyGif || "",
    angryGif: data.angryGif || "",
    active: data.active !== false,
    order: typeof data.order === "number" ? data.order : 0
  };
}

const questionsQuery = query(collection(db, "questions"), orderBy("order", "asc"));
onSnapshot(questionsQuery, snapshot => {
  questions = snapshot.docs.map(normalizeQuestion).filter(q => q.active);

  if (!questions.length) {
    showEmptyState();
    return;
  }

  currentIndex = 0;
  passedCount = 0;
  correctCount = 0;
  wrongCount = 0;
  updateStats();
  showQuestion();
});

