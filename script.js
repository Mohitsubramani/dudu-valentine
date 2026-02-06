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

const defaultDudu = "./public/dudu/happy.png";

let questions = [];
let currentIndex = 0;
let isLocked = false;

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

function resolveGifPath(value) {
  if (!value) return "";
  if (value.startsWith("http")) return value;
  if (value.startsWith("./") || value.startsWith("/")) return value;
  return `./public/${value}`;
}

function setDuduImage(src, bust = false) {
  if (!src) return;
  const resolved = resolveGifPath(src);
  const url = bust
    ? `${resolved}${resolved.includes("?") ? "&" : "?"}v=${Date.now()}`
    : resolved;
  dudu.src = url;
}

function disableOptions(disabled) {
  const buttons = optionsContainer.querySelectorAll("button");
  buttons.forEach(btn => {
    btn.disabled = disabled;
  });
}

async function saveAnswer(answer, isCorrect) {
  const q = questions[currentIndex];
  if (!q) return;

  try {
    await addDoc(collection(db, "responses"), {
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

  const q = questions[currentIndex];
  if (!q) return;

  const isCorrect = answer === q.correctAnswer;

  resetDuduAnimation();

  const animClass = isCorrect ? q.happyAnim : q.angryAnim;
  if (animClass) {
    dudu.classList.add(animClass);
  }

  const gifPath = isCorrect ? q.happyGif : q.angryGif;
  if (gifPath) {
    setDuduImage(gifPath, true);
  }

  saveAnswer(answer, isCorrect);

  setTimeout(nextQuestion, 700);
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

  hintEl.textContent = q.type === "mcq" ? "Choose one option 💫" : "Pick Yes or No 💕";
  progressEl.textContent = `Question ${currentIndex + 1} of ${questions.length}`;

  isLocked = false;
}

function showEmptyState() {
  questionEl.textContent = "No questions yet 💌";
  hintEl.textContent = "Ask the admin to add some questions.";
  progressEl.textContent = "";
  optionsContainer.innerHTML = "";
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
  }
}

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
  showQuestion();
});

