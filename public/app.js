import { offlineData } from './data.js';

const state = {
  models: [],
  subsystems: [],
  symptoms: [],
  components: [],
  flows: [],
  safetyNotes: [],
  selectedModel: null,
  selectedSubsystem: null,
  selectedSymptom: null,
  checksForJob: [],
  jobs: [],
};

const els = {
  cards: document.querySelectorAll('.card'),
  panels: document.querySelectorAll('section.panel, #home'),
  modelSelect: document.getElementById('modelSelect'),
  subsystemSelect: document.getElementById('subsystemSelect'),
  symptomSelect: document.getElementById('symptomSelect'),
  notesInput: document.getElementById('notesInput'),
  results: document.getElementById('results'),
  partsModel: document.getElementById('partsModel'),
  partsSubsystem: document.getElementById('partsSubsystem'),
  partsSearch: document.getElementById('partsSearch'),
  partsList: document.getElementById('partsList'),
  jobsPanel: document.getElementById('jobs'),
  jobChecks: document.getElementById('jobChecks'),
  jobSite: document.getElementById('jobSite'),
  jobBmu: document.getElementById('jobBmu'),
  jobDate: document.getElementById('jobDate'),
  jobReported: document.getElementById('jobReported'),
  jobDiagnosis: document.getElementById('jobDiagnosis'),
  jobParts: document.getElementById('jobParts'),
  jobsList: document.getElementById('jobsList'),
  saveJob: document.getElementById('saveJob'),
};

function showPanel(name) {
  els.panels.forEach((p) => {
    if (p.id === name || (name === 'home' && p.id === 'home')) p.classList.remove('hidden');
    else if (p.id) p.classList.add('hidden');
  });
}

async function fetchOrOffline(endpoint, fallbackKey) {
  try {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error('network');
    return await res.json();
  } catch (err) {
    return offlineData[fallbackKey];
  }
}

async function loadData() {
  state.models = await fetchOrOffline('/api/models', 'models');
  state.subsystems = await fetchOrOffline('/api/subsystems', 'subsystems');
  state.symptoms = await fetchOrOffline('/api/symptoms', 'symptoms');
  state.components = await fetchOrOffline('/api/components', 'components');
  state.flows = offlineData.faultFlows; // flows are static for now
  state.safetyNotes = offlineData.safetyNotes;
  state.jobs = JSON.parse(localStorage.getItem('bmu-jobs') || '[]');
  renderModelSelects();
  renderPartsFilters();
  renderJobs();
}

function renderModelSelects() {
  const modelOptions = state.models.map((m) => `<option value="${m.id}">${m.name}</option>`).join('');
  els.modelSelect.innerHTML = `<option value="">Select model</option>${modelOptions}`;
  els.partsModel.innerHTML = `<option value="">Any model</option>${modelOptions}`;
}

function renderSubsystems(target, modelId) {
  const list = state.subsystems.filter((s) => !modelId || s.modelIds.includes(modelId));
  const options = list.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
  target.innerHTML = `<option value="">Select subsystem</option>${options}`;
}

function renderSymptoms(modelId, subsystemId) {
  const subFilter = subsystemId || state.subsystems.find((s) => s.modelIds.includes(modelId))?.id;
  const list = state.symptoms.filter((s) => (!subFilter || s.subsystemId === subFilter));
  const options = list.map((s) => `<option value="${s.id}">${s.title}</option>`).join('');
  els.symptomSelect.innerHTML = `<option value="">Select symptom</option>${options}`;
}

function renderPartsFilters() {
  renderSubsystems(els.partsSubsystem, '');
}

function renderParts() {
  const modelId = els.partsModel.value;
  const subsystemId = els.partsSubsystem.value;
  const q = els.partsSearch.value.toLowerCase();
  let list = state.components;
  if (modelId) list = list.filter((c) => c.modelId === modelId);
  if (subsystemId) list = list.filter((c) => c.subsystemId === subsystemId);
  if (q) list = list.filter((c) => `${c.name} ${c.partNumber} ${c.location}`.toLowerCase().includes(q));

  els.partsList.innerHTML = list
    .map(
      (c) => `
      <div class="item">
        <div class="item-title">${c.name}</div>
        <div class="muted">${c.partNumber}</div>
        <div class="muted">${c.location}</div>
        <div class="badge">${c.subsystemId}</div>
        <p class="muted">Failures: ${c.failureModes.join(', ')}</p>
        <p class="muted">Symptoms: ${c.symptoms.join(', ')}</p>
        <p class="muted">Replacement: ${c.replacement}</p>
      </div>
    `,
    )
    .join('');
}

