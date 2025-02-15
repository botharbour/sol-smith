const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Initialize the bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {polling: true});

// Import routes
const handleTelegramRoutes = require('./routes/telegram');
const handleWalletRoutes = require('./routes/wallet');

// Create necessary directories
const fs = require('fs');
if (!fs.existsSync('./data')) {
    fs.mkdirSync('./data');
}
if (!fs.existsSync('./keypairs')) {
    fs.mkdirSync('./keypairs');
}

// Initialize routes
handleTelegramRoutes(bot);
handleWalletRoutes(bot);

// Error handling
bot.on('polling_error', (error) => {
    console.error('Bot polling error:', error);
});

console.log('Telegram bot is running...');