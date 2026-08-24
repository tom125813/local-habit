/* ══════════════════════════════════════════
   LOCAL HABIT v4 — script.js
   ══════════════════════════════════════════ */

// ─── STATE ───────────────────────────────────────────────────────────────────

const state = {
  name: '',
  habits: [],   // { id, name, color, icon, type:'number'|'checkbox', unit, reasons:[], archived, currentRange:'year'|'6'|'3' }
  data:  {},    // { [habitId]: { 'YYYY-MM-DD': number } }  (checkbox = 1/0)
  settings: {
    showStreaks: true,
    showToday:  true,
    gridRange:  'year'   // default global range
  }
};

let isSetupComplete = false;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const PALETTE = [
  '#ff6b6b','#ff9f43','#ffd32a','#1dd1a1','#54a0ff',
  '#5f27cd','#c56cf0','#ff9ff3','#48dbfb','#00d2d3',
  '#ff6348','#eccc68','#7bed9f','#70a1ff','#a29bfe',
  '#fd79a8','#636e72','#b2bec3','#74b9ff','#55efc4'
];

const REASON_LABELS = {
  health:     { label: 'Healthier',  icon: 'fas fa-heart-pulse' },
  money:      { label: 'More money', icon: 'fas fa-coins' },
  smart:      { label: 'Smarter',    icon: 'fas fa-lightbulb' },
  bilingual:  { label: 'Bilingual',  icon: 'fas fa-globe' },
  fit:        { label: 'Fitter',     icon: 'fas fa-dumbbell' },
  discipline: { label: 'Discipline', icon: 'fas fa-shield' },
  happy:      { label: 'Happier',    icon: 'fas fa-face-smile' },
  creative:   { label: 'Creative',   icon: 'fas fa-palette' }
};

// ─── STORAGE ─────────────────────────────────────────────────────────────────

function loadData() {
  try {
    const name = localStorage.getItem('habit-name');
    if (name) state.name = name;

    const habits = localStorage.getItem('habit-list');
    if (habits) {
      state.habits = JSON.parse(habits);
      // migration: ensure new fields exist
      state.habits.forEach(h => {
        if (!h.type)    h.type    = 'number';
        if (!h.reasons) h.reasons = [];
        if (h.archived === undefined) h.archived = false;
        if (!h.currentRange) h.currentRange = 'year';
        if (!h.icon)    h.icon = 'fas fa-star';
        if (!h.color)   h.color = PALETTE[0];
      });
    }

    const data = localStorage.getItem('habit-data');
    if (data) state.data = JSON.parse(data);

    const settings = localStorage.getItem('habit-settings');
    if (settings) {
      const s = JSON.parse(settings);
      state.settings = { ...state.settings, ...s };
    }

    isSetupComplete = localStorage.getItem('habit-setup-complete') === 'true';
  } catch (e) {
    console.warn('Load error:', e);
  }
}

function saveData() {
  try {
    localStorage.setItem('habit-name',           state.name);
    localStorage.setItem('habit-list',           JSON.stringify(state.habits));
    localStorage.setItem('habit-data',           JSON.stringify(state.data));
    localStorage.setItem('habit-settings',       JSON.stringify(state.settings));
    localStorage.setItem('habit-setup-complete', 'true');
    isSetupComplete = true;
  } catch (e) {
    console.error('Save error:', e);
  }
}

// ─── UTILS ────────────────────────────────────────────────────────────────────

function dateToKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function todayKey() { return dateToKey(new Date()); }

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Welcome back';
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return [r,g,b];
}

function interpolateColor(color, value, max) {
  if (value === 0 || max === 0) return 'var(--surface2)';
  const [r,g,b] = hexToRgb(color);
  // blend from dark bg toward the habit color
  const bgR = 30, bgG = 30, bgB = 36; // ~surface2
  const ratio = Math.min(1, 0.18 + 0.82 * (value / max));
  const nr = Math.round(bgR + (r - bgR) * ratio);
  const ng = Math.round(bgG + (g - bgG) * ratio);
  const nb = Math.round(bgB + (b - bgB) * ratio);
  return `rgb(${nr},${ng},${nb})`;
}

function getMaxValue(habitId) {
  const d = state.data[habitId] || {};
  return Math.max(0, ...Object.values(d).map(v => Number(v)));
}

function getStreak(habitId) {
  const d = state.data[habitId] || {};
  const today = new Date();
  const tk = dateToKey(today);
  const todayDone = (d[tk] || 0) > 0;

  let streak = 0;
  const check = new Date(today);
  if (!todayDone) check.setDate(check.getDate() - 1);

  while (true) {
    const k = dateToKey(check);
    if ((d[k] || 0) > 0) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else break;
    if (streak > 3650) break;
  }

  if (todayDone && streak === 0) streak = 1;
  return { streak, isActive: todayDone };
}

