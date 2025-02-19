const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Create necessary directories
const fs = require('fs');
const path = require('path');

// Define all needed directories
const directories = [
    './data',
    './data/users',
    './keypairs'
];

// Create directories if they don't exist
directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
        try {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created directory: ${dir}`);
        } catch (error) {
            console.error(`Failed to create directory ${dir}: ${error.message}`);
        }
    }
});

// Initialize the bot with error handling
let bot;
try {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
        polling: true,
        // Add parse_mode default to HTML to support code formatting
        parse_mode: 'HTML',
        // Add polling options for better stability
        polling: {
            interval: 300,
            autoStart: true,
            params: {
                timeout: 10
            }
        }
    });
    console.log('Bot initialized successfully');
} catch (error) {
    console.error('Failed to initialize bot:', error);
    process.exit(1);
}

// Import routes
const handleTelegramRoutes = require('./routes/telegram');
const handleWalletRoutes = require('./routes/wallet');

// Initialize routes
try {
    handleTelegramRoutes(bot);
    handleWalletRoutes(bot);
    console.log('Routes initialized successfully');
} catch (error) {
    console.error('Failed to initialize routes:', error);
}

// Error handling
bot.on('polling_error', (error) => {
    // Ignore common network errors that self-resolve
    if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT' || error.code === 'ECONNRESET') {
        console.log(`Network error (will retry): ${error.code}`);
    } else {
        console.error('Bot polling error:', error);
    }
});

// Handle other errors gracefully
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Keep the process running unless it's a critical error
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        console.error('Critical connection error - restarting bot');
        process.exit(1); // Exit with error code so service manager can restart
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('Telegram bot is running...');