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
  jobs: [],
};

const els = {
  cards: document.querySelectorAll('.card'),
  panels: document.querySelectorAll('section.panel, #home'),
  modelSelect: document.getElementById('modelSelect'),
  subsystemSelect: document.getElementById('subsystemSelect'),
  symptomSelect: document.getElementById('symptomSelect'),
  notesInput: document.getElementById('notesInput'),
  runFault: document.getElementById('run-fault'),
  faultResults: document.getElementById('fault-results'),
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
  renderParts();
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

async function runFaultAnalysis() {
  const modelId = els.modelSelect.value;
  const subsystemId = els.subsystemSelect.value;
  const symptomId = els.symptomSelect.value;
  const notes = els.notesInput.value || '';

  if (!modelId || !subsystemId || !symptomId) {
    alert('Please select a model, subsystem, and symptom first.');
    return;
  }

  els.faultResults.classList.remove('hidden');
  els.faultResults.textContent = 'Loading…';

  const endpoint = `/api/faults?modelId=${encodeURIComponent(modelId)}&subsystemId=${encodeURIComponent(
    subsystemId,
  )}&symptomId=${encodeURIComponent(symptomId)}&notes=${encodeURIComponent(notes)}`;

  let result;
  try {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error('Request failed');
    result = await res.json();
  } catch (err) {
    // Offline or endpoint not available: fall back to seeded flows
    result = state.flows.filter(
      (f) => (!modelId || f.modelIds.includes(modelId)) && f.subsystemId === subsystemId && f.symptomId === symptomId,
    );
  }

  renderFaultResults(result);
}

function renderFaultResults(result) {
  const container = els.faultResults;
  container.innerHTML = '';
  container.classList.remove('hidden');

  if (!result || (Array.isArray(result) && result.length === 0)) {
    container.textContent = 'No matching fault flow found.';
    return;
  }

  const flows = Array.isArray(result) ? result : [result];

  const content = flows
    .map((flow) => {
      const symptomText =
        state.symptoms.find((s) => s.id === flow.symptomId)?.title || flow.symptom || 'Fault flow';
      const safetyList = (flow.safety || [])
        .map((s) => (typeof s === 'string' ? state.safetyNotes.find((n) => n.id === s)?.text || s : s.text || ''))
        .filter(Boolean);
      return `
        <article class="item">
          <h3>${symptomText}</h3>
          <div>
            <h4>Likely causes</h4>
            <ol>
              ${(flow.likelyCauses || [])
                .map((c) => {
                  const probability = c.probability != null ? ` <span class="muted">(${Math.round(c.probability * 100)}%)</span>` : '';
                  const label = c.component || c.text || 'Cause';
                  return `<li>${label}${probability}</li>`;
                })
                .join('')}
            </ol>
          </div>
          <div>
            <h4>Checks</h4>
            <div class="checklist">
              ${(flow.checks || [])
                .map((c) => {
                  const detail = c.detail || c.expected || '';
                  return `<label><input type="checkbox" />${c.text || 'Check'}${detail ? ` <span class="muted">(${detail})</span>` : ''}</label>`;
                })
                .join('')}
            </div>
          </div>
          ${safetyList.length
            ? `<div><h4>Safety</h4><ul>${safetyList.map((s) => `<li>${s}</li>`).join('')}</ul></div>`
            : ''}
        </article>
      `;
    })
    .join('');

  container.innerHTML = `${content}<details class="item"><summary>Raw data</summary><pre>${JSON.stringify(
    result,
    null,
    2,
  )}</pre></details>`;
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
  };

  els.partsModel.onchange = () => {
    renderSubsystems(els.partsSubsystem, els.partsModel.value);
    renderParts();
  };
  els.partsSubsystem.onchange = renderParts;
  els.partsSearch.oninput = renderParts;

  els.saveJob.onclick = saveJob;
  els.runFault.onclick = runFaultAnalysis;
}

loadData();
bindEvents();
renderParts();
showPanel('home');
