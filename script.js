const state = {
    name: '',
    habits: [],
    data: {}
};

let currentDayEdit = null;
let currentColorEdit = null;
let isSetupComplete = false;

const pastelColors = [
    '#FFB5E8', '#FF9CEE', '#FFCCF9', '#FCC2FF', '#F6A6FF', '#B28DFF',
    '#C5A3FF', '#D5AAFF', '#ECD4FF', '#FBE4FF', '#DCD3FF', '#A79AFF',
    '#B5B9FF', '#97A2FF', '#AFCBFF', '#AFF8DB', '#C4FAF8', '#85E3FF',
    '#ACE7FF', '#6EB5FF', '#BFFCC6', '#DBFFD6', '#F3FFE3', '#E7FFAC',
    '#FFFFD1', '#FFF5BA', '#FFABAB', '#FFBEBC', '#FFCBC1', '#FFC9DE'
];

function loadData() {
    try {
        const name = localStorage.getItem('habit-name');
        if (name) state.name = name;

        const habits = localStorage.getItem('habit-list');
        if (habits) state.habits = JSON.parse(habits);

        const data = localStorage.getItem('habit-data');
        if (data) state.data = JSON.parse(data);

        const setupComplete = localStorage.getItem('habit-setup-complete');
        isSetupComplete = setupComplete === 'true';
    } catch (e) {
        console.log('No existing data');
    }
}

function saveData() {
    try {
        localStorage.setItem('habit-name', state.name);
        localStorage.setItem('habit-list', JSON.stringify(state.habits));
        localStorage.setItem('habit-data', JSON.stringify(state.data));
        localStorage.setItem('habit-setup-complete', 'true');
        isSetupComplete = true;
    } catch (e) {
        console.error('Failed to save:', e);
    }
}


function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    if (hour < 22) return 'Good evening';
    return 'Welcome back';
}

function updateGreeting() { // added date to this too
    document.getElementById('greetingText').textContent = getGreeting();
    const nameEl = document.getElementById('nameDisplay');
    if (state.name) {
        nameEl.textContent = state.name;
        nameEl.style.color = '';
        nameEl.style.fontWeight = '600';
    } else {
        nameEl.textContent = 'friend';
        nameEl.style.color = '#999';
    }

    const now = new Date();
    
    document.getElementById('dayOfWeek').textContent = now.toLocaleDateString(undefined, {
        weekday: 'long'
    });
    
    document.getElementById('dateDisplay').textContent = now.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function makeNameEditable() {
    const nameEl = document.getElementById('nameDisplay');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'name-input';
    input.value = state.name;
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    input.addEventListener('blur', () => {
        state.name = input.value || 'friend';
        saveData();
        const span = document.createElement('span');
        span.className = 'name';
        span.id = 'nameDisplay';
        span.textContent = state.name;
        span.addEventListener('click', makeNameEditable);
        input.replaceWith(span);
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') input.blur();
    });
}

function calculateCurrentStreak(habitId, year) {
    const habitData = state.data[habitId] || {};
    const today = new Date();
    const currentYear = today.getFullYear();
    
    // Only calculate streak for current year
    if (year !== currentYear) {
        return 0;
    }
    
    let streak = 0;
    let checkDate = new Date(today);
    
    // Count consecutive days backwards from today
    while (checkDate.getFullYear() === currentYear) {
        const dateKey = dateToKey(checkDate);
        const value = habitData[dateKey] || 0;
        
        if (value > 0) {
            streak++;
        } else {
            break;
        }
        
        checkDate.setDate(checkDate.getDate() - 1);
    }
    
    return streak;
}

function dateToKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateTooltip(date) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    const suffix = day === 1 || day === 21 || day === 31 ? 'st' :
        day === 2 || day === 22 ? 'nd' :
            day === 3 || day === 23 ? 'rd' : 'th';

    return `${dayName}, ${day}${suffix} ${month} ${year}`;
}

function getYearData(habitId, year) {
    const data = state.data[habitId] || {};
    const yearData = {};

    for (const key in data) {
        if (key.startsWith(year + '-')) {
            yearData[key] = data[key];
        }
    }

    return yearData;
}

