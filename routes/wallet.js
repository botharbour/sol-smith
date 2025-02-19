const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

// Import the shared message tracker
const MessageTracker = require('./messageTracker');

// Initialize data directories
const DATA_DIR = './data';
const USERS_DIR = path.join(DATA_DIR, 'users');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}
if (!fs.existsSync(USERS_DIR)) {
    fs.mkdirSync(USERS_DIR);
}

// Store user states
const userStates = {};

// Helper function to save user data
const saveUserData = (userId, userData) => {
    const userFilePath = path.join(USERS_DIR, `${userId}.json`);
    fs.writeFileSync(userFilePath, JSON.stringify(userData, null, 2));
};

// Helper function to get user data
const getUserData = (userId) => {
    const userFilePath = path.join(USERS_DIR, `${userId}.json`);
    try {
        if (fs.existsSync(userFilePath)) {
            return JSON.parse(fs.readFileSync(userFilePath, 'utf8'));
        }
    } catch (error) {
        console.error(`Error reading user data for ${userId}:`, error);
    }
    return null;
};

// Helper function to initialize user data
const initializeUserData = (msg) => {
    return {
        userId: msg.from.id,
        username: msg.from.username || 'no_username',
        firstName: msg.from.first_name || '',
        lastName: msg.from.last_name || '',
        languageCode: msg.from.language_code || 'en',
        createdAt: moment().utc().format('YYYY-MM-DD[T]HH:mm:ss[Z]'),
        lastInteraction: moment().utc().format('YYYY-MM-DD HH:mm:ss [UTC]'),
        wallets: []
    };
};