// ─── HEADER / GREETING ───────────────────────────────────────────────────────

let lastDate = todayKey();

function updateHeader() {
  document.getElementById('greetingText').textContent = getGreeting();

  const nameEl = document.getElementById('nameDisplay');
  nameEl.textContent = state.name || 'friend';

  const now = new Date();
  document.getElementById('dayOfWeek').textContent = now.toLocaleDateString(undefined,{ weekday:'long' });
  document.getElementById('dateDisplay').textContent = now.toLocaleDateString(undefined,{ day:'numeric', month:'short', year:'numeric' });

  updateTodayProgress();

  // re-render on day change
  const k = todayKey();
  if (k !== lastDate) { lastDate = k; renderHabits(); }
}

function updateTodayProgress() {
  const active = state.habits.filter(h => !h.archived);
  if (active.length === 0) {
    setProgressRing(0, '—');
    return;
  }

  const tk = todayKey();
  let done = 0;
  active.forEach(h => {
    const v = (state.data[h.id] || {})[tk] || 0;
    if (v > 0) done++;
  });

  const pct = done / active.length;
  const label = `${done}/${active.length}`;
  setProgressRing(pct, label);
}

function setProgressRing(pct, label) {
  const circumference = 100.53; // 2π×16
  const fill = document.getElementById('progressRingFill');
  fill.style.strokeDashoffset = circumference * (1 - pct);
  document.getElementById('todayProgressLabel').textContent = label;
}

// ─── NAME EDITING ─────────────────────────────────────────────────────────────

function makeNameEditable() {
  const el = document.getElementById('nameDisplay');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'name-edit-input';
  input.value = state.name;
  el.replaceWith(input);
  input.focus(); input.select();

  const finish = () => {
    state.name = input.value.trim() || 'friend';
    saveData();
    const span = document.createElement('span');
    span.className = 'greeting-name';
    span.id = 'nameDisplay';
    span.textContent = state.name;
    span.addEventListener('click', makeNameEditable);
    input.replaceWith(span);
  };
  input.addEventListener('blur', finish);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
}

// ─── RENDER HABITS ────────────────────────────────────────────────────────────

function renderHabits() {
  const grid = document.getElementById('habitsGrid');
  grid.innerHTML = '';

  const active = state.habits.filter(h => !h.archived);

  if (active.length === 0) {
    document.getElementById('emptyState').classList.remove('hidden');
  } else {
    document.getElementById('emptyState').classList.add('hidden');
    active.forEach(h => grid.appendChild(buildCard(h)));
  }

  updateTodayProgress();
}

function buildCard(habit) {
  const card = document.createElement('div');
  card.className = 'habit-card';
  makeDraggable(card, habit);

  // ── header ──
  const header = document.createElement('div');
  header.className = 'card-header';

  const iconEl = document.createElement('div');
  iconEl.className = 'card-icon';
  iconEl.style.background = habit.color + '22';
  iconEl.style.color = habit.color;
  iconEl.innerHTML = `<i class="${habit.icon || 'fas fa-star'}"></i>`;

  const meta = document.createElement('div');
  meta.className = 'card-meta';

  const titleEl = document.createElement('div');
  titleEl.className = 'card-title';
  titleEl.textContent = habit.name;
  titleEl.addEventListener('click', e => { e.stopPropagation(); makeCardTitleEditable(habit, titleEl); });

  meta.appendChild(titleEl);

  // reason tags
  if (habit.reasons && habit.reasons.length > 0) {
    const tagsRow = document.createElement('div');
    tagsRow.className = 'card-reasons';
    habit.reasons.slice(0,3).forEach(r => {
      const info = REASON_LABELS[r];
      if (!info) return;
      const tag = document.createElement('span');
      tag.className = 'reason-tag';
      tag.textContent = info.label;
      tagsRow.appendChild(tag);
    });
    meta.appendChild(tagsRow);
  }

  // controls
  const controls = document.createElement('div');
  controls.className = 'card-controls';

  // streak
  if (state.settings.showStreaks) {
    const { streak, isActive } = getStreak(habit.id);
    if (streak > 0) {
      const sp = document.createElement('div');
      sp.className = 'streak-pill' + (isActive ? '' : ' inactive');
      sp.innerHTML = `<i class="fas fa-fire"></i>${streak}`;
      controls.appendChild(sp);
    }
  }

  // range buttons (per-card override)
  const globalRange = state.settings.gridRange;
  const cardRange = habit.currentRange || globalRange;

  const rangeBtns = document.createElement('div');
  rangeBtns.className = 'range-btns';
  ['3','6','year'].forEach(r => {
    const b = document.createElement('button');
    b.className = 'range-btn' + (cardRange === r ? ' active' : '');
    b.textContent = r === 'year' ? '1Y' : r + 'M';
    b.addEventListener('click', e => {
      e.stopPropagation();
      habit.currentRange = r;
      saveData();
      renderHabits();
    });
    rangeBtns.appendChild(b);
  });
  controls.appendChild(rangeBtns);

  // settings cog
  const cog = document.createElement('button');
  cog.className = 'card-settings-btn';
  cog.innerHTML = '<i class="fas fa-ellipsis"></i>';
  cog.addEventListener('click', e => { e.stopPropagation(); openHabitSettings(habit); });
  controls.appendChild(cog);

  header.appendChild(iconEl);
  header.appendChild(meta);
  header.appendChild(controls);
  card.appendChild(header);

  // ── calendar ──
  const calWrap = document.createElement('div');
  calWrap.className = 'card-calendar';

  card.appendChild(header);
  card.appendChild(calWrap);

  renderCalendar(habit, calWrap, cardRange);

  return card;
}

