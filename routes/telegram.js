// Import the shared message tracker
const MessageTracker = require('./messageTracker');

const handleTelegramRoutes = (bot) => {
    // Helper function to show main menu (without removing intro)
    const showMainMenu = async (chatId, username) => {
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [
                        {text: 'Create Solana Wallet', callback_data: 'create_wallet'},
                        {text: 'View My Wallets', callback_data: 'view_wallets'}
                    ]
                ]
            }
        };
        
        return await MessageTracker.sendTrackedMessage(
            bot,
            chatId, 
            `Welcome ${username}! 👋\nUse the buttons below to manage your Solana wallets.`, 
            options
        );
    };

    // Global command handler for /start
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        const username = msg.from.first_name || 'User';
        
        // Send branded introduction message (this will NOT be tracked/deleted)
        const solSmithIntro = `
🌟 *Welcome to SOL SMITH* 🌟
━━━━━━━━━━━━━━━━━━━━━━

Your premium Solana wallet generator with custom address patterns.

*Available Commands:*
• /start - Display this welcome message
• /help - Show detailed help information

*Features:*
• Create wallets with custom address patterns
• Store and manage multiple wallets securely
• View wallet details anytime

Created with ❤️ by SOL SMITH team
━━━━━━━━━━━━━━━━━━━━━━
`;
        
        try {
            await bot.sendMessage(chatId, solSmithIntro, {
                parse_mode: 'Markdown',
            });
        } catch (error) {
            console.error('Error sending intro message:', error);
        }
        
        // Show the main menu (after intro)
        await showMainMenu(chatId, username);
    });
    
    // Global command handler for /help
    bot.onText(/\/help/, async (msg) => {
        const chatId = msg.chat.id;
        
        // Delete the command message for clean UI
        await MessageTracker.safeDeleteUserMessage(bot, msg);
        
        const helpMessage = `
*SOL SMITH - Advanced Help*
━━━━━━━━━━━━━━━━━━━━━━

*Wallet Creation Options:*
• *Starts With* - Generate an address beginning with your chosen characters
• *Ends With* - Generate an address ending with your chosen characters

*Tips for Pattern Selection:*
• Shorter patterns (2-3 chars) generate quickly
• Longer patterns may take significant time
• Case-sensitive (upper/lowercase matters)
• Only use valid Solana address characters

*Security Notes:*
• Your private keys are stored securely
• Never share your private keys
• Back up your wallet information

Need more help? Contact: @SolSmithSupport
━━━━━━━━━━━━━━━━━━━━━━
`;
        
        await MessageTracker.sendTrackedMessage(
            bot,
            chatId, 
            helpMessage,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{text: '⬅️ Back to Main Menu', callback_data: 'back_to_main'}]
                    ]
                }
            }
        );
    });
};

module.exports = handleTelegramRoutes;