function getMaxValue(habitId, year) {
    const yearData = getYearData(habitId, year);
    return Math.max(0, ...Object.values(yearData));
}

function getAlternateColor(baseColor, isAlternate) {
    if (!isAlternate) return baseColor;

    // Handle hex colors
    if (baseColor.startsWith('#')) {
        const r = parseInt(baseColor.slice(1, 3), 16);
        const g = parseInt(baseColor.slice(3, 5), 16);
        const b = parseInt(baseColor.slice(5, 7), 16);

        // Darken by 15%
        const nr = Math.max(0, Math.round(r * 0.97));
        const ng = Math.max(0, Math.round(g * 0.97));
        const nb = Math.max(0, Math.round(b * 0.97));

        return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
    }

    // Handle rgb colors or fallback
    return baseColor;
}

function makeHabitTitleEditable(habit, titleElement) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'habit-title-input';
    input.value = habit.name;
    titleElement.replaceWith(input);
    input.focus();
    input.select();

    function finishEditing() {
        habit.name = input.value || 'Untitled Habit';
        saveData();
        const newTitle = document.createElement('div');
        newTitle.className = 'habit-title';
        
        // Preserve the icon when recreating the title
        const iconHtml = habit.icon ? `<i class="${habit.icon}"></i> ` : '';
        newTitle.innerHTML = iconHtml + habit.name;
        
        newTitle.addEventListener('click', (e) => {
            e.stopPropagation();
            makeHabitTitleEditable(habit, newTitle);
        });
        input.replaceWith(newTitle);
    }

    input.addEventListener('blur', finishEditing);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        }
        if (e.key === 'Escape') {
            input.value = habit.name;
            input.blur();
        }
    });
}

function makeDraggable(card, habit) {
    card.draggable = true;

    card.addEventListener('dragstart', (e) => {
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', habit.id);
        e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        document.querySelectorAll('.habit-card').forEach(c => c.classList.remove('drag-over'));
    });

    card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!card.classList.contains('dragging')) {
            card.classList.add('drag-over');
        }
    });

    card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
    });

    card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');

        const draggedId = e.dataTransfer.getData('text/plain');
        const draggedIndex = state.habits.findIndex(h => h.id === draggedId);
        const targetIndex = state.habits.findIndex(h => h.id === habit.id);

        if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
            const draggedHabit = state.habits.splice(draggedIndex, 1)[0];
            state.habits.splice(targetIndex, 0, draggedHabit);
            saveData();
            renderHabits();
        }
    });
}

function interpolateColor(color, value, max) {
    if (value === 0 || max === 0) return '#f5f5f5';

    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    // originally was ratio = value / max but changed to have a min base ratio of 0.15 for better visibility
    const ratio =  0.15+Math.min(0.85, value / max);
    //const ratio = value / max;
    const nr = Math.round(245 + (r - 245) * ratio);
    const ng = Math.round(245 + (g - 245) * ratio);
    const nb = Math.round(245 + (b - 245) * ratio);

    return `rgb(${nr}, ${ng}, ${nb})`;
}

