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

                    // Display list of wallets with numbers
                    let walletList = 'Your Wallets:\n\n';
                    userData.wallets.forEach((wallet, index) => {
                        const publicKey = wallet.publicKey.replace('.json', '');
                        walletList += `${index + 1}. <code>${publicKey}</code>\n`;
                    });
                    walletList += '\nEnter the number of the wallet to view its private key:';

                    bot.sendMessage(chatId, walletList, {
                        parse_mode: 'HTML'
                    });

                    // Set state to await wallet selection
                    userStates[chatId] = { awaitingWalletSelection: true };

                } catch (error) {
                    console.error('Error viewing wallets:', error);
                    bot.sendMessage(chatId, 'Error retrieving wallets. Please try again.');
                }
                break;
        }
    });

    // Handle regular messages for prefix input and wallet selection
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
                            parse_mode: 'HTML'
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
        } else if (userStates[chatId]?.awaitingWalletSelection && msg.text && !msg.text.startsWith('/')) {
            try {
                const selectedNumber = parseInt(msg.text.trim());
                const userData = getUserData(userId);

                if (!userData || !userData.wallets) {
                    bot.sendMessage(chatId, 'Error: No wallets found.');
                    delete userStates[chatId];
                    return;
                }

                if (isNaN(selectedNumber) || selectedNumber < 1 || selectedNumber > userData.wallets.length) {
                    bot.sendMessage(chatId, `Please enter a valid number between 1 and ${userData.wallets.length}.`);
                    return;
                }

                const selectedWallet = userData.wallets[selectedNumber - 1];
                const message = `Selected Wallet #${selectedNumber}\n\n`
                    + `Public Key:\n<code>${selectedWallet.publicKey.replace('.json', '')}</code>\n\n`
                    + `Private Key:\n<code>${selectedWallet.privateKey}</code>`;

                bot.sendMessage(chatId, message, {
                    parse_mode: 'HTML'
                });

                // Clear selection state
                delete userStates[chatId];

            } catch (error) {
                console.error('Error processing wallet selection:', error);
                bot.sendMessage(chatId, 'Error retrieving wallet information. Please try again.');
                delete userStates[chatId];
            }
        }
    });
};

module.exports = handleWalletRoutes;