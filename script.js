(function () {
  const STORAGE_KEY = 'ledger-todo-state-v1';

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { console.error('load failed', e); }
    return {
      lists: ['Personal', 'Work'],
      activeList: 'Personal',
      tasks: []
    };
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { console.error('save failed', e); }
  }

  let state = loadState();
  if (!state.filter) state.filter = 'all';
  let editingId = null;

  const listsEl = document.getElementById('lists');
  const tasksEl = document.getElementById('tasks');
  const emptyEl = document.getElementById('emptyState');
  const filtersEl = document.getElementById('filters');
  const addForm = document.getElementById('addForm');
  const taskInput = document.getElementById('taskInput');
  const dateInput = document.getElementById('dateInput');
  const hourInput = document.getElementById('hourInput');
  const minuteInput = document.getElementById('minuteInput');
  const ampmToggle = document.getElementById('ampmToggle');
  const statTotal = document.getElementById('statTotal');
  const statPending = document.getElementById('statPending');
  const statCompleted = document.getElementById('statCompleted');

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // Populate the 12-hour time selects (1-12 hours, 00-59 minutes)
  for (let h = 1; h <= 12; h++) {
    const opt = document.createElement('option');
    opt.value = String(h);
    opt.textContent = String(h);
    hourInput.appendChild(opt);
  }
  for (let m = 0; m < 60; m++) {
    const opt = document.createElement('option');
    opt.value = String(m).padStart(2, '0');
    opt.textContent = String(m).padStart(2, '0');
    minuteInput.appendChild(opt);
  }
  ampmToggle.addEventListener('click', () => {
    const next = ampmToggle.dataset.period === 'AM' ? 'PM' : 'AM';
    ampmToggle.dataset.period = next;
    ampmToggle.textContent = next;
  });

  // Convert 12-hour select state -> stored 24-hour "HH:MM" string (or '' if not set)
  function readTimeFrom12h() {
    if (!hourInput.value || !minuteInput.value) return '';
    let h = parseInt(hourInput.value, 10);
    const period = ampmToggle.dataset.period;
    if (period === 'AM') { if (h === 12) h = 0; }
    else { if (h !== 12) h += 12; }
    return String(h).padStart(2, '0') + ':' + minuteInput.value;
  }

  function resetTimeInputs() {
    hourInput.value = '';
    minuteInput.value = '';
    ampmToggle.dataset.period = 'AM';
    ampmToggle.textContent = 'AM';
  }

  // Format a stored 24-hour "HH:MM" string as 12-hour "h:mm AM/PM", locale-independent
  function to12Hour(time24) {
    if (!time24) return '';
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr;
    const period = h >= 12 ? 'PM' : 'AM';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ':' + m + ' ' + period;
  }

  function renderLists() {
    listsEl.innerHTML = '';
    state.lists.forEach(name => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'list-pill' + (name === state.activeList ? ' active' : '');
      pill.textContent = name;
      pill.addEventListener('click', () => { state.activeList = name; saveState(); render(); });
      listsEl.appendChild(pill);
    });
    const addPill = document.createElement('button');
    addPill.type = 'button';
    addPill.className = 'list-pill add';
    addPill.textContent = '+ List';
    addPill.addEventListener('click', () => {
      const name = prompt('New list name');
      if (name && name.trim() && !state.lists.includes(name.trim())) {
        state.lists.push(name.trim());
        state.activeList = name.trim();
        saveState();
        render();
      }
    });
    listsEl.appendChild(addPill);
  }

  function renderFilters() {
    Array.from(filtersEl.children).forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === state.filter);
    });
  }
  filtersEl.addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    state.filter = btn.dataset.filter;
    saveState();
    render();
  });

  function fmtDate(task) {
    if (!task.date) return '';
    const d = new Date(task.date + 'T' + (task.time || '00:00'));
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  function fmtTime(task) {
    return to12Hour(task.time);
  }

  function isOverdue(task) {
    if (task.done || !task.date) return false;
    const due = new Date(task.date + 'T' + (task.time || '23:59'));
    return due < new Date();
  }

  function updateStats(listTasks) {
    const total = listTasks.length;
    const completed = listTasks.filter(t => t.done).length;
    statTotal.textContent = total;
    statPending.textContent = total - completed;
    statCompleted.textContent = completed;
  }

  function render() {
    renderLists();
    renderFilters();

    const listTasks = state.tasks.filter(t => t.list === state.activeList);
    updateStats(listTasks);

    const visibleTasks = listTasks.filter(t => {
      if (state.filter === 'pending') return !t.done;
      if (state.filter === 'completed') return t.done;
      return true;
    });

    tasksEl.innerHTML = '';
    emptyEl.style.display = visibleTasks.length ? 'none' : 'flex';

    visibleTasks
      .slice()
      .sort((a, b) => (a.done - b.done) || (a.created - b.created))
      .forEach(task => {
        const row = document.createElement('div');
        row.className = 'task' + (task.done ? ' done' : '');

        const check = document.createElement('button');
        check.type = 'button';
        check.className = 'check';
        check.innerHTML = '<svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.2 12L13 4" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        check.addEventListener('click', () => {
          task.done = !task.done;
          saveState(); render();
        });

        const body = document.createElement('div');
        body.className = 'task-body';

        if (editingId === task.id) {
          const editInput = document.createElement('input');
          editInput.type = 'text';
          editInput.className = 'task-edit-input';
          editInput.value = task.title;
          body.appendChild(editInput);
          setTimeout(() => { editInput.focus(); editInput.select(); }, 0);
          function commit() {
            const v = editInput.value.trim();
            if (v) task.title = v;
            editingId = null;
            saveState(); render();
          }
          editInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { editingId = null; render(); }
          });
          editInput.addEventListener('blur', commit);
        } else {
          const title = document.createElement('div');
          title.className = 'task-title';
          title.textContent = task.title;
          body.appendChild(title);

          if (task.date || task.time) {
            const meta = document.createElement('div');
            meta.className = 'task-meta';
            if (task.date) {
              const dSpan = document.createElement('span');
              dSpan.className = isOverdue(task) ? 'overdue' : '';
              dSpan.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4.5" width="14" height="12" rx="2"/><path d="M3 8h14M7 3v3M13 3v3"/></svg>' + fmtDate(task);
              meta.appendChild(dSpan);
            }
            if (task.time) {
              const tSpan = document.createElement('span');
              tSpan.className = isOverdue(task) ? 'overdue' : '';
              tSpan.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="7"/><path d="M10 6v4l2.5 2"/></svg>' + fmtTime(task);
              meta.appendChild(tSpan);
            }
            if (isOverdue(task)) {
              const oSpan = document.createElement('span');
              oSpan.className = 'overdue';
              oSpan.textContent = 'Overdue';
              meta.appendChild(oSpan);
            }
            body.appendChild(meta);
          }
        }

        const actions = document.createElement('div');
        actions.className = 'task-actions';

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'icon-btn';
        editBtn.title = 'Edit';
        editBtn.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13.5 3.5l3 3L6 17H3v-3L13.5 3.5z"/></svg>';
        editBtn.addEventListener('click', () => { editingId = task.id; render(); });

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'icon-btn delete';
        delBtn.title = 'Delete';
        delBtn.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10"/></svg>';
        delBtn.addEventListener('click', () => {
          state.tasks = state.tasks.filter(t => t.id !== task.id);
          saveState(); render();
        });

        actions.appendChild(editBtn);
        actions.appendChild(delBtn);

        row.appendChild(check);
        row.appendChild(body);
        row.appendChild(actions);
        tasksEl.appendChild(row);
      });
  }

  addForm.addEventListener('submit', e => {
    e.preventDefault();
    const title = taskInput.value.trim();
    if (!title) return;
    state.tasks.push({
      id: uid(),
      title,
      list: state.activeList,
      date: dateInput.value || '',
      time: readTimeFrom12h(),
      done: false,
      created: Date.now()
    });
    taskInput.value = '';
    dateInput.value = '';
    resetTimeInputs();
    saveState();
    render();
  });

  render();
})();
