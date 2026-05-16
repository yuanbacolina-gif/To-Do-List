(() => {
“use strict”;

let tasks = [];
let filter = “all”;
let soundOn = true;
let musicOn = false;
let pendingDeadline = null;
let pickedTaskId = null;
let spinning = false;

const STORAGE_KEY = “todo.tasks.v1”;
const SOUND_KEY = “todo.sound.v1”;
const FILTER_KEY = “todo.filter.v1”;
const MUSIC_KEY = “todo.music.v1”;

const $ = (sel) => document.querySelector(sel);

const elList = $(”#task-list”);
const elEmpty = $(”#empty-state”);
const elEmptyMsg = $(”#empty-message”);
const elCounter = $(”#counter”);
const elForm = $(”#add-form”);
const elInput = $(”#task-input”);
const elDeadline = $(”#deadline-input”);
const elPending = $(”#pending-deadline”);
const elPendingLabel = $(”#pending-deadline-label”);
const elClearDeadline = $(”#clear-deadline”);
const elClearDone = $(”#clear-done”);
const elSoundToggle = $(”#sound-toggle”);
const elMusicToggle = $(”#music-toggle”);
const elBgMusic = $(”#bg-music”);
const elToday = $(”#today”);
const tpl = $(”#task-template”);
const elPickerRow = $(”#picker-row”);
const elPickBtn = $(”#pick-btn”);

function loadState() {
try {
const raw = localStorage.getItem(STORAGE_KEY);
if (raw) tasks = JSON.parse(raw);
} catch { tasks = []; }
soundOn = localStorage.getItem(SOUND_KEY) !== “0”;
musicOn = localStorage.getItem(MUSIC_KEY) === “1”;
filter = localStorage.getItem(FILTER_KEY) || “all”;
}

function saveTasks() { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
function saveSound() { localStorage.setItem(SOUND_KEY, soundOn ? “1” : “0”); }
function saveFilter() { localStorage.setItem(FILTER_KEY, filter); }
function saveMusic() { localStorage.setItem(MUSIC_KEY, musicOn ? “1” : “0”); }

function uid() {
return “t_” + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
}

const EMPTY_MESSAGES = [
“all clear. take a breath.”,
“nothing here. plan something small.”,
“blank slate.”,
“you’re ahead of yourself.”,
];

function formatRemaining(ms) {
const abs = Math.abs(ms);
const min = Math.round(abs / 60_000);
const hr = Math.floor(min / 60);
const day = Math.floor(hr / 24);
if (ms <= 0) return “overdue”;
if (min < 1) return “now”;
if (min < 60) return `in ${min}m`;
if (hr < 24) return `in ${hr}h ${min % 60}m`;
if (day < 7) return day === 1 ? “tomorrow” : `in ${day}d`;
return new Date(Date.now() + ms).toLocaleDateString(undefined, { month: “short”, day: “numeric” });
}

function deadlineStyle(deadline) {
const diff = deadline - Date.now();
if (diff <= 0) return { cls: “text-danger”, urgent: true, text: “overdue” };
if (diff < 60 * 60_000) return { cls: “text-danger”, urgent: true, text: formatRemaining(diff) };
if (diff < 24 * 3600_000) return { cls: “text-warn”, urgent: false, text: formatRemaining(diff) };
return { cls: “text-muted”, urgent: false, text: formatRemaining(diff) };
}

function formatDateHeader() {
return new Date().toLocaleDateString(undefined, { weekday: “long”, month: “long”, day: “numeric” });
}

// synth chime using web audio API no audio file needed
let audioCtx = null;
function playDing() {
if (!soundOn) return;
try {
audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
const t = audioCtx.currentTime;
const o = audioCtx.createOscillator();
const g = audioCtx.createGain();
o.type = “sine”;
o.frequency.setValueAtTime(880, t);
o.frequency.exponentialRampToValueAtTime(1320, t + 0.08);
g.gain.setValueAtTime(0.0001, t);
g.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
o.connect(g).connect(audioCtx.destination);
o.start(t);
o.stop(t + 0.3);
} catch { }
}

function addTask(text, deadline) {
const clean = text.trim();
if (!clean) return;
tasks.unshift({
id: uid(),
text: clean,
done: false,
createdAt: Date.now(),
deadline: deadline || null,
});
saveTasks();
renderTasks();
}

function toggleTask(id) {
const t = tasks.find(x => x.id === id);
if (!t) return;
t.done = !t.done;
if (t.done) playDing();
saveTasks();
renderTasks();
}

function deleteTask(id) {
const li = elList.querySelector(`[data-id="${id}"]`);
if (li) {
li.classList.add(“leaving”);
li.addEventListener(“animationend”, () => {
tasks = tasks.filter(x => x.id !== id);
saveTasks();
renderTasks();
}, { once: true });
} else {
tasks = tasks.filter(x => x.id !== id);
saveTasks();
renderTasks();
}
}

function clearCompleted() {
const stillThere = tasks.filter(t => !t.done);
if (stillThere.length === tasks.length) return;
tasks = stillThere;
saveTasks();
renderTasks();
}

function setFilter(name) {
filter = name;
saveFilter();
document.querySelectorAll(”.filter-chip”).forEach(chip => {
chip.setAttribute(“aria-selected”, chip.dataset.filter === name ? “true” : “false”);
});
renderTasks();
}

function visibleTasks() {
if (filter === “active”) return tasks.filter(t => !t.done);
if (filter === “done”) return tasks.filter(t => t.done);
return tasks;
}

function renderTasks() {
clearPicked();
elList.innerHTML = “”;
const visible = visibleTasks();
const left = tasks.filter(t => !t.done).length;
const done = tasks.length - left;

elCounter.textContent = tasks.length === 0
? “nothing yet — write something below”
: `${left} left · ${done} done`;

if (visible.length === 0) {
elEmpty.classList.remove(“hidden”);
if (tasks.length === 0) {
elEmptyMsg.textContent = EMPTY_MESSAGES[Math.floor(Math.random() * EMPTY_MESSAGES.length)];
} else if (filter === “active”) {
elEmptyMsg.textContent = “no active tasks. nice.”;
} else {
elEmptyMsg.textContent = “nothing done yet.”;
}
} else {
elEmpty.classList.add(“hidden”);
}

elClearDone.classList.toggle(“hidden”, done === 0);

const frag = document.createDocumentFragment();
visible.forEach(t => frag.appendChild(buildTaskRow(t)));
elList.appendChild(frag);

elPickerRow.classList.toggle(“hidden”, left < 2);
}

function buildTaskRow(task) {
const node = tpl.content.firstElementChild.cloneNode(true);
node.dataset.id = task.id;
if (task.done) node.classList.add(“done”);
node.querySelector(”.task-text”).textContent = task.text;

const meta = node.querySelector(”.task-meta”);
const lbl = node.querySelector(”.meta-label”);

if (task.deadline) {
const s = deadlineStyle(task.deadline);
meta.classList.remove(“hidden”);
meta.classList.add(“inline-flex”);
meta.classList.remove(“text-danger”, “text-warn”, “text-muted”);
meta.classList.add(s.cls);
meta.classList.toggle(“urgent”, s.urgent && !task.done);
lbl.textContent = s.text;
if (task.done) meta.classList.add(“opacity-60”);
}

node.querySelector(”.task-toggle”).addEventListener(“click”, () => toggleTask(task.id));
node.querySelector(”.task-delete”).addEventListener(“click”, () => deleteTask(task.id));
return node;
}

function tickAllCountdowns() {
elList.querySelectorAll(”.task”).forEach(li => {
const t = tasks.find(x => x.id === li.dataset.id);
if (!t || !t.deadline) return;
const meta = li.querySelector(”.task-meta”);
const lbl = li.querySelector(”.meta-label”);
const s = deadlineStyle(t.deadline);
meta.classList.remove(“text-danger”, “text-warn”, “text-muted”);
meta.classList.add(s.cls);
meta.classList.toggle(“urgent”, s.urgent && !t.done);
lbl.textContent = s.text;
});
}

function clearPicked() {
pickedTaskId = null;
spinning = false;
elList.querySelectorAll(”.picked”).forEach(li => {
li.classList.remove(“picked”);
li.querySelectorAll(”.picked-tag”).forEach(tag => tag.remove());
});
elList.querySelectorAll(”.cycling”).forEach(li => li.classList.remove(“cycling”));
}

function flashTask(id) {
const li = elList.querySelector(`[data-id="${id}"]`);
if (!li) return;
li.classList.remove(“cycling”);
void li.offsetWidth;
li.classList.add(“cycling”);
setTimeout(() => li.classList.remove(“cycling”), 200);
}

function applyPickedClass(id) {
const li = elList.querySelector(`[data-id="${id}"]`);
if (!li) return;
li.classList.add(“picked”);
const tag = document.createElement(“span”);
tag.className = “picked-tag”;
tag.textContent = “start with this →”;
li.querySelector(”.task-text”).after(tag);
li.scrollIntoView({ behavior: “smooth”, block: “nearest” });
}

function playSpinStep(steps, i) {
if (!spinning) return;
if (i >= steps.length) {
spinning = false;
pickedTaskId = steps[steps.length - 1].id;
applyPickedClass(pickedTaskId);
return;
}
const { id, delay } = steps[i];
flashTask(id);
setTimeout(() => playSpinStep(steps, i + 1), delay || 60);
}

function pickForMe() {
if (spinning) return;
clearPicked();
const active = tasks.filter(t => !t.done);
if (active.length < 2) return;

const winnerIdx = Math.floor(Math.random() * active.length);
const rndOther = () => {
let idx;
do { idx = Math.floor(Math.random() * active.length); }
while (idx === winnerIdx);
return idx;
};

const steps = [];
const leadCount = 6 + Math.floor(Math.random() * 4);
for (let i = 0; i < leadCount; i++) {
steps.push({ id: active[rndOther()].id, delay: 100 });
}
[150, 220, 320, 450, 600].forEach(d => {
steps.push({ id: active[rndOther()].id, delay: d });
});
steps.push({ id: active[winnerIdx].id, delay: 0 });

spinning = true;
playSpinStep(steps, 0);
}

function setPendingDeadline(ms) {
pendingDeadline = ms;
if (!ms) {
elPending.classList.add(“hidden”);
elDeadline.value = “”;
return;
}
elPending.classList.remove(“hidden”);
const diff = ms - Date.now();
elPendingLabel.textContent = diff > 0 ? `due ${formatRemaining(diff)}` : “due (already past)”;
}

function openDatePicker() {
// Try showPicker() first (Chrome, Firefox, Safari 16+)
// Fall back to temporarily enabling pointer events and calling click() for older iOS
if (typeof elDeadline.showPicker === “function”) {
try {
elDeadline.showPicker();
return;
} catch { }
}
// Fallback for older browsers
elDeadline.style.pointerEvents = “auto”;
elDeadline.focus();
elDeadline.click();
elDeadline.style.pointerEvents = “none”;
}

function wireEvents() {
elForm.addEventListener(“submit”, (e) => {
e.preventDefault();
addTask(elInput.value, pendingDeadline);
elInput.value = “”;
setPendingDeadline(null);
elInput.focus();
});

elInput.addEventListener(“keydown”, (e) => {
if (e.key === “Escape”) {
elInput.value = “”;
setPendingDeadline(null);
}
});

// Open date picker when calendar icon label is tapped
document.querySelector(‘label[title=“Set a deadline”]’).addEventListener(“click”, (e) => {
e.preventDefault();
openDatePicker();
});

const calendarTrigger = document.getElementById("calendar-trigger");

calendarTrigger.addEventListener("click", () => {
  if (elDeadline.showPicker) {
    elDeadline.showPicker();
  } else {
    elDeadline.focus();
    elDeadline.click();
  }
});

elDeadline.addEventListener(“change”, () => {
if (!elDeadline.value) { setPendingDeadline(null); return; }
const ms = new Date(elDeadline.value).getTime();
if (Number.isFinite(ms)) setPendingDeadline(ms);
});

elClearDeadline.addEventListener(“click”, () => setPendingDeadline(null));

document.querySelectorAll(”.filter-chip”).forEach(chip => {
chip.addEventListener(“click”, () => setFilter(chip.dataset.filter));
});

elClearDone.addEventListener(“click”, clearCompleted);
elPickBtn.addEventListener(“click”, pickForMe);
elMusicToggle.addEventListener(“click”, toggleMusic);

elSoundToggle.addEventListener(“click”, () => {
soundOn = !soundOn;
saveSound();
updateSoundIcon();
if (soundOn) playDing();
});
}

function updateSoundIcon() {
const use = elSoundToggle.querySelector(“use”);
use.setAttribute(“href”, soundOn ? “#i-sound-on” : “#i-sound-off”);
elSoundToggle.setAttribute(“aria-label”, soundOn ? “Mute completion sound” : “Unmute completion sound”);
}

function updateMusicIcon() {
elMusicToggle.style.color = musicOn ? “var(–color-accent, #C2410C)” : “”;
elMusicToggle.setAttribute(“aria-label”, musicOn ? “Pause background music” : “Play background music”);
}

function toggleMusic() {
musicOn = !musicOn;
saveMusic();
updateMusicIcon();
if (musicOn) {
elBgMusic.volume = 0.35;
elBgMusic.play().catch(() => { musicOn = false; saveMusic(); updateMusicIcon(); });
} else {
elBgMusic.pause();
}
}

function init() {
loadState();
elToday.textContent = formatDateHeader();
setFilter(filter);
updateSoundIcon();
updateMusicIcon();
wireEvents();
setInterval(tickAllCountdowns, 30_000);
}

document.addEventListener(“DOMContentLoaded”, init);

})();