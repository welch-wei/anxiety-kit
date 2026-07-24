
var SYMPTOMS = getSymptoms();
var TRIGGERS = getTriggers();
var PMR_STEPS = getPMRSteps();
let selectedSymptoms = new Set();
let selectedTriggers = new Set();
let isPro = false;
let trialDays = 0;
let selectedPlan = 'month';
let chartInstance = null;
let triggerChartInstance = null;
let breathTimer = null;
let pmrTimer = null;
let pmrIndex = 0;
let sleepTimer = null;
const $ = id => document.getElementById(id);
function toast(msg) {
const el = $('toast');
el.textContent = msg;
el.classList.add('show');
setTimeout(() => el.classList.remove('show'), 2500);
}
function bindActions() {
const handlers = {
  toggleChip: el => toggleChip(el.dataset.type, el.dataset.value),
  markCalmedById: el => markCalmedById(parseInt(el.dataset.id)),
  deleteRecord: el => deleteRecord(parseInt(el.dataset.id)),
  sosToBreathing: () => { closeModal('sosModal'); openBreathing(); },
  sosToGrounding: () => { closeModal('sosModal'); openGrounding(); },
  sosToPMR: () => { closeModal('sosModal'); openPMR(); },
  sosToCBT: () => { closeModal('sosModal'); openCBT(); },
  sosToDump: () => { closeModal('sosModal'); openDump(); },
  sosToHotlines: () => { closeModal('sosModal'); openHotlines(); },
  showPaywall: showPaywall,
  openSOS: openSOS,
  openBreathing: openBreathing,
  openGrounding: openGrounding,
  openCBT: openCBT,
  openDump: openDump,
  openPMR: openPMR,
  openSleep: openSleep,
  openPrevention: openPrevention,
  openHotlines: openHotlines,
  saveRecord: saveRecord,
  startBreathing: startBreathing,
  stopBreathing: stopBreathing,
  startPMR: startPMR,
  selectPlan: el => selectPlan(el),
  upgrade: upgrade,
  exportPDF: exportPDF,
  toggleCheck: el => toggleCheck(el),
  resetData: e => { e.preventDefault(); resetData(); },
  exportJSON: e => { e.preventDefault(); exportJSON(); },
  showAlipay: showAlipay,
  redeemCode: redeemCode,
  saveCrisisPlan: saveCrisisPlan
};

document.querySelectorAll('[data-action]').forEach(el => {
  const action = el.dataset.action;
  if (!handlers[action]) return;
  el.addEventListener('click', e => {
    if (action === 'resetData' || action === 'exportJSON') e.preventDefault();
    handlers[action](el, e);
  });
});

// 全局事件委托兜底：所有 data-action 元素都能触发
document.body.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  if (action === 'resetData' || action === 'exportJSON') e.preventDefault();
  if (handlers[action]) handlers[action](el, e);
});
}