function makeCardTitleEditable(habit, el) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'card-title-input';
  input.value = habit.name;
  el.replaceWith(input);
  input.focus(); input.select();

  const finish = () => {
    habit.name = input.value.trim() || 'Untitled';
    saveData();
    el.textContent = habit.name;
    input.replaceWith(el);
  };
  input.addEventListener('blur', finish);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = habit.name; input.blur(); }
  });
}

// ─── CALENDAR ─────────────────────────────────────────────────────────────────

function renderCalendar(habit, container, range) {
  container.innerHTML = '';

  const today = new Date();
  today.setHours(0,0,0,0);
  const tk = dateToKey(today);

  // determine start date
  let startDate;
  if (range === 'year') {
    startDate = new Date(today.getFullYear(), 0, 1);
    const fd = startDate.getDay();
    if (fd !== 0) startDate.setDate(startDate.getDate() - fd);
  } else {
    const months = parseInt(range);
    startDate = new Date(today);
    startDate.setMonth(startDate.getMonth() - months);
    startDate.setDate(1);
    const fd = startDate.getDay();
    if (fd !== 0) startDate.setDate(startDate.getDate() - fd);
  }

  // end: end of current week
  const endDate = new Date(today);
  const daysToSunday = 6 - today.getDay();
  endDate.setDate(endDate.getDate() + daysToSunday);

  const data = state.data[habit.id] || {};
  const isCheckbox = habit.type === 'checkbox';
  const maxVal = isCheckbox ? 1 : getMaxValue(habit.id);

  // count weeks
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const totalWeeks = Math.ceil((endDate - startDate) / msPerWeek) + 1;

  // ── cell size: always the same, only column count changes with range ──
  const cellSize = 13;
  const gap      = 3;
  const colStep  = cellSize + gap;

  // month label row
  const labelRow = document.createElement('div');
  labelRow.className = 'month-label-row';
  labelRow.style.width = `${totalWeeks * colStep}px`;

  // grid
  const grid = document.createElement('div');
  grid.className = 'cal-grid';
  grid.style.gridTemplateColumns = `repeat(${totalWeeks}, ${cellSize}px)`;
  grid.style.gridTemplateRows    = `repeat(7, ${cellSize}px)`;
  grid.style.gap = `${gap}px`;

  const monthsSeen = new Set();

  let col = 0;
  let cur = new Date(startDate);

  while (cur <= endDate) {
    for (let row = 0; row < 7; row++) {
      const d = new Date(cur);
      d.setDate(cur.getDate() + row);
      const dk = dateToKey(d);
      const val = Number(data[dk] || 0);
      const inRange = d >= new Date(today.getFullYear(), 0, 1) || range !== 'year';
      const isFuture = d > today;

      // month label
      if (d.getDate() === 1 || (col === 0 && row === 0)) {
        const mkey = `${d.getFullYear()}-${d.getMonth()}`;
        if (!monthsSeen.has(mkey)) {
          monthsSeen.add(mkey);
          const ml = document.createElement('span');
          ml.className = 'mlabel';
          ml.textContent = d.toLocaleDateString(undefined,{ month:'short' });
          ml.style.left = `${col * colStep}px`;
          labelRow.appendChild(ml);
        }
      }

      const cell = document.createElement('div');
      cell.className = 'cal-cell';
      cell.style.width  = `${cellSize}px`;
      cell.style.height = `${cellSize}px`;
      cell.style.borderRadius = `${Math.max(2, cellSize * 0.22)}px`;
      if (isCheckbox && val > 0) cell.classList.add('checked-cell');

      if (isFuture) {
        cell.style.background = 'var(--surface2)';
        cell.style.opacity = '0.3';
        cell.style.cursor = 'default';
        cell.style.pointerEvents = 'none';
      } else {
        const bg = val > 0
          ? interpolateColor(habit.color, val, maxVal || 1)
          : 'var(--surface2)';
        cell.style.background = bg;

        if (dk === tk && state.settings.showToday) {
          cell.classList.add('today-cell');
        }

        // tooltip
        const tip = document.createElement('div');
        tip.className = 'cal-tooltip';
        const dateStr = d.toLocaleDateString(undefined,{ weekday:'short', day:'numeric', month:'short' });
        if (isCheckbox) {
          tip.innerHTML = `${dateStr}<br><strong>${val > 0 ? '✓ Done' : '✗ Not done'}</strong>`;
        } else {
          const unit = habit.unit ? ` ${habit.unit}` : '';
          tip.innerHTML = `${dateStr}<br><strong>${val}${unit}</strong>`;
        }
        cell.appendChild(tip);

        // tooltip position tracking
        cell.addEventListener('mouseenter', () => {
          const r = cell.getBoundingClientRect();
          tip.style.left = `${r.left + r.width/2}px`;
          tip.style.top  = `${r.top}px`;
          if (r.top < 80) {
            tip.style.transform = 'translateX(-50%) translateY(24px)';
          } else {
            tip.style.transform = 'translateX(-50%) translateY(calc(-100% - 8px))';
          }
        });

        cell.addEventListener('click', () => {
          if (isCheckbox) {
            toggleCheckbox(habit, dk);
          } else {
            openDayModal(habit, d);
          }
        });
      }

      cell.style.gridColumn = col + 1;
      cell.style.gridRow    = row + 1;
      grid.appendChild(cell);
    }

    cur.setDate(cur.getDate() + 7);
    col++;
  }

  container.appendChild(labelRow);
  container.appendChild(grid);
}