function renderCalendar(habit, year, container) {
    container.innerHTML = '';

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    const firstDay = startDate.getDay();
    if (firstDay !== 0) {
        startDate.setDate(startDate.getDate() - firstDay);
    }

    const data = state.data[habit.id] || {};
    const maxVal = getMaxValue(habit.id, year);
    const today = new Date();
    const todayKey = dateToKey(today);

    const grid = document.createElement('div');
    grid.className = 'calendar-grid';

    let currentDate = new Date(startDate);
    let weekCount = 0;

    // Calculate total weeks needed for the year
    const totalWeeks = Math.ceil((endDate - startDate) / (7 * 24 * 60 * 60 * 1000)) + 2;
    grid.style.gridTemplateColumns = `repeat(${totalWeeks}, 1fr)`;

    while (currentDate.getFullYear() < year ||
        (currentDate.getFullYear() === year && currentDate <= endDate) ||
        currentDate.getDay() !== 0) {

        for (let day = 0; day < 7; day++) {
            const dateKey = dateToKey(currentDate);
            const value = data[dateKey] || 0;
            const isCurrentYear = currentDate.getFullYear() === year;
            const monthIndex = currentDate.getMonth();
            const isAlternateMonth = monthIndex % 2 === 1;
            const isToday = dateKey === todayKey && isCurrentYear;

            let color;
            if (isCurrentYear) {
                const baseColor = isAlternateMonth ? getAlternateColor(habit.color, true) : habit.color;
                color = value > 0 ? interpolateColor(baseColor, value, maxVal) : (isAlternateMonth ? getAlternateColor('#f5f5f5', true) : '#f5f5f5');
            } else {
                color = '#f5f5f5';
            }

            const dayEl = document.createElement('div');
            dayEl.className = 'day';
            if (isToday) {
                dayEl.classList.add('today');
            }
            dayEl.style.background = color;
            dayEl.style.opacity = isCurrentYear ? '1' : '0.3';
            dayEl.style.gridColumn = weekCount + 1;
            dayEl.style.gridRow = day + 1;

            if (isCurrentYear) {
                const capturedDate = new Date(currentDate);
                const currentValue = data[dateKey] || 0;

                const tooltip = document.createElement('div');
                tooltip.className = 'day-tooltip';
                const unitText = habit.unit ? ` ${habit.unit}` : '';
                tooltip.innerHTML = `${formatDateTooltip(capturedDate)}<br><strong>Count: ${currentValue}${unitText}</strong>`;
                dayEl.appendChild(tooltip);

                dayEl.addEventListener('click', () => {
                    openDayModal(habit, capturedDate);
                });

                dayEl.addEventListener('mouseenter', () => {
                    const dayRect = dayEl.getBoundingClientRect();
                    const gridRect = grid.getBoundingClientRect();

                    // Y position relative to the calendar grid
                    const yInGrid = dayRect.top - gridRect.top;
                    const xInGrid = dayRect.left - gridRect.left;

                    // Reset classes
                    tooltip.classList.remove('tooltip-below', 'tooltip-left', 'tooltip-right');

                    // Example threshold INSIDE the grid (not viewport)
                    if (yInGrid < 50) {
                        tooltip.classList.add('tooltip-below');
                    }

                    const gridWidth = gridRect.width;
                    // Horizontal logic (grid-based)
                    if (xInGrid < 80) {
                        tooltip.classList.add('tooltip-left');
                    } else if (xInGrid > gridWidth - 210) {
                        tooltip.classList.add('tooltip-right');
                    }
                });

            }

            grid.appendChild(dayEl);
            currentDate.setDate(currentDate.getDate() + 1);
        }

        weekCount++;
    }

    container.appendChild(grid);
}

function openDayModal(habit, date) {
    const dateKey = dateToKey(date);
    const value = (state.data[habit.id] || {})[dateKey] || 0;

    currentDayEdit = { habit, date, dateKey };

    document.getElementById('dayModalTitle').textContent =
        `${habit.name} - ${date.toLocaleDateString()}`;
    document.getElementById('dayModalValue').textContent = value;
    document.getElementById('dayModal').classList.remove('hidden');
}

function closeDayModal() {
    currentDayEdit = null;
    document.getElementById('dayModal').classList.add('hidden');
}

let currentHabitSettings = null;

function openHabitSettingsModal(habit) {
    currentHabitSettings = habit;

    document.getElementById('habitSettingsName').value = habit.name || '';
    document.getElementById('habitSettingsColor').value = habit.color || '#FFB5E8';
    document.getElementById('habitSettingsUnit').value = habit.unit || '';
    
    // Set current icon
    const currentIcon = habit.icon || 'fas fa-star';
    document.querySelectorAll('.icon-option').forEach(option => {
        option.classList.remove('selected');
        if (option.dataset.icon === currentIcon) {
            option.classList.add('selected');
        }
    });

    document.getElementById('habitSettingsModal').classList.remove('hidden');
}

function closeHabitSettingsModal() {
    currentHabitSettings = null;
    document.getElementById('habitSettingsModal').classList.add('hidden');
}

