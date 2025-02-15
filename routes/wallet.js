const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

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
        createdAt: new Date().toISOString(),
        lastInteraction: new Date().toISOString(),
        wallets: []
    };
};

const handleWalletRoutes = (bot) => {
    // Wallet command
    bot.onText(/\/wallet/, (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id.toString();
        
        // Initialize or update user data
        let userData = getUserData(userId) || initializeUserData(msg);
        userData.lastInteraction = new Date().toISOString();
        saveUserData(userId, userData);

        const options = {
            reply_markup: {
                inline_keyboard: [
                    [{text: 'Create Solana Wallet', callback_data: 'create_wallet'}],
                    [{text: 'View My Wallets', callback_data: 'view_wallets'}]
                ]
            }
        };
        
        bot.sendMessage(chatId, 'Wallet Management Options:', options);
    });

    // Handle callback queries
    bot.on('callback_query', async (callbackQuery) => {
        const chatId = callbackQuery.message.chat.id;
        const userId = callbackQuery.from.id.toString();
        
        // Update user's last interaction
        let userData = getUserData(userId);
        if (userData) {
            userData.lastInteraction = new Date().toISOString();
            saveUserData(userId, userData);
        }

        switch(callbackQuery.data) {
            case 'create_wallet':
                userStates[chatId] = { awaitingPrefix: true };
                bot.sendMessage(chatId, 'Please enter your desired wallet prefix:');
                break;

            case 'view_wallets':
                try {
                    const userData = getUserData(userId);
                    if (!userData || !userData.wallets.length) {
                        bot.sendMessage(chatId, 'You have no wallets yet. Click "Create Solana Wallet" to generate one.');
                        return;
                    }

                    userData.wallets.forEach((wallet, index) => {
                        const publicKey = wallet.publicKey.replace('.json', '');
                        const message = `Wallet #${index + 1}\n\n`
                            + `<code>${publicKey}</code>\n\n`
                            + `<code>${wallet.privateKey}</code>`;

                        bot.sendMessage(chatId, message, {
                            parse_mode: 'HTML',
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        {text: 'Copy Public Key', callback_data: `copy_pub_${index}`},
                                        {text: 'Copy Private Key', callback_data: `copy_priv_${index}`}
                                    ]
                                ]
                            }
                        });
                    });
                } catch (error) {
                    console.error('Error viewing wallets:', error);
                    bot.sendMessage(chatId, 'Error retrieving wallets. Please try again.');
                }
                break;

            case callbackQuery.data.match(/^copy_pub_\d+/)?.[0]:
                try {
                    const index = parseInt(callbackQuery.data.split('_')[2]);
                    const userData = getUserData(userId);
                    if (userData && userData.wallets[index]) {
                        await bot.answerCallbackQuery(callbackQuery.id, {
                            text: 'Public key copied!',
                            show_alert: true
                        });
                    }
                } catch (error) {
                    console.error('Error copying public key:', error);
                    await bot.answerCallbackQuery(callbackQuery.id, {
                        text: 'Error copying key',
                        show_alert: true
                    });
                }
                break;

            case callbackQuery.data.match(/^copy_priv_\d+/)?.[0]:
                try {
                    const index = parseInt(callbackQuery.data.split('_')[2]);
                    const userData = getUserData(userId);
                    if (userData && userData.wallets[index]) {
                        await bot.answerCallbackQuery(callbackQuery.id, {
                            text: 'Private key copied!',
                            show_alert: true
                        });
                    }
                } catch (error) {
                    console.error('Error copying private key:', error);
                    await bot.answerCallbackQuery(callbackQuery.id, {
                        text: 'Error copying key',
                        show_alert: true
                    });
                }
                break;
        }
    });

    // Handle regular messages for prefix input
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id.toString();
        
        if (userStates[chatId]?.awaitingPrefix && msg.text && !msg.text.startsWith('/')) {
            const prefix = msg.text.trim();
            
            const processingMsg = await bot.sendMessage(chatId, 'Generating Solana wallet...');
            
            exec(`solana-keygen grind --starts-with ${prefix}:1`, async (error, stdout, stderr) => {
                try {
                    if (error) {
                        await bot.editMessageText('Error generating wallet. Please try again.', {
                            chat_id: chatId,
                            message_id: processingMsg.message_id
                        });
                        return;
                    }

                    const keyFiles = fs.readdirSync('.').filter(f => f.endsWith('.json') && f.startsWith(prefix));
                    
                    if (keyFiles.length > 0) {
                        const keyFile = keyFiles[0];
                        const privateKey = fs.readFileSync(keyFile, 'utf8');
                        const publicKey = keyFile.replace('.json', '');
                        
                        // Get or initialize user data
                        let userData = getUserData(userId) || initializeUserData(msg);
                        userData.lastInteraction = new Date().toISOString();

                        // Add new wallet
                        userData.wallets.push({
                            privateKey,
                            publicKey: keyFile,
                            createdAt: new Date().toISOString()
                        });

                        // Save updated user data
                        saveUserData(userId, userData);

                        const message = `New Wallet Generated\n\n`
                            + `<code>${publicKey}</code>\n\n`
                            + `<code>${privateKey}</code>`;

                        await bot.editMessageText(message, {
                            chat_id: chatId,
                            message_id: processingMsg.message_id,
                            parse_mode: 'HTML',
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        {text: 'Copy Public Key', callback_data: `copy_pub_${userData.wallets.length - 1}`},
                                        {text: 'Copy Private Key', callback_data: `copy_priv_${userData.wallets.length - 1}`}
                                    ]
                                ]
                            }
                        });

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
                    await bot.editMessageText('Error processing wallet. Please try again.', {
                        chat_id: chatId,
                        message_id: processingMsg.message_id
                    });
                } finally {
                    delete userStates[chatId];
                }
            });
        }
    });
};

module.exports = handleWalletRoutes;