// checkbox toggle
function toggleCheckbox(habit, dk) {
  if (!state.data[habit.id]) state.data[habit.id] = {};
  const current = state.data[habit.id][dk] || 0;
  state.data[habit.id][dk] = current > 0 ? 0 : 1;
  saveData();
  renderHabits();
}

// ─── DRAG & DROP ─────────────────────────────────────────────────────────────

function makeDraggable(card, habit) {
  card.draggable = true;

  card.addEventListener('dragstart', e => {
    card.classList.add('dragging');
    e.dataTransfer.setData('text/plain', habit.id);
    e.dataTransfer.effectAllowed = 'move';
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    document.querySelectorAll('.habit-card').forEach(c => c.classList.remove('drag-over'));
  });
  card.addEventListener('dragover', e => {
    e.preventDefault();
    if (!card.classList.contains('dragging')) card.classList.add('drag-over');
  });
  card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
  card.addEventListener('drop', e => {
    e.preventDefault();
    card.classList.remove('drag-over');
    const draggedId = e.dataTransfer.getData('text/plain');
    const di = state.habits.findIndex(h => h.id === draggedId);
    const ti = state.habits.findIndex(h => h.id === habit.id);
    if (di !== -1 && ti !== -1 && di !== ti) {
      const [moved] = state.habits.splice(di, 1);
      state.habits.splice(ti, 0, moved);
      saveData();
      renderHabits();
    }
  });
}

// ─── DAY MODAL ────────────────────────────────────────────────────────────────

let currentDayEdit = null;
let isShifting = false;

function openDayModal(habit, date) {
  const dk = dateToKey(date);
  const value = (state.data[habit.id] || {})[dk] || 0;
  currentDayEdit = { habit, date, dk };

  document.getElementById('dayModalTitle').textContent =
    `${habit.name} · ${date.toLocaleDateString(undefined,{ weekday:'short', day:'numeric', month:'short' })}`;
  document.getElementById('dayModalValue').textContent = value;
  document.getElementById('dayModalInput').value = value;
  showEl('dayModalValue'); hideEl('dayModalInput');
  showModal('dayModal');
}

function closeDayModal() {
  currentDayEdit = null;
  hideModal('dayModal');
}

function makeValueEditable() {
  hideEl('dayModalValue');
  showEl('dayModalInput');
  const inp = document.getElementById('dayModalInput');
  inp.focus(); inp.select();
}

function finishValueEdit() {
  if (!currentDayEdit) return;
  let v = parseFloat(document.getElementById('dayModalInput').value);
  if (isNaN(v) || v < 0) v = 0;
  v = Math.round(v * 10) / 10;
  const { habit, dk } = currentDayEdit;
  if (!state.data[habit.id]) state.data[habit.id] = {};
  state.data[habit.id][dk] = v;
  document.getElementById('dayModalValue').textContent = v;
  document.getElementById('dayModalInput').value = v;
  showEl('dayModalValue'); hideEl('dayModalInput');
  saveData(); renderHabits();
}

function updateDayValue(delta) {
  if (!currentDayEdit) return;
  const { habit, dk } = currentDayEdit;
  if (!state.data[habit.id]) state.data[habit.id] = {};
  let v = (state.data[habit.id][dk] || 0) + delta;
  v = Math.max(0, Math.round(v * 10) / 10);
  state.data[habit.id][dk] = v;
  document.getElementById('dayModalValue').textContent = v;
  document.getElementById('dayModalInput').value = v;
  saveData(); renderHabits();
}

