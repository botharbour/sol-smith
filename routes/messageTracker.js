// Shared message tracking system - will be exported and imported in both files
const MessageTracker = {
    // Track the last bot message for each chat
    lastBotMessages: {},
    
    // Check if message exists before attempting to delete it
    cleanPreviousMessage: async (bot, chatId) => {
      try {
        if (MessageTracker.lastBotMessages[chatId]) {
          try {
            await bot.deleteMessage(chatId, MessageTracker.lastBotMessages[chatId]);
          } catch (error) {
            // Silently handle "message to delete not found" errors
            if (error.response?.body?.description !== 'Bad Request: message to delete not found') {
              console.log(`Delete error (non-critical): ${error.message}`);
            }
          }
          delete MessageTracker.lastBotMessages[chatId];
        }
      } catch (error) {
        // Fail silently - this is a helper function that shouldn't break the flow
      }
    },
    
    // Send and track a new message, cleaning up the previous one first
    sendTrackedMessage: async (bot, chatId, text, options = {}) => {
      // Clean previous message first (without throwing errors)
      await MessageTracker.cleanPreviousMessage(bot, chatId);
      
      try {
        // Send new message and track its ID
        const sentMessage = await bot.sendMessage(chatId, text, options);
        MessageTracker.lastBotMessages[chatId] = sentMessage.message_id;
        return sentMessage;
      } catch (error) {
        console.error(`Error sending message: ${error.message}`);
        // Return null if sending failed - calling code should handle this
        return null;
      }
    },
    
    // Helper to safely delete user messages
    safeDeleteUserMessage: async (bot, msg) => {
      if (!msg || !msg.message_id) return;
      
      try {
        await bot.deleteMessage(msg.chat.id, msg.message_id);
      } catch (error) {
        // Silently handle "message to delete not found" errors
        if (error.response?.body?.description !== 'Bad Request: message to delete not found') {
          console.log(`User message delete error (non-critical): ${error.message}`);
        }
      }
    }
  };
  
  module.exports = MessageTracker;