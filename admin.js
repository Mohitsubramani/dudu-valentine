import { db } from "./firebase.js";
import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	onSnapshot,
	orderBy,
	query,
	serverTimestamp,
	updateDoc,
	limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const questionForm = document.getElementById("questionForm");
const questionsList = document.getElementById("questionsList");
const responsesList = document.getElementById("responsesList");
const toggleResponses = document.getElementById("toggleResponses");
const statAdminCorrect = document.getElementById("statAdminCorrect");
const statAdminWrong = document.getElementById("statAdminWrong");
const statAdminTotal = document.getElementById("statAdminTotal");

const qText = document.getElementById("qText");
const qType = document.getElementById("qType");
const qOptions = document.getElementById("qOptions");
const qCorrectYesNo = document.getElementById("qCorrectYesNo");
const qCorrectMcq = document.getElementById("qCorrectMcq");
const qQuestionAnimation = document.getElementById("qQuestionAnimation");
const qHappyAnim = document.getElementById("qHappyAnim");
const qAngryAnim = document.getElementById("qAngryAnim");
const qHappyGif = document.getElementById("qHappyGif");
const qAngryGif = document.getElementById("qAngryGif");
const qOrder = document.getElementById("qOrder");
const qActive = document.getElementById("qActive");
const cancelEditBtn = document.getElementById("cancelEdit");
const mcqOptionsField = document.getElementById("mcqOptionsField");
const correctYesNoField = document.getElementById("correctYesNoField");
const correctMcqField = document.getElementById("correctMcqField");

let editingId = null;
let cachedQuestions = [];
let responsesVisible = false;

function updateTypeUI() {
	const isMcq = qType.value === "mcq";
	mcqOptionsField.style.display = isMcq ? "grid" : "none";
	correctMcqField.style.display = isMcq ? "grid" : "none";
	correctYesNoField.style.display = isMcq ? "none" : "grid";
}

function parseOptions() {
	return qOptions.value
		.split(",")
		.map(option => option.trim())
		.filter(Boolean);
}

function normalizeGifField(value, type) {
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

	if (!cleaned.includes("/")) {
		cleaned = `dudu/${type}/${cleaned}`;
	}

	if (!/\.(gif|png|jpg|jpeg|webp)$/i.test(cleaned)) {
		cleaned = `${cleaned}.gif`;
	}

	return cleaned;
}

function getCorrectAnswer(type, options) {
	if (type === "yesno") {
		return qCorrectYesNo.value;
	}

	const value = qCorrectMcq.value.trim();
	if (value && options.includes(value)) {
		return value;
	}

	return options[0] || "";
}

function resetForm() {
	questionForm.reset();
	qType.value = "yesno";
	qQuestionAnimation.value = "fade-in";
	qHappyAnim.value = "dudu-happy";
	qAngryAnim.value = "dudu-angry";
	qActive.value = "true";
	qOrder.value = (cachedQuestions.length ? Math.max(...cachedQuestions.map(q => q.order || 0)) + 1 : 0).toString();
	editingId = null;
	updateTypeUI();
}

function fillForm(question) {
	qText.value = question.text || "";
	qType.value = question.type || "yesno";
	qOptions.value = (question.options || []).join(", ");
	qCorrectYesNo.value = question.correctAnswer || "yes";
	qCorrectMcq.value = question.correctAnswer || "";
	qQuestionAnimation.value = question.questionAnimation || "fade-in";
	qHappyAnim.value = question.happyAnim || "dudu-happy";
	qAngryAnim.value = question.angryAnim || "dudu-angry";
	qHappyGif.value = question.happyGif || "";
	qAngryGif.value = question.angryGif || "";
	qOrder.value = (typeof question.order === "number" ? question.order : 0).toString();
	qActive.value = question.active === false ? "false" : "true";
	updateTypeUI();
}

questionForm.addEventListener("submit", async event => {
	event.preventDefault();

	const type = qType.value;
	const options = type === "mcq" ? parseOptions() : [];
	const correctAnswer = getCorrectAnswer(type, options);

	if (!qText.value.trim()) return;
	if (type === "mcq" && options.length < 2) {
		alert("Please provide at least 2 options for MCQ.");
		return;
	}

	const payload = {
		text: qText.value.trim(),
		type,
		options,
		correctAnswer,
		questionAnimation: qQuestionAnimation.value,
		happyAnim: qHappyAnim.value,
		angryAnim: qAngryAnim.value,
		happyGif: normalizeGifField(qHappyGif.value, "happy"),
		angryGif: normalizeGifField(qAngryGif.value, "angry"),
		order: Number(qOrder.value) || 0,
		active: qActive.value === "true",
		updatedAt: serverTimestamp()
	};

	try {
		if (editingId) {
			await updateDoc(doc(db, "questions", editingId), payload);
		} else {
			await addDoc(collection(db, "questions"), {
				...payload,
				createdAt: serverTimestamp()
			});
		}
		resetForm();
	} catch (err) {
		console.error("Error saving question:", err);
	}
});

cancelEditBtn.addEventListener("click", () => {
	resetForm();
});

qType.addEventListener("change", updateTypeUI);

const questionsQuery = query(collection(db, "questions"), orderBy("order", "asc"));
onSnapshot(questionsQuery, snapshot => {
	cachedQuestions = snapshot.docs.map(docSnap => {
		const data = docSnap.data();
		return { id: docSnap.id, ...data };
	});
	renderQuestions(cachedQuestions);
	if (!editingId) resetForm();
});

