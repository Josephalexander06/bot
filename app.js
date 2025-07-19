const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;
const cron = require('node-cron');
const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
    authStrategy: new LocalAuth(),
   puppeteer: {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
}

});


client.initialize();

const chatId = '120363401032893110@g.us';

// Every day at 9 AM, check for reminders due in 48 hours
// At 9 AM IST daily → send reminders + cleanup
cron.schedule('0 9 * * *', send48HourReminders, {
    timezone: 'Asia/Kolkata'
});

// At 12 AM IST daily → cleanup only (optional redundancy)
cron.schedule('0 0 * * *', cleanupReminders, {
    timezone: 'Asia/Kolkata'
});

cron.schedule('0 6 * * *', sendTodayTimetable, {
    timezone: 'Asia/Kolkata'
});


const timetableFile = './timetable.json';
const remindersFile = './reminders.json';

let timetable = fs.existsSync(timetableFile) ? require(timetableFile) : {};
let reminders = fs.existsSync(remindersFile) ? require(remindersFile) : [];

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

client.on('ready', () => {
    console.log('✅ WhatsApp client is ready');
});


// Get all data
app.get('/data', (req, res) => {
    res.json({ timetable, reminders });
});

app.get('/get-timetable', (req, res) => {
    res.json(timetable);
});


app.get('/get-reminders', (req, res) => {
    res.json(reminders);
});

function send48HourReminders() {
    const notifyDate = new Date();
    notifyDate.setDate(notifyDate.getDate() + 2); // 48 hours ahead
    const notifyStr = notifyDate.toISOString().split('T')[0];

    const upcoming = reminders.filter(r => r.date === notifyStr);

    if (upcoming.length > 0) {
        const message = '🔔 *Upcoming Reminders in 48 hours:*\n\n' +
            upcoming.map(r => `📅 ${r.date}: ${r.note}`).join('\n');

        client.sendMessage(chatId, message)
            .then(() => console.log('✅ 48-hour reminders sent'))
            .catch(err => console.error('❌ Failed to send reminders:', err));
    } else {
        console.log('No reminders due in 48 hours.');
    }
}


function sendTodayTimetable() {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const now = new Date();
    const dayName = days[now.getDay()];
    const todaySubjects = timetable[dayName] || [];

    if (todaySubjects.length === 0) {
        console.log(`No timetable entries for ${dayName}.`);
        return;
    }

    const message = `📅 *Today's Timetable* (${capitalize(dayName)}):\n\n` +
        todaySubjects.map(entry => `🕒 ${entry}`).join('\n');

    client.sendMessage(chatId, message)
        .then(() => console.log('✅ Today\'s timetable sent to WhatsApp'))
        .catch(err => console.error('❌ Failed to send today\'s timetable:', err));
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}


// Add subject to a specific day and time
app.post('/add-timetable-subject', (req, res) => {
    const { day, time, newSubject } = req.body;
    const dayKey = day.toLowerCase();

    if (!timetable[dayKey]) timetable[dayKey] = [];
    // Remove existing subject at that time if any
    timetable[dayKey] = timetable[dayKey].filter(e => !e.startsWith(time));
    timetable[dayKey].push(`${time}-${newSubject}`);

    fs.writeFileSync(timetableFile, JSON.stringify(timetable, null, 2));
    res.send('Subject added.');
});

// Edit subject for a specific day and time
app.post('/edit-timetable-subject', (req, res) => {
    const { day, time, newSubject } = req.body;
    const dayKey = day.toLowerCase();

    if (!timetable[dayKey]) return res.status(404).send('Day not found.');

    timetable[dayKey] = timetable[dayKey].map(e => {
        if (e.startsWith(time)) {
            return `${time}-${newSubject}`;
        }
        return e;
    });

    fs.writeFileSync(timetableFile, JSON.stringify(timetable, null, 2));
    res.send('Subject edited.');
});

// Delete subject for a specific day and time
app.post('/delete-timetable-subject', (req, res) => {
    const { day, time } = req.body;
    const dayKey = day.toLowerCase();

    if (!timetable[dayKey]) return res.status(404).send('Day not found.');

    timetable[dayKey] = timetable[dayKey].filter(e => !e.startsWith(time));

    fs.writeFileSync(timetableFile, JSON.stringify(timetable, null, 2));
    res.send('Subject deleted.');
});

app.post('/add-reminder', (req, res) => {
    const newReminders = req.body.reminders;
    if (!newReminders || !Array.isArray(newReminders)) {
        return res.status(400).send('Invalid reminder data.');
    }

    reminders = reminders.concat(newReminders);
    fs.writeFileSync(remindersFile, JSON.stringify(reminders, null, 2));
    res.send('✅ Reminders uploaded successfully.');
});

app.post('/reset-timetable', (req, res) => {
    timetable = {};
    fs.writeFileSync(timetableFile, JSON.stringify(timetable, null, 2));
    res.send('✅ Timetable has been reset.');
});


// Update reminders
app.post('/update-reminders', (req, res) => {
    reminders = req.body;
    fs.writeFileSync(remindersFile, JSON.stringify(reminders, null, 2));
    res.send('✅ Reminders updated');
});

// Delete a reminder by index
app.post('/delete-reminder', (req, res) => {
    const { index } = req.body;
    if (typeof index !== 'number' || index < 0 || index >= reminders.length) {
        return res.status(400).send('Invalid index');
    }
    reminders.splice(index, 1);
    fs.writeFileSync(remindersFile, JSON.stringify(reminders, null, 2));
    res.send('✅ Reminder deleted');
});

function cleanupReminders() {
    const today = new Date().toISOString().split('T')[0];
    const beforeCount = reminders.length;

    reminders = reminders.filter(rem => rem.date >= today);
    fs.writeFileSync(remindersFile, JSON.stringify(reminders, null, 2));

    console.log(`🗑️ Cleaned up expired reminders. Removed ${beforeCount - reminders.length} items.`);
}
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}


// Start server
app.listen(port, () => console.log(`🚀 Server running at http://localhost:${port}`));