// ─── HABIT SETTINGS MODAL ─────────────────────────────────────────────────────

let currentHabitSettings = null;

function openHabitSettings(habit) {
  currentHabitSettings = habit;

  document.getElementById('habitSettingsName').value = habit.name || '';
  document.getElementById('habitSettingsUnit').value = habit.unit || '';
  document.getElementById('habitSettingsColor').value = habit.color || PALETTE[0];
  document.getElementById('habitArchivedToggle').checked = habit.archived || false;

  // type toggle
  document.querySelectorAll('.type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === (habit.type || 'number'));
  });

  // unit field visibility
  toggleUnitField(habit.type || 'number');

  // icon
  document.querySelectorAll('.icon-opt').forEach(o => {
    o.classList.toggle('selected', o.dataset.icon === (habit.icon || 'fas fa-star'));
  });

  // color palette
  buildColorPalette(habit.color || PALETTE[0]);

  // reasons
  document.querySelectorAll('.chip').forEach(chip => {
    chip.classList.toggle('selected', (habit.reasons || []).includes(chip.dataset.reason));
  });

  showModal('habitSettingsModal');
}

function toggleUnitField(type) {
  if (type === 'checkbox') {
    document.getElementById('unitField').classList.add('hidden');
  } else {
    document.getElementById('unitField').classList.remove('hidden');
  }
}

function buildColorPalette(currentColor) {
  const palette = document.getElementById('colorPalette');
  palette.innerHTML = '';
  PALETTE.forEach(c => {
    const dot = document.createElement('button');
    dot.className = 'color-dot' + (c.toLowerCase() === currentColor.toLowerCase() ? ' selected' : '');
    dot.style.background = c;
    dot.addEventListener('click', () => {
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
      document.getElementById('habitSettingsColor').value = c;
    });
    palette.appendChild(dot);
  });
}

function saveHabitSettings() {
  if (!currentHabitSettings) return;
  const h = currentHabitSettings;

  h.name     = document.getElementById('habitSettingsName').value.trim() || 'Untitled';
  h.unit     = document.getElementById('habitSettingsUnit').value.trim();
  h.color    = document.getElementById('habitSettingsColor').value;
  h.archived = document.getElementById('habitArchivedToggle').checked;

  const activeType = document.querySelector('.type-btn.active');
  h.type = activeType ? activeType.dataset.type : 'number';

  const selectedIcon = document.querySelector('.icon-opt.selected');
  h.icon = selectedIcon ? selectedIcon.dataset.icon : 'fas fa-star';

  h.reasons = [...document.querySelectorAll('.chip.selected')].map(c => c.dataset.reason);

  saveData();
  renderHabits();
  hideModal('habitSettingsModal');
  currentHabitSettings = null;
}

function deleteCurrentHabit() {
  if (!currentHabitSettings) return;
  if (!confirm(`Delete "${currentHabitSettings.name}"? This cannot be undone.`)) return;
  state.habits = state.habits.filter(h => h.id !== currentHabitSettings.id);
  delete state.data[currentHabitSettings.id];
  saveData();
  renderHabits();
  hideModal('habitSettingsModal');
  currentHabitSettings = null;
}

// ─── QUICK ADD MODAL ─────────────────────────────────────────────────────────

