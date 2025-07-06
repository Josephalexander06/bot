const { Client, LocalAuth } = require('whatsapp-web.js');
const { Buttons } = require('whatsapp-web.js');

const qrcode = require('qrcode-terminal');
const fs = require('fs');
const cron = require('node-cron');

// Load timetable
const timetableFile = './timetable.json';
let timetable = require(timetableFile);
const daysMap = {
    mon: 'monday',
    tue: 'tuesday',
    wed: 'wednesday',
    thu: 'thursday',
    fri: 'friday',
    sat: 'saturday',
    sun: 'sunday',
    monday: 'monday',
    tuesday: 'tuesday',
    wednesday: 'wednesday',
    thursday: 'thursday',
    friday: 'friday',
    saturday: 'saturday',
    sunday: 'sunday'
};

const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
deleteTimers={}

// Create client
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
    }
});

const menu = new Buttons(
    '🤖 Welcome! Choose an option:',
    [
        { body: '📅 Today' },
        { body: '📘 Monday' },
        { body: '❓ Help' }
    ],
    '📆 Timetable Bot',
    'Tap one of the buttons below'
);

// Show QR on startup
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

// Notify when bot is ready
client.on('ready', () => {
    console.log('✅ Bot is ready');
});

// 🕓 Auto-send today’s timetable at 6 AM
cron.schedule('0 6 * * *', async () => {
    const todayName = days[new Date().getDay()];
    const schedule = timetable[todayName] || [];
    const messageText = schedule.length > 0
        ? `📅 *${todayName.toUpperCase()}* Time Table:\n\n` +
        schedule.map(item => {
            const [time, subject] = item.split('-');
            return `🕒 *${time.trim()}* – ${subject.trim()}`;
        }).join('\n')
        : `📅 *${todayName.toUpperCase()}*\n\n🚫 No classes today.`;

    const chatId = '120363401032893110@g.us';

    try {
        const chat = await client.getChatById(chatId);
        const sentMsg = await chat.sendMessage(messageText);
        setTimeout(() => sentMsg.delete(true).catch(() => { }), 48 * 60 * 60 * 1000);
    } catch (err) {
        console.error('❌ Failed to auto-send timetable:', err.message);
    }
});