function saveHabitSettings() {
    if (!currentHabitSettings) return;

    currentHabitSettings.name = document.getElementById('habitSettingsName').value || 'Untitled Habit';
    currentHabitSettings.color = document.getElementById('habitSettingsColor').value;
    currentHabitSettings.unit = document.getElementById('habitSettingsUnit').value;
    
    const selectedIcon = document.querySelector('.icon-option.selected');
    currentHabitSettings.icon = selectedIcon ? selectedIcon.dataset.icon : 'fas fa-star';

    saveData();
    renderHabits();
    closeHabitSettingsModal();
}

function openColorModal(habit) {
    currentColorEdit = habit;

    const swatchesContainer = document.getElementById('colorSwatches');
    swatchesContainer.innerHTML = '';

    pastelColors.forEach(color => {
        const swatch = document.createElement('button');
        swatch.className = 'color-swatch';
        swatch.style.background = color;
        if (habit.color.toUpperCase() === color.toUpperCase()) {
            swatch.classList.add('selected');
        }
        swatch.addEventListener('click', () => {
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
            swatch.classList.add('selected');
            habit.color = color;
            document.getElementById('customColorInput').value = color;
        });
        swatchesContainer.appendChild(swatch);
    });

    document.getElementById('customColorInput').value = habit.color;
    document.getElementById('colorModal').classList.remove('hidden');
}

function closeColorModal() {
    if (currentColorEdit) {
        saveData();
        renderHabits();
    }
    currentColorEdit = null;
    document.getElementById('colorModal').classList.add('hidden');
}

function updateDayValue(delta) {
    if (!currentDayEdit) return;

    const { habit, dateKey } = currentDayEdit;

    if (!state.data[habit.id]) state.data[habit.id] = {};

    const current = state.data[habit.id][dateKey] || 0;
    const newValue = Math.max(0, current + delta);

    state.data[habit.id][dateKey] = newValue;
    document.getElementById('dayModalValue').textContent = newValue;

    saveData();
    renderHabits(); // This will update the day indicators
}

function renderHabit(habit) {
    const card = document.createElement('div');
    card.className = 'habit-card';
    // set id
    card.id = `habit-card`;

    // Make draggable
    makeDraggable(card, habit);

    // Check if mobile
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
        card.classList.add('collapsed');
    }

    const header = document.createElement('div');
    header.className = 'habit-header';

    const title = document.createElement('div');
    title.className = 'habit-title';
    
    const iconHtml = habit.icon ? `<i class="${habit.icon}"></i> ` : '';
    title.innerHTML = iconHtml + habit.name + (isMobile ? ' ▼' : '');

    // Make title clickable for editing
    title.addEventListener('click', (e) => {
        e.stopPropagation();
        makeHabitTitleEditable(habit, title);
    });

    const controls = document.createElement('div');
    controls.className = 'habit-controls';

    // Year navigation
    const yearNav = document.createElement('div');
    yearNav.className = 'year-nav';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'year-btn';
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';

    const yearText = document.createElement('div');
    yearText.className = 'year-text';
    yearText.textContent = habit.currentYear || new Date().getFullYear();

    const nextBtn = document.createElement('button');
    nextBtn.className = 'year-btn';
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';

    prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        habit.currentYear = (habit.currentYear || new Date().getFullYear()) - 1;
        saveData();
        renderHabits();
    });

    nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        habit.currentYear = (habit.currentYear || new Date().getFullYear()) + 1;
        saveData();
        renderHabits();
    });

    yearNav.appendChild(prevBtn);
    yearNav.appendChild(yearText);
    yearNav.appendChild(nextBtn);

    // Settings button
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'settings-btn';
    settingsBtn.innerHTML = '<i class="fas fa-cog"></i>';
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openHabitSettingsModal(habit);
    });

    // Streak counter (only show if there's a streak)
    const currentYear = habit.currentYear || new Date().getFullYear();
    const streak = calculateCurrentStreak(habit.id, currentYear);
    
    if (streak > 0) {
        const streakCounter = document.createElement('div');
        streakCounter.className = 'streak-counter';
        streakCounter.innerHTML = `
            <i class="fas fa-fire"></i>
            <span>${streak}</span>
        `;
        controls.appendChild(streakCounter);
    }

    controls.appendChild(yearNav);
    controls.appendChild(settingsBtn);
    header.appendChild(title);
    header.appendChild(controls);

    const calendar = document.createElement('div');
    calendar.className = 'calendar';

    renderCalendar(habit, habit.currentYear || new Date().getFullYear(), calendar);

    // Mobile collapse/expand
    if (isMobile) {
        header.addEventListener('click', (e) => {
            if (e.target.closest('.year-btn') || e.target.closest('.color-picker') || e.target.closest('.habit-title')) {
                return;
            }
            card.classList.toggle('collapsed');
            const titleText = title.textContent;
            if (card.classList.contains('collapsed')) {
                title.textContent = titleText.replace(' ▲', ' ▼');
            } else {
                title.textContent = titleText.replace(' ▼', ' ▲');
            }
        });
    }

    card.appendChild(header);
    card.appendChild(calendar);

    return card;
}