const handleWalletRoutes = (bot) => {
    // Helper function to show main menu
    const showMainMenu = async (chatId, messageText) => {
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
        
        return await MessageTracker.sendTrackedMessage(bot, chatId, messageText, options);
    };

    // Handle callback queries
    bot.on('callback_query', async (callbackQuery) => {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const userId = callbackQuery.from.id.toString();
        
        // Update user's last interaction
        let userData = getUserData(userId);
        if (userData) {
            userData.lastInteraction = moment().utc().format('YYYY-MM-DD HH:mm:ss [UTC]');
            saveUserData(userId, userData);
        }

        // Always answer callback query to stop loading indicator
        try {
            await bot.answerCallbackQuery(callbackQuery.id);
        } catch (error) {
            // Silent fail - this shouldn't block the flow
            console.log(`Failed to answer callback query: ${error.message}`);
        }
        
        // Track the current message if it's not already tracked
        if (MessageTracker.lastBotMessages[chatId] !== messageId) {
            MessageTracker.lastBotMessages[chatId] = messageId;
        }

        switch(callbackQuery.data) {
            case 'create_wallet':
                const options = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {text: 'Starts With', callback_data: 'prefix_starts_with'},
                                {text: 'Ends With', callback_data: 'prefix_ends_with'}
                            ],
                            [
                                {text: '⬅️ Back to Main Menu', callback_data: 'back_to_main'}
                            ]
                        ]
                    }
                };
                
                await MessageTracker.sendTrackedMessage(bot, chatId, 'Choose wallet address pattern:', options);
                break;

            case 'prefix_starts_with':
                userStates[chatId] = { 
                    awaitingPrefix: true, 
                    prefixType: 'starts_with'
                };
                
                const startOptions = {
                    reply_markup: {
                        inline_keyboard: [
                            [{text: '⬅️ Back', callback_data: 'create_wallet'}]
                        ]
                    }
                };
                
                await MessageTracker.sendTrackedMessage(
                    bot,
                    chatId, 
                    'Please enter your desired wallet prefix (what the address should START with):',
                    startOptions
                );
                break;

            case 'prefix_ends_with':
                userStates[chatId] = { 
                    awaitingPrefix: true, 
                    prefixType: 'ends_with'
                };
                
                const endOptions = {
                    reply_markup: {
                        inline_keyboard: [
                            [{text: '⬅️ Back', callback_data: 'create_wallet'}]
                        ]
                    }
                };
                
                await MessageTracker.sendTrackedMessage(
                    bot,
                    chatId, 
                    'Please enter your desired wallet suffix (what the address should END with):',
                    endOptions
                );
                break;
                
            case 'view_wallets':
                try {
                    const userData = getUserData(userId);
                    if (!userData || !userData.wallets.length) {
                        await MessageTracker.sendTrackedMessage(
                            bot,
                            chatId, 
                            'You have no wallets yet.', 
                            {
                                reply_markup: {
                                    inline_keyboard: [
                                        [{text: '⬅️ Back to Main Menu', callback_data: 'back_to_main'}]
                                    ]
                                }
                            }
                        );
                        return;
                    }

                    // Display list of wallets with numbers
                    let walletList = 'Your Wallets:\n\n';
                    userData.wallets.forEach((wallet, index) => {
                        const publicKey = wallet.publicKey.replace('.json', '');
                        walletList += `${index + 1}. <code>${publicKey}</code>\n`;
                    });
                    walletList += '\nEnter the number of the wallet to view its private key:';

                    await MessageTracker.sendTrackedMessage(
                        bot,
                        chatId, 
                        walletList, 
                        {
                            parse_mode: 'HTML',
                            reply_markup: {
                                inline_keyboard: [
                                    [{text: '⬅️ Back to Main Menu', callback_data: 'back_to_main'}]
                                ]
                            }
                        }
                    );

                    // Set state to await wallet selection
                    userStates[chatId] = { awaitingWalletSelection: true };

                } catch (error) {
                    console.error('Error viewing wallets:', error);
                    await MessageTracker.sendTrackedMessage(
                        bot,
                        chatId, 
                        'Error retrieving wallets. Please try again.',
                        {
                            reply_markup: {
                                inline_keyboard: [
                                    [{text: '⬅️ Back to Main Menu', callback_data: 'back_to_main'}]
                                ]
                            }
                        }
                    );
                }
                break;
                
            case 'back_to_main':
                // Show main menu
                const username = callbackQuery.from.first_name || 'User';
                await showMainMenu(
                    chatId, 
                    `Welcome ${username}! 👋\nUse the buttons below to manage your Solana wallets.`
                );
                
                // Clear any pending states
                delete userStates[chatId];
                break;
                
            case 'help':
                // Redirect to main menu since help is now a command
                await showMainMenu(
                    chatId, 
                    `Use /help command to view detailed instructions, or choose an option below:`
                );
                delete userStates[chatId];
                break;
        }
    });

    // Handle regular messages for prefix input and wallet selection
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id.toString();
        
        // Skip deletion for /start to preserve the intro message
        if (msg.text !== '/start') {
            // Always try to delete user's message for clean UI
            await MessageTracker.safeDeleteUserMessage(bot, msg);
        }
        
        // If it's a command, let it be handled by command handlers
        if (msg.text && (msg.text === '/start' || msg.text === '/help')) {
            return; // Let command handlers deal with it
        }
        
        if (userStates[chatId]?.awaitingPrefix && msg.text && !msg.text.startsWith('/')) {
            const prefix = msg.text.trim();
            const prefixType = userStates[chatId].prefixType;
            
            // Clean previous message first
            await MessageTracker.cleanPreviousMessage(bot, chatId);
            
            // Send and track processing message
            const processingMsg = await bot.sendMessage(chatId, 'Generating Solana wallet...');
            if (processingMsg) {
                MessageTracker.lastBotMessages[chatId] = processingMsg.message_id;
            }
            
            // Choose command based on prefix type
            const command = prefixType === 'starts_with' 
                ? `solana-keygen grind --starts-with ${prefix}:1` 
                : `solana-keygen grind --ends-with ${prefix}:1`;
            
            exec(command, async (error, stdout, stderr) => {
                try {
                    if (error) {
                        if (processingMsg) {
                            try {
                                await bot.editMessageText('Error generating wallet. Please try again.', {
                                    chat_id: chatId,
                                    message_id: processingMsg.message_id,
                                    reply_markup: {
                                        inline_keyboard: [
                                            [{text: '⬅️ Back to Main Menu', callback_data: 'back_to_main'}]
                                        ]
                                    }
                                });
                            } catch (editError) {
                                // If edit fails, send a new message
                                await MessageTracker.sendTrackedMessage(
                                    bot,
                                    chatId,
                                    'Error generating wallet. Please try again.',
                                    {
                                        reply_markup: {
                                            inline_keyboard: [
                                                [{text: '⬅️ Back to Main Menu', callback_data: 'back_to_main'}]
                                            ]
                                        }
                                    }
                                );
                            }
                        }
                        return;
                    }

                    // Find the generated key file
                    let keyFiles;
                    if (prefixType === 'starts_with') {
                        keyFiles = fs.readdirSync('.').filter(f => f.endsWith('.json') && f.startsWith(prefix));
                    } else {
                        // For ends_with, need to check all json files and filter by ending
                        const allJsonFiles = fs.readdirSync('.').filter(f => f.endsWith('.json'));
                        keyFiles = allJsonFiles.filter(f => {
                            const baseName = f.replace('.json', '');
                            return baseName.endsWith(prefix);
                        });
                    }
                    
                    if (keyFiles.length > 0) {
                        const keyFile = keyFiles[0];
                        const privateKey = fs.readFileSync(keyFile, 'utf8');
                        const publicKey = keyFile.replace('.json', '');
                        
                        // Get or initialize user data
                        let userData = getUserData(userId) || initializeUserData(msg);
                        userData.lastInteraction = moment().utc().format('YYYY-MM-DD HH:mm:ss [UTC]');

                        // Add new wallet
                        userData.wallets.push({
                            privateKey,
                            publicKey: keyFile,
                            createdAt: moment().utc().format('YYYY-MM-DD[T]HH:mm:ss[Z]'),
                            patternType: prefixType
                        });

                        // Save updated user data
                        saveUserData(userId, userData);

                        const message = `New Wallet Generated\n\n`
                            + `<code>${publicKey}</code>\n\n`
                            + `<code>${privateKey}</code>`;

                        try {
                            if (processingMsg) {
                                await bot.editMessageText(message, {
                                    chat_id: chatId,
                                    message_id: processingMsg.message_id,
                                    parse_mode: 'HTML',
                                    reply_markup: {
                                        inline_keyboard: [
                                            [{text: '⬅️ Back to Main Menu', callback_data: 'back_to_main'}]
                                        ]
                                    }
                                });
                            } else {
                                await MessageTracker.sendTrackedMessage(
                                    bot,
                                    chatId,
                                    message,
                                    {
                                        parse_mode: 'HTML',
                                        reply_markup: {
                                            inline_keyboard: [
                                                [{text: '⬅️ Back to Main Menu', callback_data: 'back_to_main'}]
                                            ]
                                        }
                                    }
                                );
                            }
                        } catch (messageError) {
                            // If edit fails, send a new message
                            await MessageTracker.sendTrackedMessage(
                                bot,
                                chatId,
                                message,
                                {
                                    parse_mode: 'HTML',
                                    reply_markup: {
                                        inline_keyboard: [
                                            [{text: '⬅️ Back to Main Menu', callback_data: 'back_to_main'}]
                                        ]
                                    }
                                }
                            );
                        }

                        try {
                            fs.unlinkSync(keyFile);
                        } catch (err) {
                            console.error('Error cleaning up keypair file:', err);
                        }
                    } else {
                        throw new Error('No key file generated');
                    }

                } catch (err) {
                    console.error('Error in wallet generation:', err);
                    if (processingMsg) {
                        try {
                            await bot.editMessageText('Error processing wallet. Please try again.', {
                                chat_id: chatId,
                                message_id: processingMsg.message_id,
                                reply_markup: {
                                    inline_keyboard: [
                                        [{text: '⬅️ Back to Main Menu', callback_data: 'back_to_main'}]
                                    ]
                                }
                            });
                        } catch (editError) {
                            // If edit fails, send a new message
                            await MessageTracker.sendTrackedMessage(
                                bot,
                                chatId,
                                'Error processing wallet. Please try again.',
                                {
                                    reply_markup: {
                                        inline_keyboard: [
                                            [{text: '⬅️ Back to Main Menu', callback_data: 'back_to_main'}]
                                        ]
                                    }
                                }
                            );
                        }
                    } else {
                        await MessageTracker.sendTrackedMessage(
                            bot,
                            chatId,
                            'Error processing wallet. Please try again.',
                            {
                                reply_markup: {
                                    inline_keyboard: [
                                        [{text: '⬅️ Back to Main Menu', callback_data: 'back_to_main'}]
                                    ]
                                }
                            }
                        );
                    }
                } finally {
                    delete userStates[chatId];
                }
            });
        } else if (userStates[chatId]?.awaitingWalletSelection && msg.text && !msg.text.startsWith('/')) {
            try {
                const selectedNumber = parseInt(msg.text.trim());
                const userData = getUserData(userId);

                if (!userData || !userData.wallets) {
                    await MessageTracker.sendTrackedMessage(
                        bot,
                        chatId, 
                        'Error: No wallets found.',
                        {
                            reply_markup: {
                                inline_keyboard: [
                                    [{text: '⬅️ Back to Main Menu', callback_data: 'back_to_main'}]
                                ]
                            }
                        }
                    );
                    delete userStates[chatId];
                    return;
                }

                if (isNaN(selectedNumber) || selectedNumber < 1 || selectedNumber > userData.wallets.length) {
                    await MessageTracker.sendTrackedMessage(
                        bot,
                        chatId, 
                        `Please enter a valid number between 1 and ${userData.wallets.length}.`,
                        {
                            reply_markup: {
                                inline_keyboard: [
                                    [{text: '⬅️ Back', callback_data: 'view_wallets'}],
                                    [{text: '⬅️ Back to Main Menu', callback_data: 'back_to_main'}]
                                ]
                            }
                        }
                    );
                    return;
                }

                const selectedWallet = userData.wallets[selectedNumber - 1];
                const message = `Selected Wallet #${selectedNumber}\n\n`
                    + `Public Key:\n<code>${selectedWallet.publicKey.replace('.json', '')}</code>\n\n`
                    + `Private Key:\n<code>${selectedWallet.privateKey}</code>\n\n`
                    + `Created: ${moment(selectedWallet.createdAt).format('YYYY-MM-DD HH:mm:ss')}`;

                await MessageTracker.sendTrackedMessage(
                    bot,
                    chatId, 
                    message, 
                    {
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                [{text: '⬅️ Back to Wallets', callback_data: 'view_wallets'}],
                                [{text: '⬅️ Back to Main Menu', callback_data: 'back_to_main'}]
                            ]
                        }
                    }
                );

                // Clear selection state
                delete userStates[chatId];
            } catch (error) {
                console.error('Error processing wallet selection:', error);
                await MessageTracker.sendTrackedMessage(
                    bot,
                    chatId, 
                    'Error retrieving wallet information. Please try again.',
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [{text: '⬅️ Back to Main Menu', callback_data: 'back_to_main'}]
                            ]
                        }
                    }
                );
                delete userStates[chatId];
            }
        } else if (!msg.text?.startsWith('/')) {
            // For any unexpected message, just show the main menu
            const username = msg.from.first_name || 'User';
            await showMainMenu(chatId, `Welcome ${username}! 👋\nUse the buttons below to manage your Solana wallets.`);
            
            // Clear any pending states
            delete userStates[chatId];
        }
    });
};

module.exports = handleWalletRoutes;