function init() {
  if (typeof applyLanguage === 'function') applyLanguage();
renderSymptoms();
renderTriggers();
renderChartTabs();
loadPlan();
loadData();
renderTriggerChart();
updateLockedCards();
bindActions();
  loadRemoteCodes();
}
function loadPlan() {
isPro = localStorage.getItem('anxiety_pro') === '1';
const trialStart = parseInt(localStorage.getItem('anxiety_trial_start') || '0');
if (trialStart) {
const elapsed = Math.floor((Date.now() - trialStart) / (86400000));
trialDays = Math.max(0, 7 - elapsed);
if (trialDays > 0) isPro = true;
}
// support paid expiry
const proExpires = parseInt(localStorage.getItem('proExpires') || '0');
if (proExpires && Date.now() < proExpires) {
  isPro = true;
}
const badge = $('planBadge');
badge.textContent = isPro ? t('plan_pro') : t('plan_free');
badge.classList.toggle('pro', isPro);
if (isPro) {
$('paywall').classList.add('hidden');
$('adBanner').classList.add('hidden');
}
const trialHint = $('trialHint');
if (trialHint) trialHint.textContent = trialDays > 0 ? t('trial_left').replace('{days}', trialDays) : (isPro ? t('pro_activated') : t('upgrade_now'));
}
function updateLockedCards() {
document.querySelectorAll('.quick-card.locked').forEach(c => {
if (isPro) { c.classList.remove('locked'); c.querySelector('.title').style.opacity = '1'; }
});
}
function renderSymptoms() {
$('symptomGrid').innerHTML = SYMPTOMS.map(s => `<div class="chip" data-action="toggleChip" data-type="symptom" data-value="${s}">${s}</div>`).join('');
}
function renderTriggers() {
$('triggerGrid').innerHTML = TRIGGERS.map(t => `<div class="chip" data-action="toggleChip" data-type="trigger" data-value="${t}">${t}</div>`).join('');
}
function toggleChip(type, value) {
const set = type === 'symptom' ? selectedSymptoms : selectedTriggers;
if (set.has(value)) set.delete(value); else set.add(value);
document.querySelectorAll(`.chip[data-type="${type}"]`).forEach(c => { c.classList.toggle('active', set.has(c.dataset.value)); });
}
function updateIntensity() { $('intensityValue').textContent = `${$('intensity').value}/10`; }
function getRecords() {
try { return JSON.parse(localStorage.getItem('anxiety_records') || '[]'); }
catch (e) { return []; }
}
function saveRecords(records) { localStorage.setItem('anxiety_records', JSON.stringify(records)); }
function checkCrisis(text) {
if (!text) return false;
const crisisWords = ['自杀', '自残', '不想活', '不想活了', '结束生命', 'kill myself', 'suicide', 'self-harm', 'end my life', 'want to die', '想死', '活着没意思', '死了算了'];
return crisisWords.some(w => text.includes(w));
}
function saveRecord() {
const intensity = parseInt($('intensity').value);
const note = $('note').value.trim();
if (checkCrisis(note)) {
openHotlines();
toast(t('toast_crisis_text'));
return;
}
if (!isPro && getRecords().length >= 7) { showPaywall(); return toast(t('toast_free_limit')); }
const record = { id: Date.now(), intensity, symptoms: Array.from(selectedSymptoms), triggers: Array.from(selectedTriggers), note, time: Date.now(), tools: [], calmed: false };
const records = getRecords();
records.unshift(record);
saveRecords(records);
updateStreak();
resetForm();
loadData();
renderTriggerChart();
toast(t('toast_saved'));
openSOS();
}
function resetForm() {
$('intensity').value = 5;
updateIntensity();
selectedSymptoms.clear();
selectedTriggers.clear();
document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
$('note').value = '';
}
function updateStreak() {
const lastDate = localStorage.getItem('anxiety_last_record');
const today = new Date().toDateString();
if (lastDate === today) return;
let streak = parseInt(localStorage.getItem('anxiety_streak') || '0');
if (lastDate) {
const last = new Date(lastDate);
const diff = (new Date(today) - last) / (1000 * 60 * 60 * 24);
if (diff > 1.5) streak = 0;
}
streak++;
localStorage.setItem('anxiety_streak', streak);
localStorage.setItem('anxiety_last_record', today);
}
function getStreak() {
const lastDate = localStorage.getItem('anxiety_last_record');
const today = new Date().toDateString();
const yesterday = new Date(Date.now() - 86400000).toDateString();
let streak = parseInt(localStorage.getItem('anxiety_streak') || '0');
if (!lastDate) return 0;
if (lastDate !== today && lastDate !== yesterday) return 0;
return streak;
}
function loadData() {
const records = getRecords();
const visible = isPro ? records : records.slice(0, 7);
renderStats(visible);
renderHistory(visible);
renderChart('week');
}
function renderStats(records) {
if (!records.length) {
$('totalAttacks').textContent = '0'; $('avgIntensity').textContent = '-'; $('calmCount').textContent = '0'; $('streakDays').textContent = '0';
return;
}
$('totalAttacks').textContent = records.length;
$('avgIntensity').textContent = (records.reduce((s, r) => s + r.intensity, 0) / records.length).toFixed(1);
$('calmCount').textContent = records.filter(r => r.calmed).length;
$('streakDays').textContent = getStreak();
}
function renderHistory(records) {
const list = $('historyList');
if (!records.length) { list.innerHTML = `<div class="empty-state"><div class="emoji">📝</div><p>${t('empty_no_records')}</p><small>${t('empty_advice')}</small></div>`; return; }
list.innerHTML = records.slice(0, 10).map(r => {
const date = new Date(r.time);
const timeStr = date.toLocaleString(window.currentLang === 'en' ? 'en-US' : 'zh-CN', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
const color = r.intensity >= 7 ? '#f43f5e' : r.intensity >= 4 ? '#fbbf24' : '#34d399';
return `<div class="history-item"><div class="history-meta"><span style="color:${color};font-weight:700;">${t('history_intensity').replace('{n}', r.intensity)}</span><span>${timeStr}</span>${r.calmed ? `<span style=\"color:#34d399;\">${t('history_calmed')}</span>` : ''}</div><div class="history-text">${r.note ? escapeHtml(r.note) : t('history_no_text')}</div>${r.symptoms.length ? `<div style="margin-top:8px;">${r.symptoms.map(s => `<span style="display:inline-block;background:rgba(255,255,255,0.08);padding:3px 8px;border-radius:10px;font-size:0.7rem;margin-right:4px;">${s}</span>`).join('')}</div>` : ''}<div class="history-actions"><button data-action="markCalmedById" data-id="${r.id}">${t('mark_calmed')}</button><button data-action="deleteRecord" data-id="${r.id}">${t('delete')}</button></div></div>`;
}).join('');
}
function markCalmedById(id) {
const records = getRecords().map(r => r.id === id ? {...r, calmed: true} : r);
saveRecords(records); loadData();
toast(t('toast_calm_marked'));
}
function deleteRecord(id) {
if (!confirm(t('confirm_delete'))) return;
const records = getRecords().filter(r => r.id !== id);
saveRecords(records); loadData(); renderTriggerChart();
toast(t('toast_deleted'));
}
function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
function renderChartTabs() {
$('chartTabs').innerHTML = `<button class="tab active" data-action="switchChart" data-type="week">${t('tab_week')}</button><button class="tab" data-action="switchChart" data-type="month">${t('tab_month')}</button>`;
}
function switchChart(type, btn) {
if (!isPro && type === 'month') { showPaywall(); return toast(t('toast_pro_month')); }
document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
btn.classList.add('active');
renderChart(type);
}
function renderChart(type) {
const ctx = $('anxietyChart').getContext('2d');
const records = getRecords();
const days = type === 'week' ? 7 : 30;
const labels = [], data = [];
const now = new Date();
for (let i = days - 1; i >= 0; i--) {
const d = new Date(now); d.setDate(d.getDate() - i);
labels.push(`${d.getMonth()+1}/${d.getDate()}`);
const dayRecords = records.filter(r => { const rd = new Date(r.time); return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth() && rd.getDate() === d.getDate(); });
data.push(dayRecords.length ? dayRecords.reduce((s, r) => s + r.intensity, 0) / dayRecords.length : null);
}
if (chartInstance) chartInstance.destroy();
chartInstance = new Chart(ctx, {
type: 'line',
data: { labels, datasets: [{ label: t('chart_label_anxiety'), data, borderColor: '#38bdf8', backgroundColor: (ctx) => { const {chart, chartArea} = ctx.chart; if (!chartArea) return null; const g = chart.ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom); g.addColorStop(0, 'rgba(56,189,248,0.4)'); g.addColorStop(1, 'rgba(56,189,248,0)'); return g; }, borderWidth: 3, pointRadius: 5, pointBackgroundColor: '#fff', pointBorderColor: '#38bdf8', fill: true, tension: 0.4, spanGaps: true }] },
options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 10, grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: 'rgba(255,255,255,0.5)' } }, x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.5)' } } }, plugins: { legend: { display: false } } }
});
}
function renderTriggerChart() {
const ctx = $('triggerChart').getContext('2d');
const records = getRecords();
const counts = {};
records.forEach(r => r.triggers.forEach(t => counts[t] = (counts[t] || 0) + 1));
const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 6);
if (!sorted.length) { if (triggerChartInstance) triggerChartInstance.destroy(); return; }
const labels = sorted.map(([t]) => t); const data = sorted.map(([_, v]) => v);
const colors = ['#38bdf8', '#f43f5e', '#fbbf24', '#34d399', '#a78bfa', '#f472b6'];
if (triggerChartInstance) triggerChartInstance.destroy();
triggerChartInstance = new Chart(ctx, {
type: 'bar',
data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 8, borderWidth: 0 }] },
options: { responsive: true, maintainAspectRatio: false, scales: { y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: 'rgba(255,255,255,0.5)' } }, x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.5)' } } }, plugins: { legend: { display: false } } }
});
}
function showPaywall() { $('paywall').scrollIntoView({ behavior: 'smooth' }); }
function selectPlan(el) {
selectedPlan = el.dataset.plan;
el.classList.add('selected');
document.querySelectorAll('.price-box').forEach(b => { if (b !== el) b.classList.remove('selected'); });
// 同步更新二维码价格
if (!document.getElementById('qrPanel').classList.contains('hidden')) {
  document.getElementById('qrPrice').textContent = selectedPlan === 'year' ? '69' : '9.9';
  document.getElementById('qrPlan').textContent = selectedPlan === 'year' ? t('qr_year') : t('qr_month');
  document.getElementById('payMemo').textContent = selectedPlan === 'year' ? t('memo_year') : t('memo_month');
}
}
function upgrade() {
if (!localStorage.getItem('anxiety_trial_start')) {
localStorage.setItem('anxiety_trial_start', Date.now());
localStorage.setItem('anxiety_pro', '1');
toast(t('toast_trial_started'));
setTimeout(() => location.reload(), 1200);
} else {
showAlipay();
}
}
function openModal(id) { $(id).classList.add('show'); }
function closeModal(id) { $(id).classList.remove('show'); }
function openSOS() { openModal('sosModal'); }
function openHotlines() { openModal('hotlineModal'); }
function openGrounding() { openModal('groundingModal'); }
function openCBT() { openModal('cbtModal'); }
function openDump() { openModal('dumpModal'); }
function openPMR() { openModal('pmrModal'); }
function openSleep() { openModal('sleepModal'); }
function openPrevention() { openModal('preventionModal'); }
function openBreathing() { openModal('breathingModal'); }
function startBreathing() {
const circle = $('breathCircle'); const text = $('breathText'); const sub = $('breathSub'); const btn = $('breathStartBtn');
btn.classList.add('hidden');
let cycles = 0; const maxCycles = 3;
function cycle() {
if (cycles >= maxCycles) { text.textContent = t('breath_finish'); sub.textContent = t('breath_finish_tip'); btn.textContent = t('breath_again_btn'); btn.classList.remove('hidden'); circle.className = 'breath-circle'; return; }
text.textContent = t('breath_inhale'); sub.textContent = t('breath_inhale_tip'); circle.className = 'breath-circle inhale';
breathTimer = setTimeout(() => {
text.textContent = t('breath_hold'); sub.textContent = t('breath_hold_tip'); circle.className = 'breath-circle hold';
breathTimer = setTimeout(() => {
text.textContent = t('breath_exhale'); sub.textContent = t('breath_exhale_tip'); circle.className = 'breath-circle exhale';
breathTimer = setTimeout(() => { cycles++; cycle(); }, 8000);
}, 7000);
}, 4000);
}
cycle();
}
function stopBreathing() { clearTimeout(breathTimer); }
function startPMR() {
const btn = $('pmrBtn');
btn.classList.add('hidden');
pmrIndex = 0;
runPMRStep();
}
function runPMRStep() {
if (pmrIndex >= PMR_STEPS.length) { finishPMR(); return; }
const step = PMR_STEPS[pmrIndex];
const progress = ((pmrIndex + 1) / PMR_STEPS.length) * 100;
$('pmrProgress').style.width = `${progress}%`;
$('pmrStepCount').textContent = `${pmrIndex + 1} / ${PMR_STEPS.length}`;
$('pmrCircle').textContent = step.name;
$('pmrText').textContent = t('pmr_tense').replace('{desc}', step.tense);
$('pmrSub').textContent = t('pmr_hold');
pmrTimer = setTimeout(() => {
$('pmrText').textContent = t('pmr_relax').replace('{desc}', step.relax);
$('pmrSub').textContent = t('pmr_stay');
pmrTimer = setTimeout(() => { pmrIndex++; runPMRStep(); }, 10000);
}, 5000);
}
function finishPMR() {
$('pmrCircle').textContent = t('pmr_finish');
$('pmrText').textContent = t('pmr_finish_text');
$('pmrSub').textContent = t('pmr_finish_tip');
$('pmrBtn').textContent = t('pmr_again');
$('pmrBtn').classList.remove('hidden');
markCalmed('pmr');
}
function stopPMR() { clearTimeout(pmrTimer); }
function toggleCheck(el) {
const cb = el.querySelector('input');
cb.checked = !cb.checked;
el.classList.toggle('checked', cb.checked);
}
function startSleepBreathing() {
$('sleepBreath').classList.remove('hidden');
const circle = $('sleepCircle'); const text = $('sleepText'); const sub = $('sleepSub');
let cycles = 0;
function cycle() {
if (cycles >= 5) { text.textContent = t('sleep_done'); sub.textContent = t('sleep_done_tip'); circle.className = 'breath-circle'; return; }
text.textContent = t('sleep_inhale'); sub.textContent = t('breath_inhale_tip'); circle.className = 'breath-circle inhale';
sleepTimer = setTimeout(() => {
text.textContent = t('sleep_exhale'); sub.textContent = t('sleep_slow'); circle.className = 'breath-circle exhale';
sleepTimer = setTimeout(() => { cycles++; cycle(); }, 6000);
}, 4000);
}
cycle();
}
function markCalmed(tool) {
const records = getRecords();
if (records.length > 0) { records[0].calmed = true; if (tool) records[0].tools.push(tool); saveRecords(records); loadData(); }
toast(t('toast_calm_marked'));
closeModal('groundingModal');
}
function saveCBT() {
const thought = $('cbtThought').value.trim();
const probability = $('cbtProbability').value.trim();
const advice = $('cbtAdvice').value.trim();
const balance = $('cbtBalance').value.trim();
if (!thought) return toast(t('toast_enter_worry'));
if (checkCrisis(thought)) { openHotlines(); toast(t('toast_crisis_text')); return; }
const records = getRecords();
if (records.length > 0) { records[0].tools.push('cbt'); records[0].cbt = { thought, probability, advice, balance }; saveRecords(records); }
$('cbtThought').value = ''; $('cbtProbability').value = ''; $('cbtAdvice').value = ''; $('cbtBalance').value = '';
toast(t('toast_cbt_saved')); closeModal('cbtModal');
}
function emptyDump() { $('dumpText').value = ''; toast(t('dump_emptied')); closeModal('dumpModal'); }
function saveDump() {
const text = $('dumpText').value.trim();
if (!text) return toast(t('toast_no_content'));
if (checkCrisis(text)) { openHotlines(); toast(t('toast_crisis_text')); return; }
if (!isPro && getRecords().length >= 7) { showPaywall(); return toast(t('toast_free_record_limit')); }
const record = { id: Date.now(), intensity: 5, symptoms: [], triggers: [], note: text, time: Date.now(), tools: ['dump'], calmed: true };
const records = getRecords(); records.unshift(record); saveRecords(records); $('dumpText').value = ''; loadData(); renderTriggerChart();
toast(t('toast_dump_saved')); closeModal('dumpModal');
}
function exportPDF() {
if (!isPro) { showPaywall(); return toast(t('toast_pro_pdf')); }
const records = getRecords();
if (!records.length) return toast(t('toast_no_data'));
const { jsPDF } = window.jspdf;
const doc = new jsPDF();
doc.setFontSize(18); doc.text(t('pdf_title'), 14, 20);
doc.setFontSize(12); doc.text(t('pdf_generated') + new Date().toLocaleString(window.currentLang === 'en' ? 'en-US' : 'zh-CN'), 14, 30);
doc.text(t('pdf_summary').replace('{count}', records.length).replace('{avg}', (records.reduce((s,r)=>s+r.intensity,0)/records.length).toFixed(1)), 14, 40);
let y = 55;
records.slice(0, 20).forEach(r => {
const date = new Date(r.time).toLocaleString(window.currentLang === 'en' ? 'en-US' : 'zh-CN');
doc.text(`${date}  | ${t('history_intensity').replace('{n}', r.intensity)}`, 14, y); y += 7;
if (r.symptoms.length) { doc.text(t('pdf_symptoms') + r.symptoms.join(' / '), 14, y); y += 7; }
if (r.triggers.length) { doc.text(t('pdf_triggers') + r.triggers.join(' / '), 14, y); y += 7; }
if (r.note) { const lines = doc.splitTextToSize(r.note, 180); doc.text(lines, 14, y); y += lines.length * 6 + 4; }
y += 4;
if (y > 270) { doc.addPage(); y = 20; }
});
doc.save(window.currentLang === 'en' ? 'anxiety-kit-report.pdf' : '焦虑急救箱报告.pdf');
toast(t('toast_pdf_exported'));
}
function exportJSON() {
const records = getRecords();
if (!records.length) return toast(t('toast_no_data'));
const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a'); a.href = url; a.download = `anxiety-kit-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
toast(t('toast_json_exported'));
}
function resetData() {
if (confirm(t('confirm_reset'))) {
localStorage.removeItem('anxiety_records'); localStorage.removeItem('anxiety_pro'); localStorage.removeItem('anxiety_streak'); localStorage.removeItem('anxiety_last_record'); localStorage.removeItem('anxiety_trial_start');
toast(t('toast_data_reset')); setTimeout(() => location.reload(), 1000);
}
}
// Alipay QR + redeem code logic
function showAlipay() {
  const panel = document.getElementById('qrPanel');
  if (!panel) return;
  panel.classList.remove('hidden');
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  const selected = document.querySelector('.price-box.selected');
  const plan = selected ? selected.dataset.plan : 'month';
  document.getElementById('qrPrice').textContent = plan === 'year' ? '69' : '9.9';
  document.getElementById('qrPlan').textContent = plan === 'year' ? t('qr_year') : t('qr_month');
  document.getElementById('payMemo').textContent = plan === 'year' ? t('memo_year') : t('memo_month');
}

