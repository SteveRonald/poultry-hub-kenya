// Chatbase Configuration
// Environment Variables Required:
// VITE_CHATBASE_BOT_ID - Your Chatbase bot ID (get from Chatbase dashboard)
// Create a .env file and add: VITE_CHATBASE_BOT_ID=your_actual_bot_id

export const CHATBASE_CONFIG = {
  botId: import.meta.env.VITE_CHATBASE_BOT_ID || 'EL3ZYhqTESPxILIRbccq5',
  domain: 'www.chatbase.co',
  helpCenter: {
    enabled: true,
    containerId: 'chatbase-help-container',
    scriptId: 'chatbase-help-center',
    helpPageUrl: 'https://www.chatbase.co/EL3ZYhqTESPxILIRbccq5/help'
  },
  widget: {
    enabled: true,
    containerId: 'chatbase-widget-container',
    scriptId: 'EL3ZYhqTESPxILIRbccq5'
  }
};
