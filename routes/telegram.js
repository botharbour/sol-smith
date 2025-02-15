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
/help - Show this help message`;
       
        bot.sendMessage(chatId, helpMessage);
    });
};

module.exports = handleTelegramRoutes;