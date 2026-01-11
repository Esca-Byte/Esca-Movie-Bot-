const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { prefix } = require('../config/config.json');

// Replace with your actual Gemini API key
const GEMINI_API_KEY = 'AIzaSyBWy07UlaxdvBDXjXT_zqikZpJye0Xrx6c';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

module.exports = {
    name: 'translate',
    aliases: ['tr'],
    description: 'Translate a replied message to a target language (default: English) using Gemini API.',
    usage: `${prefix}translate [target_language] (use as a reply)`,
    async execute(message, args) {
        // Must be used as a reply
        if (!message.reference || !message.reference.messageId) {
            return message.reply('Please reply to the message you want to translate.');
        }

        // Fetch the replied-to message
        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
        if (!repliedMessage) {
            return message.reply('Could not find the message to translate.');
        }

        const textToTranslate = repliedMessage.content;
        if (!textToTranslate) {
            return message.reply('The replied message has no text to translate.');
        }

        // Determine target language
        const targetLanguage = args[0] ? args[0] : 'English';
        const prompt = `Translate the following text to ${targetLanguage}. Reply with ONLY the translation, no explanations or additional text: ${textToTranslate}`;

        // Prepare Gemini API request
        const body = {
            contents: [
                {
                    parts: [
                        { text: prompt }
                    ]
                }
            ]
        };

        try {
            const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                return message.reply('Failed to contact the translation service.');
            }

            const data = await response.json();
            // Extract the generated translation
            const translation = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0].text;

            if (!translation) {
                return message.reply('Could not get a translation from the API.');
            }

            return message.reply(translation);
        } catch (error) {
            console.error('Translation error:', error);
            return message.reply('An error occurred while translating.');
        }
    },
};