function renderFlow(flow) {
  if (!flow) {
    els.results.innerHTML = '';
    els.results.classList.add('hidden');
    return;
  }

  const safety = flow.safety
    .map((id) => state.safetyNotes.find((s) => s.id === id)?.text)
    .filter(Boolean)
    .map((text) => `<li>${text}</li>`) 
    .join('');

  state.checksForJob = flow.checks;
  els.jobChecks.innerHTML = flow.checks
    .map((c) => `<label><input type="checkbox" value="${c.text}" />${c.text} <span class="muted">(${c.expected})</span></label>`)
    .join('');

  els.results.innerHTML = `
    <div class="item">
      <h3>Likely root causes</h3>
      <ol>
        ${flow.likelyCauses
          .map((c) => `<li>${c.component} <span class="muted">${Math.round(c.probability * 100)}%</span></li>`)
          .join('')}
      </ol>
    </div>
    <div class="item">
      <h3>Measurable checks</h3>
      <ul>${flow.checks.map((c) => `<li>${c.text} – <span class="muted">${c.expected}</span></li>`).join('')}</ul>
    </div>
    <div class="item">
      <h3>Step-by-step</h3>
      <ol>
        ${flow.steps
          .map(
            (s) => `<li><strong>${s.title}</strong><br /><span class="muted">${s.detail}</span><br />Next if pass: ${
              s.nextOnPass ? s.nextOnPass : 'End'
            }${s.nextOnFail ? `, if fail: ${flow.resolutions[s.nextOnFail] || s.nextOnFail}` : ''}</li>`,
          )
          .join('')}
      </ol>
    </div>
    <div class="item">
      <h3>Safety</h3>
      <ul>${safety || '<li>Follow site rules</li>'}</ul>
    </div>
    <div class="item">
      <button id="addToJob">Use these steps in job log</button>
    </div>
  `;
  els.results.classList.remove('hidden');

  document.getElementById('addToJob').onclick = () => {
    showPanel('jobs');
    els.jobReported.value = els.symptomSelect.options[els.symptomSelect.selectedIndex]?.text || '';
    els.jobDiagnosis.value = flow.likelyCauses[0]?.component || '';
    renderJobChecks(flow.checks);
  };
}

function renderJobChecks(checks) {
  els.jobChecks.innerHTML = checks
    .map((c) => `<label><input type="checkbox" value="${c.text}" />${c.text} <span class="muted">(${c.expected})</span></label>`)
    .join('');
}

function renderJobs() {
  els.jobsList.innerHTML = state.jobs
    .map(
      (job) => `
      <div class="item">
        <div class="item-title">${job.site || 'Unknown site'} — ${job.bmuId || job.modelId || 'BMU'}</div>
        <div class="muted">${new Date(job.createdAt || job.date || Date.now()).toLocaleString()}</div>
        <p><strong>Reported:</strong> ${job.reported || ''}</p>
        <p><strong>Checks:</strong> ${job.checks?.join(', ') || '—'}</p>
        <p><strong>Diagnosis:</strong> ${job.diagnosis || ''}</p>
        <p><strong>Parts:</strong> ${job.parts || ''}</p>
        <button class="ghost" data-export="${job.id}">Copy summary</button>
      </div>
    `,
    )
    .join('');

  document.querySelectorAll('[data-export]').forEach((btn) => {
    btn.onclick = () => copyJob(btn.dataset.export);
  });
}

function copyJob(id) {
  const job = state.jobs.find((j) => j.id === id);
  if (!job) return;
  const summary = `Site: ${job.site}\nBMU: ${job.bmuId || job.modelId}\nReported: ${job.reported}\nChecks: ${
    job.checks?.join('; ') || '—'
  }\nDiagnosis: ${job.diagnosis}\nParts: ${job.parts}\nTimestamp: ${new Date(job.createdAt).toLocaleString()}`;
  navigator.clipboard.writeText(summary);
  alert('Summary copied');
}

async function saveJob() {
  const checks = Array.from(els.jobChecks.querySelectorAll('input:checked')).map((c) => c.value);
  const payload = {
    site: els.jobSite.value,
    bmuId: els.jobBmu.value,
    modelId: state.selectedModel,
    date: els.jobDate.value,
    reported: els.jobReported.value,
    checks,
    diagnosis: els.jobDiagnosis.value,
    parts: els.jobParts.value,
  };

  try {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('offline');
    const saved = await res.json();
    state.jobs.unshift(saved);
  } catch (err) {
    // Offline path
    const saved = { ...payload, id: `job-${Date.now()}`, createdAt: new Date().toISOString() };
    state.jobs.unshift(saved);
  }
  localStorage.setItem('bmu-jobs', JSON.stringify(state.jobs));
  renderJobs();
  alert('Job saved');
}

function bindEvents() {
  els.cards.forEach((card) => (card.onclick = () => showPanel(card.dataset.nav)));
  document.querySelectorAll('button[data-nav]').forEach((btn) => (btn.onclick = () => showPanel(btn.dataset.nav)));

  els.modelSelect.onchange = () => {
    state.selectedModel = els.modelSelect.value;
    renderSubsystems(els.subsystemSelect, state.selectedModel);
    renderSymptoms(state.selectedModel, '');
  };

  els.subsystemSelect.onchange = () => {
    state.selectedSubsystem = els.subsystemSelect.value;
    renderSymptoms(state.selectedModel, state.selectedSubsystem);
  };

  els.symptomSelect.onchange = () => {
    state.selectedSymptom = els.symptomSelect.value;
    const flow = state.flows.find(
      (f) =>
        (!state.selectedModel || f.modelIds.includes(state.selectedModel)) &&
        f.subsystemId === state.selectedSubsystem &&
        f.symptomId === state.selectedSymptom,
    );
    renderFlow(flow);
  };

  els.partsModel.onchange = () => {
    renderSubsystems(els.partsSubsystem, els.partsModel.value);
    renderParts();
  };
  els.partsSubsystem.onchange = renderParts;
  els.partsSearch.oninput = renderParts;

  els.saveJob.onclick = saveJob;
}

loadData();
bindEvents();
renderParts();
showPanel('home');