function openQuickAdd() {
  const today = new Date();
  const tk = dateToKey(today);

  document.getElementById('quickAddTitle').textContent =
    today.toLocaleDateString(undefined,{ weekday:'long', day:'numeric', month:'long' });

  const container = document.getElementById('quickAddHabits');
  container.innerHTML = '';

  const active = state.habits.filter(h => !h.archived);
  if (active.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted);font-size:.9rem;text-align:center;padding:1rem">No active habits yet.</p>`;
  }

  active.forEach(habit => {
    if (!state.data[habit.id]) state.data[habit.id] = {};
    const val = state.data[habit.id][tk] || 0;

    const item = document.createElement('div');
    item.className = 'quick-add-item';

    // icon
    const ico = document.createElement('div');
    ico.style.cssText = `width:28px;height:28px;border-radius:6px;background:${habit.color}22;color:${habit.color};display:flex;align-items:center;justify-content:center;font-size:.7rem;flex-shrink:0`;
    ico.innerHTML = `<i class="${habit.icon||'fas fa-star'}"></i>`;

    const labelWrap = document.createElement('div');
    labelWrap.className = 'qa-label';

    const name = document.createElement('div');
    name.className = 'qa-name';
    name.textContent = habit.name;
    labelWrap.appendChild(name);

    if (habit.reasons && habit.reasons.length > 0) {
      const tags = document.createElement('div');
      tags.className = 'qa-reason-tags';
      habit.reasons.slice(0,2).forEach(r => {
        const info = REASON_LABELS[r];
        if (!info) return;
        const t = document.createElement('span');
        t.className = 'reason-tag';
        t.textContent = info.label;
        tags.appendChild(t);
      });
      labelWrap.appendChild(tags);
    }

    const ctrlWrap = document.createElement('div');
    ctrlWrap.className = 'qa-controls';

    if (habit.type === 'checkbox') {
      const cb = document.createElement('div');
      cb.className = 'qa-checkbox' + (val > 0 ? ' checked' : '');
      cb.innerHTML = val > 0 ? '<i class="fas fa-check"></i>' : '';
      cb.addEventListener('click', () => {
        const newVal = (state.data[habit.id][tk] || 0) > 0 ? 0 : 1;
        state.data[habit.id][tk] = newVal;
        cb.className = 'qa-checkbox' + (newVal > 0 ? ' checked' : '');
        cb.innerHTML = newVal > 0 ? '<i class="fas fa-check"></i>' : '';
        saveData();
        updateTodayProgress();
        renderHabits();
      });
      ctrlWrap.appendChild(cb);
    } else {
      const dec = document.createElement('button');
      dec.className = 'qa-num-btn';
      dec.textContent = '−';

      const valSpan = document.createElement('div');
      valSpan.className = 'qa-value';
      valSpan.textContent = val;

      const valInput = document.createElement('input');
      valInput.type = 'number';
      valInput.className = 'qa-value-input hidden';
      valInput.step = '0.1'; valInput.min = '0';
      valInput.value = val;

      const inc = document.createElement('button');
      inc.className = 'qa-num-btn';
      inc.textContent = '+';

      const update = newVal => {
        newVal = Math.max(0, Math.round(newVal * 10) / 10);
        state.data[habit.id][tk] = newVal;
        valSpan.textContent = newVal;
        valInput.value = newVal;
        saveData(); updateTodayProgress(); renderHabits();
      };

      dec.addEventListener('click', () => update((state.data[habit.id][tk] || 0) - 1));
      inc.addEventListener('click', () => update((state.data[habit.id][tk] || 0) + 1));

      valSpan.addEventListener('click', () => {
        valSpan.classList.add('hidden');
        valInput.classList.remove('hidden');
        valInput.focus(); valInput.select();
      });

      const doneEditing = () => {
        let v = parseFloat(valInput.value);
        if (isNaN(v) || v < 0) v = 0;
        update(v);
        valInput.classList.add('hidden');
        valSpan.classList.remove('hidden');
      };
      valInput.addEventListener('blur', doneEditing);
      valInput.addEventListener('keydown', e => { if (e.key === 'Enter') doneEditing(); });

      ctrlWrap.appendChild(dec);
      ctrlWrap.appendChild(valSpan);
      ctrlWrap.appendChild(valInput);
      ctrlWrap.appendChild(inc);
    }

    item.appendChild(ico);
    item.appendChild(labelWrap);
    item.appendChild(ctrlWrap);
    container.appendChild(item);
  });

  showModal('quickAddModal');
}

// ─── MANAGE MODAL ─────────────────────────────────────────────────────────────

function openManage() {
  renderManageList();
  document.getElementById('archivedHabitsList').classList.add('hidden');
  document.getElementById('showArchivedBtn').innerHTML = '<i class="fas fa-box-archive"></i> Show archived';
  showModal('manageModal');
}

function renderManageList() {
  const list = document.getElementById('manageHabitsList');
  list.innerHTML = '';

  const active = state.habits.filter(h => !h.archived);

  if (active.length === 0) {
    list.innerHTML = `<p style="color:var(--text-muted);font-size:.85rem;padding:.5rem 0">No active habits.</p>`;
    return;
  }

  active.forEach(habit => {
    const row = buildManageRow(habit);
    list.appendChild(row);
  });
}

function renderArchivedList() {
  const list = document.getElementById('archivedHabitsList');
  list.innerHTML = '';

  const archived = state.habits.filter(h => h.archived);
  if (archived.length === 0) {
    list.innerHTML = `<p style="color:var(--text-muted);font-size:.85rem;padding:.5rem 0">No archived habits.</p>`;
    return;
  }

  const title = document.createElement('div');
  title.className = 'archived-section-title';
  title.textContent = 'Archived';
  list.appendChild(title);

  archived.forEach(habit => {
    const row = buildManageRow(habit);
    list.appendChild(row);
  });
}