function renderHabits() {
    const grid = document.getElementById('habitsGrid');
    grid.innerHTML = '';

    state.habits.forEach(habit => {
        grid.appendChild(renderHabit(habit));
    });
}

function renderSetupHabit(habit, index) {
    const item = document.createElement('div');
    item.className = 'habit-item';

    const header = document.createElement('div');
    header.className = 'habit-item-header';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'form-input';
    nameInput.placeholder = 'Habit name';
    nameInput.value = habit.name;
    nameInput.style.flex = '1';
    nameInput.addEventListener('input', (e) => {
        habit.name = e.target.value;
    });

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'color-picker';
    colorInput.value = habit.color;
    colorInput.addEventListener('change', (e) => {
        habit.color = e.target.value;
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-secondary btn-small';
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', () => {
        state.habits.splice(index, 1);
        renderSetupModal();
    });

    header.appendChild(nameInput);
    header.appendChild(colorInput);
    header.appendChild(deleteBtn);
    item.appendChild(header);

    return item;
}

function renderSetupModal() {
    const container = document.getElementById('setupHabits');
    container.innerHTML = '';

    state.habits.forEach((habit, i) => {
        container.appendChild(renderSetupHabit(habit, i));
    });
}

function showSetupModal() {
    document.getElementById('setupName').value = state.name;
    renderSetupModal();
    document.getElementById('setupModal').classList.remove('hidden');
}

var shifting = false;

function openQuickAdd() {
    const today = new Date();
    const dateKey = dateToKey(today);

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    document.getElementById('quickAddTitle').textContent =
        `${days[today.getDay()]}, ${months[today.getMonth()]} ${today.getDate()}`;

    const container = document.getElementById('quickAddHabits');
    container.innerHTML = '';

    state.habits.forEach(habit => {
        if (!state.data[habit.id]) state.data[habit.id] = {};
        const value = state.data[habit.id][dateKey] || 0;

        const item = document.createElement('div');
        item.className = 'quick-add-item';

        const label = document.createElement('div');
        label.className = 'quick-add-label';
        label.textContent = habit.name;

        const controls = document.createElement('div');
        controls.className = 'quick-add-controls';

        const decrementBtn = document.createElement('button');
        decrementBtn.className = 'quick-add-btn-small';
        decrementBtn.textContent = '−';
        decrementBtn.addEventListener('click', () => {
            const current = state.data[habit.id][dateKey] || 0;
            const newValue = Math.max(0, current - 1);
            state.data[habit.id][dateKey] = newValue;
            valueSpan.textContent = newValue;
            saveData();
            renderHabits(); // Update day indicators
        });

        const valueSpan = document.createElement('div');
        valueSpan.className = 'quick-add-value';
        valueSpan.textContent = value;

        const incrementBtn = document.createElement('button');
        incrementBtn.className = 'quick-add-btn-small';
        incrementBtn.textContent = '+';
        incrementBtn.addEventListener('click', () => {
            const current = state.data[habit.id][dateKey] || 0;
            const newValue = current + 1;
            state.data[habit.id][dateKey] = newValue;
            valueSpan.textContent = newValue;
            saveData();
            renderHabits(); // Update day indicators
        });

        controls.appendChild(decrementBtn);
        controls.appendChild(valueSpan);
        controls.appendChild(incrementBtn);

        item.appendChild(label);
        item.appendChild(controls);
        container.appendChild(item);
    });

    document.getElementById('quickAddModal').classList.remove('hidden');
}