function redeemCode() {
  const input = document.getElementById('redeemInput').value.trim().toUpperCase();
  if (!input) return toast(t('toast_enter_code'));
  const validCodes = JSON.parse(localStorage.getItem('validProCodes') || '[]');
  const usedCodes = JSON.parse(localStorage.getItem('usedProCodes') || '[]');
  if (usedCodes.includes(input)) return toast(t('toast_code_used'));
  if (!validCodes.includes(input)) return toast(t('toast_code_invalid'));
  usedCodes.push(input);
  localStorage.setItem('usedProCodes', JSON.stringify(usedCodes));
  activatePro('兑换码');
  toast(t('toast_redeem_success'));
}

function activatePro(source) {
  const expires = Date.now() + 30 * 24 * 60 * 60 * 1000;
  localStorage.setItem('proExpires', expires.toString());
  localStorage.setItem('proSource', source || 'manual');
  loadPlan();
  updateLockedCards();
}

async function loadRemoteCodes() {
  try {
    const res = await fetch('https://raw.githubusercontent.com/welch-wei/anxiety-kit/main/codes.json');
    const remote = await res.json();
    if (!Array.isArray(remote)) return;
    const existing = JSON.parse(localStorage.getItem('validProCodes') || '[]');
    const merged = Array.from(new Set([...existing, ...remote]));
    localStorage.setItem('validProCodes', JSON.stringify(merged));
  } catch (e) { console.log('remote codes not loaded', e); }
}
document.addEventListener('DOMContentLoaded', init);



// 简易访问统计：先记录到本地，等接入 Umami/百度统计后替换
(function() {
  const key = 'anxietyKitVisits';
  const visits = parseInt(localStorage.getItem(key) || '0') + 1;
  localStorage.setItem(key, visits.toString());
  // TODO: 替换为真实 analytics endpoint
})();