function buildManageRow(habit) {
  const row = document.createElement('div');
  row.className = 'manage-habit-row';

  const drag = document.createElement('div');
  drag.className = 'manage-drag-handle';
  drag.innerHTML = '<i class="fas fa-grip-vertical"></i>';

  const ico = document.createElement('div');
  ico.className = 'manage-habit-icon';
  ico.style.background = habit.color + '22';
  ico.style.color = habit.color;
  ico.innerHTML = `<i class="${habit.icon||'fas fa-star'}"></i>`;

  const name = document.createElement('div');
  name.className = 'manage-habit-name';
  name.textContent = habit.name + (habit.archived ? ' (archived)' : '');
  if (habit.archived) name.style.color = 'var(--text-muted)';

  const editBtn = document.createElement('button');
  editBtn.className = 'manage-edit-btn';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => {
    hideModal('manageModal');
    openHabitSettings(habit);
  });

  row.appendChild(drag);
  row.appendChild(ico);
  row.appendChild(name);
  row.appendChild(editBtn);
  return row;
}

// ─── APP SETTINGS ─────────────────────────────────────────────────────────────

function openAppSettings() {
  document.getElementById('streakVisibilityToggle').checked = state.settings.showStreaks;
  document.getElementById('todayIndicatorToggle').checked   = state.settings.showToday;
  document.getElementById('gridRangeSelect').value          = state.settings.gridRange;
  document.getElementById('settingsNameInput').value        = state.name;
  showModal('appSettingsModal');
}

function closeAppSettings() {
  state.settings.showStreaks = document.getElementById('streakVisibilityToggle').checked;
  state.settings.showToday   = document.getElementById('todayIndicatorToggle').checked;
  state.settings.gridRange   = document.getElementById('gridRangeSelect').value;
  const n = document.getElementById('settingsNameInput').value.trim();
  if (n) { state.name = n; document.getElementById('nameDisplay').textContent = n; }
  saveData();
  renderHabits();
  hideModal('appSettingsModal');
}

// ─── SETUP MODAL ─────────────────────────────────────────────────────────────

function showSetupModal() {
  document.getElementById('setupName').value = state.name;
  renderSetupHabits();
  showModal('setupModal');
}

function renderSetupHabits() {
  const c = document.getElementById('setupHabits');
  c.innerHTML = '';
  state.habits.forEach((h, i) => {
    const row = document.createElement('div');
    row.className = 'setup-habit-item';

    const dot = document.createElement('div');
    dot.className = 'setup-habit-dot';
    dot.style.background = h.color || PALETTE[i % PALETTE.length];

    const inp = document.createElement('input');
    inp.className = 'setup-habit-input';
    inp.placeholder = 'Habit name';
    inp.value = h.name || '';
    inp.addEventListener('input', e => { h.name = e.target.value; });

    const colorInp = document.createElement('input');
    colorInp.type = 'color';
    colorInp.className = 'setup-habit-color';
    colorInp.value = h.color || PALETTE[i % PALETTE.length];
    colorInp.addEventListener('input', e => {
      h.color = e.target.value;
      dot.style.background = e.target.value;
    });

    const del = document.createElement('button');
    del.className = 'setup-del-btn';
    del.innerHTML = '&times;';
    del.addEventListener('click', () => {
      state.habits.splice(i, 1);
      renderSetupHabits();
    });

    row.appendChild(dot);
    row.appendChild(inp);
    row.appendChild(colorInp);
    row.appendChild(del);
    c.appendChild(row);
  });
}

// ─── MODAL HELPERS ────────────────────────────────────────────────────────────

function showModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function hideModal(id)  { document.getElementById(id).classList.add('hidden'); }
function showEl(id)     { document.getElementById(id).classList.remove('hidden'); }
function hideEl(id)     { document.getElementById(id).classList.add('hidden'); }

// close modals on backdrop click
['setupModal','quickAddModal','dayModal','habitSettingsModal','manageModal','appSettingsModal'].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener('click', e => {
    if (e.target === el) {
      if (id === 'setupModal' && !isSetupComplete) return;
      hideModal(id);
    }
  });
});

// ─── INIT ─────────────────────────────────────────────────────────────────────