document.addEventListener('keydown', (event)=> {
    if (event.key == "Shift") {
        shifting = true;
    }
});

document.addEventListener('keyup', (event)=> {
    if (event.key == "Shift") {
        shifting = false;
    }
});



function closeQuickAdd() {
    document.getElementById('quickAddModal').classList.add('hidden');
}

function init() {
    loadData();

    if (!state.name || state.habits.length === 0) {
        if (state.habits.length === 0) {
            state.habits = [
                { id: Date.now() + '-1', name: 'Exercise', color: '#FFB5E8', currentYear: new Date().getFullYear() },
                { id: Date.now() + '-2', name: 'Reading', color: '#AFCBFF', currentYear: new Date().getFullYear() },
                { id: Date.now() + '-3', name: 'Meditation', color: '#C5A3FF', currentYear: new Date().getFullYear() },
                { id: Date.now() + '-4', name: 'Writing', color: '#BFFCC6', currentYear: new Date().getFullYear() }
            ];
        }
        showSetupModal();
    }

    updateGreeting();
    setInterval(updateGreeting, 1000 * 60 * 5); // Update greeting every 5 minutes

    renderHabits();

    document.getElementById('nameDisplay').addEventListener('click', makeNameEditable);

    document.getElementById('addSetupHabit').addEventListener('click', () => {
        state.habits.push({
            id: Date.now().toString(),
            name: '',
            color: '#000000',
            currentYear: new Date().getFullYear()
        });
        renderSetupModal();
    });

    document.getElementById('confirmSetup').addEventListener('click', () => {
        if (!document.getElementById('setupName').value) {
            alert('Please enter your name');
            return;
        }

        state.name = document.getElementById('setupName').value;
        state.habits = state.habits.filter(h => h.name.trim());

        if (state.habits.length === 0) {
            alert('Please add at least one habit');
            return;
        }

        saveData();
        document.getElementById('setupModal').classList.add('hidden');
        updateGreeting();
        renderHabits();
    });

    document.getElementById('editHabitBtn').addEventListener('click', () => {
        showSetupModal();
    });

    document.getElementById('quickAddBtn').addEventListener('click', openQuickAdd);

    document.getElementById('incrementBtn').addEventListener('click', () => updateDayValue((shifting) ? 10 : 1));
    document.getElementById('decrementBtn').addEventListener('click', () => updateDayValue((shifting) ? -10 : -1));
    document.getElementById('closeDayModal').addEventListener('click', closeDayModal);

    document.getElementById('dayModal').addEventListener('click', (e) => {
        if (e.target.id === 'dayModal') closeDayModal();
    });

    document.getElementById('customColorInput').addEventListener('input', (e) => {
        if (currentColorEdit) {
            currentColorEdit.color = e.target.value;
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        }
    });

    document.getElementById('confirmColor').addEventListener('click', closeColorModal);

    document.getElementById('colorModal').addEventListener('click', (e) => {
        if (e.target.id === 'colorModal') closeColorModal();
    });

    document.getElementById('closeQuickAdd').addEventListener('click', closeQuickAdd);

    document.getElementById('quickAddModal').addEventListener('click', (e) => {
        if (e.target.id === 'quickAddModal') closeQuickAdd();
    });

    // Habit settings modal event listeners
    document.getElementById('saveHabitSettings').addEventListener('click', saveHabitSettings);
    document.getElementById('cancelHabitSettings').addEventListener('click', closeHabitSettingsModal);
    
    document.getElementById('habitSettingsModal').addEventListener('click', (e) => {
        if (e.target.id === 'habitSettingsModal') closeHabitSettingsModal();
    });

    // Icon selector event listeners
    document.addEventListener('click', (e) => {
        if (e.target.closest('.icon-option')) {
            document.querySelectorAll('.icon-option').forEach(option => option.classList.remove('selected'));
            e.target.closest('.icon-option').classList.add('selected');
        }
    });

    document.getElementById('setupModal').addEventListener('click', (e) => {
        if (e.target.id === 'setupModal' && isSetupComplete) {
            document.getElementById('setupModal').classList.add('hidden');
        }
    });

    // Handle window resize for mobile collapse
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            renderHabits();
        }, 250);
    });
}

init();