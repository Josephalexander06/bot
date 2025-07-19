let timetable = {};
let reminders = [];

const today = now.toISOString().split('T')[0];

// Fetch data on load
fetchData();

async function fetchData() {
    const res = await fetch('/data');
    const data = await res.json();
    timetable = data.timetable;
    reminders = data.reminders;
    renderTimetable();
    renderReminders();
}
// ----- Reminders Section -----
function renderReminders() {
    const reminderList = document.getElementById('reminderList');
    if (!reminderList) return;

    reminderList.innerHTML = '';
    reminders.forEach((rem, idx) => {
        const li = document.createElement('li');
        li.draggable = true;
        li.textContent = `${rem.date}: ${rem.note}`;

        li.ondblclick = () => {
            if (confirm('Delete this reminder?')) {
                deleteReminder(idx);
            }
        };

        reminderList.appendChild(li);
    });

    enableDragDrop(reminderList);
}

document.getElementById('addReminderBtn')?.addEventListener('click', () => {
    const date = document.getElementById('reminderDate').value;
    const note = document.getElementById('reminderNote').value.trim();
    if (!date || !note) return alert('Please enter date and note.');

    const today = new Date().toISOString().split('T')[0];
    if (date < today) {
        return alert('Cannot select a past date for reminder.');
    }

    reminders.push({ date, note });
    document.getElementById('reminderDate').value = '';
    document.getElementById('reminderNote').value = '';
    saveReminders();
});


function saveReminders() {
    fetch('/update-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reminders)
    }).then(fetchData);
}


function deleteReminder(index) {
    fetch('/delete-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index })
    }).then(fetchData);
}

function enableDragDrop(list) {
    let dragged;
    list.addEventListener('dragstart', e => dragged = e.target);
    list.addEventListener('dragover', e => e.preventDefault());
    list.addEventListener('drop', e => {
        e.preventDefault();
        const nodes = Array.from(list.children);
        const fromIdx = nodes.indexOf(dragged);
        const toIdx = nodes.indexOf(e.target);

        if (fromIdx > -1 && toIdx > -1 && fromIdx !== toIdx) {
            reminders.splice(toIdx, 0, reminders.splice(fromIdx, 1)[0]);
            saveReminders();
        }
    });
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