function init() {
  loadData();

  // first run: seed default habits
  if (!isSetupComplete || state.habits.length === 0) {
    if (state.habits.length === 0) {
      const defaults = [
        { name:'Extra hour of work',       icon:'fas fa-briefcase', color:'#7c6fff', type:'checkbox', reasons:['money'] },
        { name:'Exercised',                icon:'fas fa-dumbbell',  color:'#1dd1a1', type:'checkbox', reasons:['fit','health'] },
        { name:'Drank 1L+ water',          icon:'fas fa-glass-water', color:'#54a0ff', type:'checkbox', reasons:['health'] },
        { name:'144g+ protein',            icon:'fas fa-utensils', color:'#ff9f43', type:'checkbox', reasons:['fit','health'] },
        { name:'Practiced Spanish',        icon:'fas fa-language', color:'#ff6b6b', type:'checkbox', reasons:['bilingual'] }
      ];
      state.habits = defaults.map((d,i) => ({
        id: `${Date.now()}-${i}`,
        currentRange: 'year',
        unit: '',
        archived: false,
        reasons: d.reasons || [],
        ...d
      }));
    }
    showSetupModal();
  }

  updateHeader();
  setInterval(updateHeader, 60 * 1000);
  renderHabits();

  // name click
  document.getElementById('nameDisplay').addEventListener('click', makeNameEditable);

  // FABs
  document.getElementById('quickAddBtn').addEventListener('click', openQuickAdd);
  document.getElementById('editHabitBtn').addEventListener('click', openManage);
  document.getElementById('headerSettingsBtn').addEventListener('click', openAppSettings);

  // app settings
  document.getElementById('closeAppSettings').addEventListener('click', closeAppSettings);
  document.getElementById('closeAppSettingsX').addEventListener('click', closeAppSettings);

  // setup modal
  document.getElementById('addSetupHabit').addEventListener('click', () => {
    const i = state.habits.length;
    state.habits.push({
      id: Date.now().toString(),
      name: '', color: PALETTE[i % PALETTE.length],
      icon: 'fas fa-star', type: 'number',
      unit: '', reasons: [], archived: false,
      currentRange: 'year'
    });
    renderSetupHabits();
  });

  document.getElementById('confirmSetup').addEventListener('click', () => {
    const n = document.getElementById('setupName').value.trim();
    if (!n) { alert('Please enter your name'); return; }
    state.name = n;
    state.habits = state.habits.filter(h => h.name.trim());
    if (state.habits.length === 0) { alert('Please add at least one habit'); return; }
    saveData();
    hideModal('setupModal');
    updateHeader();
    renderHabits();
  });

  // quick add
  document.getElementById('closeQuickAdd').addEventListener('click',  () => hideModal('quickAddModal'));
  document.getElementById('closeQuickAdd2').addEventListener('click', () => hideModal('quickAddModal'));

  // day modal
  document.getElementById('dayModalValue').addEventListener('click', makeValueEditable);
  document.getElementById('dayModalInput').addEventListener('blur', finishValueEdit);
  document.getElementById('dayModalInput').addEventListener('keydown', e => {
    if (e.key === 'Enter')  finishValueEdit();
    if (e.key === 'Escape') {
      showEl('dayModalValue'); hideEl('dayModalInput');
    }
  });
  document.getElementById('incrementBtn').addEventListener('click', () => updateDayValue(isShifting ? 10 : 1));
  document.getElementById('decrementBtn').addEventListener('click', () => updateDayValue(isShifting ? -10 : -1));
  document.getElementById('closeDayModal').addEventListener('click', closeDayModal);
  document.getElementById('closeDayModalX').addEventListener('click', closeDayModal);

  // habit settings
  document.getElementById('saveHabitSettings').addEventListener('click', saveHabitSettings);
  document.getElementById('cancelHabitSettings').addEventListener('click', () => hideModal('habitSettingsModal'));
  document.getElementById('cancelHabitSettingsX').addEventListener('click', () => hideModal('habitSettingsModal'));
  document.getElementById('deleteHabitBtn').addEventListener('click', deleteCurrentHabit);

  // type toggle
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      toggleUnitField(btn.dataset.type);
    });
  });

  // icon selector
  document.querySelectorAll('.icon-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.icon-opt').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });

  // color custom input
  document.getElementById('habitSettingsColor').addEventListener('input', e => {
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
  });

  // manage modal
  document.getElementById('closeManage').addEventListener('click', () => hideModal('manageModal'));
  document.getElementById('addNewHabit').addEventListener('click', () => {
    const i = state.habits.length;
    const newHabit = {
      id: Date.now().toString(),
      name: 'New habit',
      color: PALETTE[i % PALETTE.length],
      icon: 'fas fa-star',
      type: 'number',
      unit: '',
      reasons: [],
      archived: false,
      currentRange: 'year'
    };
    state.habits.push(newHabit);
    saveData();
    renderManageList();
    renderHabits();
    // open settings for it
    setTimeout(() => {
      hideModal('manageModal');
      openHabitSettings(newHabit);
    }, 100);
  });

  let archivedVisible = false;
  document.getElementById('showArchivedBtn').addEventListener('click', () => {
    archivedVisible = !archivedVisible;
    const archList = document.getElementById('archivedHabitsList');
    if (archivedVisible) {
      renderArchivedList();
      archList.classList.remove('hidden');
      document.getElementById('showArchivedBtn').innerHTML = '<i class="fas fa-box-archive"></i> Hide archived';
    } else {
      archList.classList.add('hidden');
      document.getElementById('showArchivedBtn').innerHTML = '<i class="fas fa-box-archive"></i> Show archived';
    }
  });

  // shift key for +10
  document.addEventListener('keydown', e => { if (e.key === 'Shift') isShifting = true; });
  document.addEventListener('keyup',   e => { if (e.key === 'Shift') isShifting = false; });

  // resize re-render
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderHabits, 250);
  });
}

init();