function renderQuestions(list) {
	questionsList.innerHTML = "";
	if (!list.length) {
		questionsList.innerHTML = "<div class='item'>No questions yet.</div>";
		return;
	}

	list.forEach(question => {
		const item = document.createElement("div");
		item.className = "item";

		const optionsText = question.type === "mcq"
			? `Options: ${(question.options || []).join(", ")}`
			: "Options: Yes / No";

		item.innerHTML = `
			<div class="item-header">
				<div>
					<div class="item-title">${question.text}</div>
					<div class="item-meta">
						<span class="badge">${question.type?.toUpperCase() || "YESNO"}</span>
						${question.active === false ? "<span class=\"badge\">Hidden</span>" : ""}
					</div>
				</div>
				<div class="item-actions">
					<button data-action="edit" data-id="${question.id}">Edit</button>
					<button data-action="delete" data-id="${question.id}">Delete</button>
				</div>
			</div>
			<div class="item-meta">${optionsText}</div>
			<div class="item-meta">Correct: ${question.correctAnswer || "-"}</div>
			<div class="item-meta">Question anim: ${question.questionAnimation || "-"}</div>
			<div class="item-meta">Dudu: ${question.happyAnim || "-"} / ${question.angryAnim || "-"}</div>
			<div class="item-meta">GIFs: ${question.happyGif || "-"} / ${question.angryGif || "-"}</div>
		`;

		item.querySelectorAll("button").forEach(btn => {
			const action = btn.dataset.action;
			const id = btn.dataset.id;
			if (action === "edit") {
				btn.addEventListener("click", () => {
					editingId = id;
					const q = cachedQuestions.find(item => item.id === id);
					if (q) fillForm(q);
				});
			}
			if (action === "delete") {
				btn.addEventListener("click", async () => {
					if (!confirm("Delete this question?")) return;
					await deleteDoc(doc(db, "questions", id));
				});
			}
		});

		questionsList.appendChild(item);
	});
}

const responsesQuery = query(
	collection(db, "responses"),
	orderBy("time", "desc"),
	limit(50)
);

onSnapshot(responsesQuery, snapshot => {
	const items = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
	renderResponses(items);
});

function formatTime(timestamp) {
	if (!timestamp?.toDate) return "-";
	return timestamp.toDate().toLocaleString();
}

function renderResponses(list) {
	responsesList.innerHTML = "";
	if (!list.length) {
		responsesList.innerHTML = "<div class='item'>No responses yet.</div>";
		statAdminCorrect.textContent = "0";
		statAdminWrong.textContent = "0";
		statAdminTotal.textContent = "0";
		return;
	}

	const correctCount = list.filter(item => item.correct).length;
	const totalCount = list.length;
	const wrongCount = totalCount - correctCount;

	statAdminCorrect.textContent = correctCount.toString();
	statAdminWrong.textContent = wrongCount.toString();
	statAdminTotal.textContent = totalCount.toString();

	const grouped = list.reduce((acc, item) => {
		const key = item.sessionId || "unknown";
		if (!acc[key]) acc[key] = [];
		acc[key].push(item);
		return acc;
	}, {});

	const sessions = Object.entries(grouped).map(([sessionId, items]) => {
		const latest = items.reduce((max, current) => {
			if (!max) return current;
			return (current.time?.toDate?.() || 0) > (max.time?.toDate?.() || 0) ? current : max;
		}, null);
		return { sessionId, items, latest };
	}).sort((a, b) => {
		const aTime = a.latest?.time?.toDate?.() || 0;
		const bTime = b.latest?.time?.toDate?.() || 0;
		return bTime - aTime;
	});

	sessions.forEach(session => {
		const sessionCorrect = session.items.filter(item => item.correct).length;
		const sessionTotal = session.items.length;
		const sessionWrong = sessionTotal - sessionCorrect;

		const div = document.createElement("div");
		div.className = "item is-clickable";
		div.innerHTML = `
			<div class="item-header">
				<div>
					<div class="item-title">Response ${session.sessionId}</div>
					<div class="item-meta">${formatTime(session.latest?.time)}</div>
				</div>
				<div class="badge ${sessionWrong === 0 ? "status-good" : "status-bad"}">
					${sessionCorrect} / ${sessionTotal}
				</div>
			</div>
			<div class="item-meta">Correct: ${sessionCorrect} | Wrong: ${sessionWrong}</div>
			<div class="item-details">
				${session.items.map(item => `
					<div><strong>${item.questionText || "Question"}</strong></div>
					<div>Answer: ${item.answer || "-"}</div>
					<div>Result: ${item.correct ? "Correct" : "Wrong"}</div>
					<div class="item-meta">${formatTime(item.time)}</div>
					<hr />
				`).join("")}
			</div>
		`;
		div.addEventListener("click", () => {
			div.classList.toggle("show-details");
		});
		responsesList.appendChild(div);
	});
}

toggleResponses.addEventListener("click", () => {
	responsesVisible = !responsesVisible;
	responsesList.classList.toggle("is-collapsed", !responsesVisible);
	toggleResponses.textContent = responsesVisible ? "Hide" : "Show all";
});

updateTypeUI();
resetForm();
