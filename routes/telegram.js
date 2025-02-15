const handleTelegramRoutes = (bot) => {
    // Start command
    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        const username = msg.from.first_name;
        
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [{text: 'Create Solana Wallet', callback_data: 'create_wallet'}],
                    [{text: 'View My Wallets', callback_data: 'view_wallets'}]
                ]
            }
        };
        
        bot.sendMessage(chatId, `Welcome ${username}! 👋\nUse the buttons below to manage your Solana wallets.`, options);
    });

    // Help command
    bot.onText(/\/help/, (msg) => {
        const chatId = msg.chat.id;
        const helpMessage = `
Available commands:
/start - Start the bot and show wallet options
/help - Show this help message
/time - Get current time
/wallet - Show wallet management options`;
        
        bot.sendMessage(chatId, helpMessage);
    });

    // Time command
    bot.onText(/\/time/, (msg) => {
        const chatId = msg.chat.id;
        const currentTime = new Date().toLocaleString();
        bot.sendMessage(chatId, `Current time: ${currentTime}`);
    });

    // Handle regular messages
    bot.on('message', (msg) => {
        const chatId = msg.chat.id;
        
        // Only respond to non-command messages that don't start with /
        if (msg.text && !msg.text.startsWith('/')) {
            bot.sendMessage(chatId, `You said: ${msg.text}`);
        }
    });
};

module.exports = handleTelegramRoutes;