// 💬 Handle all messages
client.on('message', async (message) => {
    const fullText = message.body.trim();
    const chat = await message.getChat();
    const todayName = days[new Date().getDay()];
    const schedule = timetable[todayName] || [];

    // ✨ Always show menu first
    await client.sendMessage(message.from, menu);

    const text = message.body.trim().toLowerCase();

    if (fullText === 'hi' || fullText === 'Hi') {
    return message.reply('👋 Hello! Bot is working.');
  }

    // 🔘 Button: "Today"
    if (text === 'today' || text === '📅 today') {
        const reply = schedule.length > 0
            ? `📅 *${todayName.toUpperCase()}* Time Table:\n\n` +
            schedule.map(item => {
                const [time, subject] = item.split('-');
                return subject
                    ? `🕒 *${time.trim()}* – ${subject.trim()}`
                    : `🕒 ${item.trim()}`; // fallback if there's no '-'

            }).join('\n')
            : `📅 *${todayName.toUpperCase()}*\n\n🚫 No classes today.`;

        const sentMsg = await message.reply(reply);
        setTimeout(() => sentMsg.delete(true).catch(() => { }), 48 * 60 * 60 * 1000);
        return;
    }

    // 🔘 Button: Specific day (e.g. "Monday")

    if (days.includes(text)) {
        const matchedDay = daysMap[text];
        if (matchedDay) {
            const scheduleForDay = timetable[matchedDay] || [];
            const reply = scheduleForDay.length > 0
                ? `📅 *${text.toUpperCase()}* Time Table:\n\n` +
                scheduleForDay.map(item => {
                    const [time, subject] = item.split('-');
                    return subject
                        ? `🕒 *${time.trim()}* – ${subject.trim()}`
                        : `🕒 ${item.trim()}`; // fallback if there's no '-'
                }).join('\n')
                : `📅 *${text.toUpperCase()}*\n\n🚫 No classes today.`;

            const sentMsg = await message.reply(reply);
            setTimeout(() => sentMsg.delete(true).catch(() => { }), 48 * 60 * 60 * 1000);
            return;
        }
    }

    // 📝 Upload timetable: "upload monday 9AM-Math, 10AM-Lab"
    if (text.startsWith('upload ')) {
        const parts = fullText.split(' ');
        const entryRaw = parts.slice(2).join(' ');

        const inputDay = parts[1]?.toLowerCase();
        const day = daysMap[inputDay]; // maps mon → monday

        if (!day) {
            return message.reply("❌ Invalid day. Use:\n`upload mon 10 AM MATHS 11 AM LAB`");
        }

        // Use regex to extract all time-subject pairs
        const regex = /(\d{1,2}\s*(?:AM|PM))\s+([A-Z]+)/gi;
        const matches = [...entryRaw.matchAll(regex)];

        if (matches.length === 0) {
            return message.reply("⚠️ Could not find any valid time-subject entries.");
        }

        // Convert to ["10AM-MATHS", "11AM-LAB"]
        const formatted = matches.map(match => `${match[1].replace(/\s+/g, '')}-${match[2].toUpperCase()}`);
        timetable[day] = formatted;

        fs.writeFileSync(timetableFile, JSON.stringify(timetable, null, 2));

        return message.reply(`✅ *${day.toUpperCase()}* timetable updated:\n${formatted.join('\n')}`);
    }


    if (text.startsWith('edit ')) {
        const parts = fullText.split(' ');
        const inputDay = parts[1]?.toLowerCase();
        const day = daysMap[inputDay];

        if (!day) {
            return message.reply("❌ Invalid day. Use `edit mon 10 AM English 11 AM Math`");
        }

        const entryText = parts.slice(2).join(' ');
        const regex = /(\d{1,2}\s*(?:AM|PM))\s+([A-Z]+)/gi;
        const matches = [...entryText.matchAll(regex)];

        if (matches.length === 0) {
            return message.reply("⚠️ Could not find valid entries. Format: `edit mon 10 AM MATH 11 AM LAB`");
        }

        let updated = false;
        const schedule = timetable[day] || [];

        matches.forEach(([_, timeRaw, subject]) => {
            const time = timeRaw.replace(/\s+/g, '').toUpperCase(); // normalize
            const index = schedule.findIndex(entry => {
                const [savedTime] = entry.split('-');
                return savedTime.toUpperCase() === time;
            });

            if (index !== -1) {
                schedule[index] = `${time}-${subject.toUpperCase()}`;
                updated = true;
            }
        });


        if (!updated) {
            return message.reply(`❌ None of the times matched existing entries in *${day.toUpperCase()}* timetable.`);
        }

        timetable[day] = schedule;
        fs.writeFileSync(timetableFile, JSON.stringify(timetable, null, 2));

        return message.reply(`✅ *${day.toUpperCase()}* timetable updated:\n${schedule.join('\n')}`);
    }
    if (text === 'clear' || text === 'Clear') {
    const chat = await message.getChat();
    if (!chat.isGroup) return message.reply('❌ Clear command only in groups.');

    const senderContact = await message.getContact();
    const isAdmin = chat.participants.find(p => p.id._serialized === senderContact.id._serialized)?.isAdmin;
    if (!isAdmin) return message.reply('⛔ Only admins can clear timetable.');

    deleteTimers[chat.id._serialized] = { confirmed: false, requestedBy: senderContact.id._serialized };
    return message.reply('⚠️ Are you sure you want to *delete the timetable*?\nType `confirm clear` to proceed.');
  }

  if (text === 'confirm clear') {
    const chat = await message.getChat();
    const senderContact = await message.getContact();
    const chatId = chat.id._serialized;
    const pending = deleteTimers[chatId];

    if (!pending || pending.requestedBy !== senderContact.id._serialized) {
      return message.reply('❌ No pending confirmation or not allowed.');
    }

    for (let day of days) timetable[day] = [];
    fs.writeFileSync(timetableFile, JSON.stringify(timetable, null, 2));
    delete deleteTimers[chatId];
    return message.reply('🗑️ *Timetable cleared* for all days.');
  }

    // ❓ Help
    if (text === 'help') {
        return message.reply(`🤖 *Notify.me Bot Commands*\n\n` +
            `💬 hi – Say hello\n` +
            `📆 Today – Show today's schedule\n` +
            `📅 Monday, Tuesday... – Show any day\n` +
            `📝 upload monday 9AM-Math, 10AM-Lab – Add a timetable\n` +
            `✏️ edit monday 10AM-English 1PM-Maths – Edit a timetable\n`+
            `🗑️ clear – Ask before deleting timetable\n`+
            `❓ help – Show this help` );
    }
});

client.initialize();
