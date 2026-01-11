const { SlashCommandBuilder, PermissionsBitField, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const dbManager = require('../utils/dbManager');
const config = require('../config/config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('updatemovie')
        .setDescription('Updates details for an existing movie/webseries. (Admin Only)')
        .addStringOption(option =>
            option.setName('search_name')
                .setDescription('The current name of the movie/webseries to find.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('set_watch_links')
                .setDescription('Comma-separated links with quality (e.g., "720p:link,1080p:link").')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('languages')
                .setDescription('Update languages (comma-separated): hindi,english,tamil,telugu')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('add_languages')
                .setDescription('Add languages (comma-separated): hindi,english,tamil,telugu')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('remove_languages')
                .setDescription('Remove languages (comma-separated): hindi,english,tamil,telugu')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('poster_url')
                .setDescription('Update the custom poster URL.')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('add_screenshotlinks')
                .setDescription('Comma-separated screenshot links to add.')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('remove_screenshotlinks')
                .setDescription('Comma-separated screenshot links to remove.')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('new_name')
                .setDescription('The new name for the movie/webseries.')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('add_aliases')
                .setDescription('Comma-separated aliases to add.')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('remove_aliases')
                .setDescription('Comma-separated aliases to remove.')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    async execute(interaction) {
        if (!config.adminUserIds.includes(interaction.user.id)) {
            return interaction.reply({
                content: null,
                embeds: null,
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0xFF4444)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent('You do not have permission to use this command.')
                        )
                ],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }
        await interaction.deferReply({ ephemeral: true });
        const searchName = interaction.options.getString('search_name');
        const setWatchLinks = interaction.options.getString('set_watch_links');
        const rawLanguages = interaction.options.getString('languages');
        const rawAddLanguages = interaction.options.getString('add_languages');
        const rawRemoveLanguages = interaction.options.getString('remove_languages');
        const posterUrl = interaction.options.getString('poster_url');
        const addScreenshotLinks = interaction.options.getString('add_screenshotlinks')?.split(',').map(link => link.trim()).filter(link => link !== '') || [];
        const removeScreenshotLinks = interaction.options.getString('remove_screenshotlinks')?.split(',').map(link => link.trim()).filter(link => link !== '') || [];
        const newName = interaction.options.getString('new_name');
        const addAliases = interaction.options.getString('add_aliases')?.split(',').map(alias => alias.trim().toLowerCase()).filter(alias => alias !== '') || [];
        const removeAliases = interaction.options.getString('remove_aliases')?.split(',').map(alias => alias.trim().toLowerCase()).filter(alias => alias !== '') || [];
        
        // Use only dbManager to get the movie
        const movieToUpdate = dbManager.getMovie(searchName.toLowerCase());
        
        if (!movieToUpdate) {
            return interaction.editReply({
                content: null,
                embeds: null,
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0xFFAA00)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`❌ No movie found with the name "**${searchName}**". Please use the exact name or an existing alias.`)
                        )
                ],
                flags: MessageFlags.IsComponentsV2
            });
        }
        
        const updatedFields = {};
        const availableLanguages = ['hindi', 'english', 'tamil', 'telugu'];
        const validateLanguages = (languages, operation) => {
            const invalidLanguages = languages.filter(lang => !availableLanguages.includes(lang));
            if (invalidLanguages.length > 0) {
                throw new Error(`Invalid language(s) for ${operation}: ${invalidLanguages.join(', ')}. Available languages are: ${availableLanguages.join(', ')}`);
            }
        };
        // Update languages (replaces all existing languages)
        if (rawLanguages) {
            const languages = rawLanguages.split(',')
                .map(lang => lang.trim().toLowerCase())
                .filter(lang => lang !== '');
            try {
                validateLanguages(languages, 'languages update');
                if (languages.length === 0) {
                    return interaction.editReply({
                        content: null,
                        embeds: null,
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0xFFAA00)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent('You must provide at least one valid language.')
                                )
                        ],
                        flags: MessageFlags.IsComponentsV2
                    });
                }
                updatedFields.languages = [...new Set(languages)];
            } catch (error) {
                return interaction.editReply({
                    content: null,
                    embeds: null,
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0xFFAA00)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(error.message)
                            )
                    ],
                    flags: MessageFlags.IsComponentsV2
                });
            }
        }
        // Add/Remove languages
        if (rawAddLanguages || rawRemoveLanguages) {
            let currentLanguages = [];
            if (movieToUpdate.languages && Array.isArray(movieToUpdate.languages)) {
                currentLanguages = [...movieToUpdate.languages];
            } else if (movieToUpdate.language) {
                currentLanguages = [movieToUpdate.language];
            }
            if (rawAddLanguages) {
                const addLanguages = rawAddLanguages.split(',')
                    .map(lang => lang.trim().toLowerCase())
                    .filter(lang => lang !== '');
                try {
                    validateLanguages(addLanguages, 'add languages');
                    currentLanguages = [...new Set([...currentLanguages, ...addLanguages])];
                } catch (error) {
                    return interaction.editReply({
                        content: null,
                        embeds: null,
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0xFFAA00)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(error.message)
                                )
                        ],
                        flags: MessageFlags.IsComponentsV2
                    });
                }
            }
            if (rawRemoveLanguages) {
                const removeLanguages = rawRemoveLanguages.split(',')
                    .map(lang => lang.trim().toLowerCase())
                    .filter(lang => lang !== '');
                try {
                    validateLanguages(removeLanguages, 'remove languages');
                    currentLanguages = currentLanguages.filter(lang => !removeLanguages.includes(lang));
                } catch (error) {
                    return interaction.editReply({
                        content: null,
                        embeds: null,
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0xFFAA00)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(error.message)
                                )
                        ],
                        flags: MessageFlags.IsComponentsV2
                    });
                }
            }
            if (currentLanguages.length === 0) {
                return interaction.editReply({
                    content: null,
                    embeds: null,
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0xFFAA00)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent('Cannot remove all languages. A movie must have at least one language.')
                            )
                    ],
                    flags: MessageFlags.IsComponentsV2
                });
            }
            updatedFields.languages = currentLanguages;
        }
        // Update custom poster URL
        if (posterUrl !== null) {
            if (posterUrl === '') {
                updatedFields.customPosterUrl = null;
            } else {
                try {
                    new URL(posterUrl);
                    updatedFields.customPosterUrl = posterUrl;
                } catch (error) {
                    return interaction.editReply({
                        content: null,
                        embeds: null,
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0xFFAA00)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(`The provided poster URL is not valid:Update aborted.`)
                                )
                        ],
                        flags: MessageFlags.IsComponentsV2
                    });
                }
            }
        }
        // Update watch links (This will OVERWRITE existing watchLinks)
        if (setWatchLinks !== null) {
            const newParsedWatchLinks = {};
            const linkParts = setWatchLinks.split(',').filter(part => part.trim() !== '');
            if (linkParts.length === 0) {
                return interaction.editReply({
                    content: null,
                    embeds: null,
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0xFFAA00)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent('You must provide at least one watch link in the format "quality:link". Update aborted.')
                            )
                    ],
                    flags: MessageFlags.IsComponentsV2
                });
            }
            for (const part of linkParts) {
                const split = part.split(':');
                if (split.length < 2) {
                    return interaction.editReply({
                        content: null,
                        embeds: null,
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0xFFAA00)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(`Invalid watch link format: "${part}". Each link must be in the format "quality:link" (e.g., "720p:https://example.com/movie"). Update aborted.`)
                                )
                        ],
                        flags: MessageFlags.IsComponentsV2
                    });
                }
                const quality = split[0].trim();
                const link = split.slice(1).join(':').trim();
                if (!quality) {
                    return interaction.editReply({
                        content: null,
                        embeds: null,
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0xFFAA00)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(`Missing quality for link: "${part}". Each link must be in the format "quality:link". Update aborted.`)
                                )
                        ],
                        flags: MessageFlags.IsComponentsV2
                    });
                }
                if (!link) {
                    return interaction.editReply({
                        content: null,
                        embeds: null,
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0xFFAA00)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(`Missing URL for quality "${quality}". Each link must be in the format "quality:link". Update aborted.`)
                                )
                        ],
                        flags: MessageFlags.IsComponentsV2
                    });
                }
                try {
                    let validatedLink = link;
                    if (!validatedLink.startsWith('http://') && !validatedLink.startsWith('https://')) {
                        validatedLink = `https://${validatedLink}`;
                    }
                    new URL(validatedLink);
                    newParsedWatchLinks[quality] = validatedLink;
                } catch (error) {
                    return interaction.editReply({
                        content: null,
                        embeds: null,
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0xFFAA00)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(`The watch link for "${quality}" is not a valid URL: Error: ${error.message}. Please ensure it includes http:// or https:// and is a full URL. Update aborted.`)
                                )
                        ],
                        flags: MessageFlags.IsComponentsV2
                    });
                }
            }
            updatedFields.watchLinks = newParsedWatchLinks;
        }
        // Update screenshot links
        if (addScreenshotLinks.length > 0 || removeScreenshotLinks.length > 0) {
            let currentScreenshotLinks = movieToUpdate.screenshotLinks || [];
            currentScreenshotLinks = [...new Set([...currentScreenshotLinks, ...addScreenshotLinks])];
            currentScreenshotLinks = currentScreenshotLinks.filter(link => !removeScreenshotLinks.includes(link));
            for (const link of addScreenshotLinks) {
                try {
                    new URL(link);
                } catch (error) {
                    return interaction.editReply({
                        content: null,
                        embeds: null,
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0xFFAA00)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(`One of the provided screenshot links to add is not a valid URL:Update aborted.`)
                                )
                        ],
                        flags: MessageFlags.IsComponentsV2
                    });
                }
            }
            updatedFields.screenshotLinks = currentScreenshotLinks;
        }
        // Update movie name
        if (newName && newName.toLowerCase() !== movieToUpdate.name.toLowerCase()) {
            const existingWithName = dbManager.getMovie(newName);
            if (existingWithName && existingWithName.id !== movieToUpdate.id) {
                return interaction.editReply({
                    content: null,
                    embeds: null,
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0xFFAA00)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`A different movie with the name "${newName}" already exists. Cannot change name to a duplicate.`)
                            )
                    ],
                    flags: MessageFlags.IsComponentsV2
                });
            }
            updatedFields.name = newName;
        }
        // Update aliases
        if (addAliases.length > 0 || removeAliases.length > 0) {
            let currentAliases = movieToUpdate.aliases || [];
            currentAliases = [...new Set([...currentAliases, ...addAliases])];
            currentAliases = currentAliases.filter(alias => !removeAliases.includes(alias));
            updatedFields.aliases = currentAliases;
        }
        if (Object.keys(updatedFields).length === 0) {
            return interaction.editReply({
                content: null,
                embeds: null,
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0xFFAA00)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent('No valid fields provided for update or no changes detected.')
                        )
                ],
                flags: MessageFlags.IsComponentsV2
            });
        }
        try {
            const updated = dbManager.updateMovie(movieToUpdate.id, updatedFields);
            if (updated) {
                let updateMessage = `\`✅\` Successfully updated "**${movieToUpdate.name}**" in the database.`;
                const updateDetails = [];
                if (updatedFields.languages) {
                    const langDisplay = updatedFields.languages.map(lang => 
                        lang.charAt(0).toUpperCase() + lang.slice(1)
                    ).join(', ');
                    updateDetails.push(`Languages: ${langDisplay}`);
                }
                if (updatedFields.customPosterUrl !== undefined) {
                    updateDetails.push(updatedFields.customPosterUrl ? 'Custom poster updated' : 'Custom poster removed');
                }
                if (updatedFields.watchLinks) {
                    updateDetails.push(`Watch links updated (${Object.keys(updatedFields.watchLinks).length} qualities)`);
                }
                if (updatedFields.name) {
                    updateDetails.push(`Name changed to: ${updatedFields.name}`);
                }
                if (updateDetails.length > 0) {
                    updateMessage += `\n\n**Updated:** ${updateDetails.join(', ')}`;
                }
                await interaction.editReply({
                    content: null,
                    embeds: null,
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x00FF00)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(updateMessage)
                            )
                    ],
                    flags: MessageFlags.IsComponentsV2
                });
            } else {
                await interaction.editReply({
                    content: null,
                    embeds: null,
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0xFF4444)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent('❌ Failed to update the movie. It might not exist or no changes were made.')
                            )
                    ],
                    flags: MessageFlags.IsComponentsV2
                });
            }
        } catch (error) {
            await interaction.editReply({
                content: null,
                embeds: null,
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0xFF4444)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent('❌ An unexpected error occurred while trying to update the movie.')
                        )
                ],
                flags: MessageFlags.IsComponentsV2
            });
        }
    },
};