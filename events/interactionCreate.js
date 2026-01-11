const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const dbManager = require('../utils/dbManager');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/config.json');
const embedGenerator = require('../utils/embedGenerator');
const statisticsManager = require('../utils/statisticsManager');

const adminCheck = require('../utils/adminCheck');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                await command.execute(interaction);
                
                // Track command usage for statistics AFTER successful execution
                try {
                    statisticsManager.incrementCommandUsage(interaction.commandName, interaction.user.id);
                } catch (statsError) {
                    console.error(`Failed to track command usage for /${interaction.commandName}:`, statsError);
                    // Don't let statistics errors affect the command execution
                }
            } catch (error) {
                console.error(`Error executing command /${interaction.commandName}:`, error);

                // Check if the interaction was already successfully completed
                const hasReplied = interaction.replied || interaction.deferred;
                const errorMessage = '❌ There was an error while executing this command! Please try again or contact an administrator.';

                // Only try to send error message if the interaction hasn't been completed
                if (!hasReplied) {
                    try {
                        await interaction.reply({ content: errorMessage, ephemeral: true });
                    } catch (responseError) {
                        console.error(`Failed to send error message for command /${interaction.commandName}:`, responseError);
                        console.error(`Original command error:`, error);
                    }
                } else {
                    // If interaction was already completed, just log the error
                    console.error(`Command /${interaction.commandName} had an error but interaction was already completed:`, error);
                }
            }
            return;
        }

        // Handle button interactions
        if (!interaction.isButton()) return;

        const { customId } = interaction;
        
        // Handle setup guide button
        if (customId === 'setup_guide') {
            const setupEmbed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('📖 Stream Sage Setup Guide')
                .setDescription('Follow these steps to set up your Stream Sage:')
                .addFields(
                    {
                        name: '1️⃣ Create a Channel',
                        value: 'Create a text channel where you want movie updates to be posted (e.g., #movies, #movie-updates)',
                        inline: false
                    },
                    {
                        name: '2️⃣ Set Bot Permissions',
                        value: 'Make sure the bot has these permissions in the channel:\n• Send Messages\n• Embed Links (recommended)\n• Attach Files (recommended)',
                        inline: false
                    },
                    {
                        name: '3️⃣ Configure the Channel',
                        value: 'Use the command: `/setmoviechannel #your-channel-name`',
                        inline: false
                    },
                    {
                        name: '4️⃣ Test the Setup',
                        value: 'Use `/help` to see all available commands and test the bot',
                        inline: false
                    }
                )
                .setFooter({ text: 'Need more help? Contact the bot developer!' })
                .setTimestamp();

            await interaction.reply({
                embeds: [setupEmbed],
                ephemeral: true
            });
            return;
        }

        // Handle download button interactions
        if (customId.startsWith('download_')) {
            await handleDownloadButton(interaction);
            return;
        }

        // Handle support server button
        if (customId === 'support_server') {
            const supportEmbed = new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle('🆘 Support Information')
                .setDescription('If you need help with the Stream Sage:')
                .addFields(
                    {
                        name: '📧 Contact Developer',
                        value: 'Send a DM to the bot developer or join our support server',
                        inline: false
                    },
                    {
                        name: '📚 Common Issues',
                        value: '• Bot not sending messages? Check channel permissions\n• Channel not found? Reconfigure with `/setmoviechannel`\n• Commands not working? Check bot permissions',
                        inline: false
                    }
                )
                .setFooter({ text: 'We\'re here to help!' })
                .setTimestamp();

            await interaction.reply({
                embeds: [supportEmbed],
                ephemeral: true
            });
            return;
        }

        // Handle reject request button
        if (customId.startsWith('reject_')) {
            // Check if user is admin
            if (!adminCheck.isAdminUser(interaction.user.id)) {
                return interaction.reply({
                    content: '❌ You do not have permission to reject requests!',
                    ephemeral: true
                });
            }

            const requestId = customId.split('_')[1];
            
            // Get the request
            const requests = dbManager.getRequests();
            const request = requests.find(req => req.id === requestId);
            
            if (!request) {
                return interaction.reply({
                    content: '❌ Request not found or already processed!',
                    ephemeral: true
                });
            }

            if (request.status !== 'pending') {
                return interaction.reply({
                    content: '❌ This request has already been processed!',
                    ephemeral: true
                });
            }

            try {
                // Remove the request from the database
                const removed = dbManager.removeRequest(requestId);
                
                if (!removed) {
                    return interaction.reply({
                        content: '❌ Failed to remove the request from database!',
                        ephemeral: true
                    });
                }

                const rejectedEmbed = new EmbedBuilder()
                    .setColor(0xFF4444)
                    .setTitle('❌ Request Rejected')
                    .setDescription(`Request for **"${request.movieName}"** has been rejected by <@${interaction.user.id}>`)
                    .addFields(
                        { name: 'Requested By', value: `<@${request.requestedBy}>`, inline: true },
                        { name: 'Rejected By', value: `<@${interaction.user.id}>`, inline: true },
                        { name: 'Rejected At', value: new Date().toLocaleString(), inline: true }
                    )
                    .setTimestamp();

                // Update the original message
                const newActionRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('rejected')
                            .setLabel('❌ Request Rejected')
                            .setStyle(ButtonStyle.Danger)
                            .setDisabled(true)
                    );

                await interaction.update({ 
                    embeds: [rejectedEmbed], 
                    components: [newActionRow] 
                });

                // Notify the requester
                try {
                    const requester = await interaction.client.users.fetch(request.requestedBy);
                    const notificationEmbed = new EmbedBuilder()
                        .setColor(0xFF4444)
                        .setTitle('❌ Movie Request Rejected')
                        .setDescription(`Your request for **"${request.movieName}"** has been rejected.`)
                        .addFields(
                            { name: 'Rejected By', value: `<@${interaction.user.id}>`, inline: true },
                            { name: 'Rejected At', value: new Date().toLocaleString(), inline: true }
                        )
                        .setFooter({ text: 'You can request another movie anytime!' })
                        .setTimestamp();

                    await requester.send({ embeds: [notificationEmbed] });
                } catch (dmError) {
                    console.log(`Could not send DM to user ${request.requestedBy}:`, dmError.message);
                    // Continue execution even if DM fails
                }

            } catch (error) {
                console.error('Error processing request rejection:', error);
                await interaction.reply({
                    content: '❌ There was an error processing the request rejection!',
                    ephemeral: true
                });
            }
            return;
        }

        if (customId.startsWith('request_movie:')) {
            const movieName = customId.slice('request_movie:'.length).trim();

            if (!movieName) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor(0xFF4444).setTitle('❌ Error').setDescription('Could not determine the movie name from the button.')],
                    ephemeral: true
                });
            }

            // Check if movie already exists
            const existingMovie = dbManager.getMovie(movieName.toLowerCase()) || 
                                dbManager.searchMovies(movieName.toLowerCase())[0];
            
            if (existingMovie) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor(0xFFAA00).setTitle('Movie Already Exists').setDescription(`"${movieName}" is already in the database! Use \`/getmovie ${movieName}\` to find it.`)],
                    ephemeral: true
                });
            }

            // Check for existing pending request
            const existingRequest = dbManager.getRequests().find(req =>
                req.movieName.toLowerCase() === movieName.toLowerCase() && req.status === 'pending'
            );

            if (existingRequest) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor(0xFFAA00).setTitle('Duplicate Request').setDescription(`A request for "**${movieName}**" has already been submitted and is pending.`)],
                    ephemeral: true
                });
            }

            try {
                // Create new request (using same structure as requestmovie)
                const newRequest = {
                    id: uuidv4(),
                    movieName: movieName,
                    requestedBy: interaction.user.id,
                    requestedAt: new Date().toISOString(),
                    guildId: interaction.guild?.id || 'DM',
                    guildName: interaction.guild?.name || 'Direct Message',
                    status: 'pending'
                };

                // Add to database
                dbManager.addRequest(newRequest);
                statisticsManager.trackMovieRequest(movieName, interaction.user.id);

                await interaction.reply({
                    embeds: [new EmbedBuilder().setColor(0x00FF00).setTitle('✅ Request Submitted').setDescription(`Your request for "**${movieName}**" has been sent to the administrators!`)],
                    ephemeral: true
                });

                // --- Send to Global Request Channel ---
                const globalRequestChannelId = config.globalRequestChannelId;
                if (!globalRequestChannelId) {
                    const warningEmbed = new EmbedBuilder()
                        .setColor(0xFFAA00)
                        .setTitle('⚠️ Warning')
                        .setDescription('No global request channel is configured. Your request has been saved but administrators might not be notified.');
                    
                    await interaction.followUp({ embeds: [warningEmbed], ephemeral: true });
                    return;
                }
                
                try {
                    const globalRequestChannel = await interaction.client.channels.fetch(globalRequestChannelId);
                    if (globalRequestChannel && globalRequestChannel.isTextBased()) {
                        const requestEmbed = new EmbedBuilder()
                            .setColor(0x1E90FF)
                            .setTitle('🔔 New Movie Request')
                            .setDescription(`**Requested Movie:** ${newRequest.movieName}`)
                            .addFields(
                                { name: 'Requested By', value: `<@${newRequest.requestedBy}>`, inline: true },
                                { name: 'Server', value: newRequest.guildName, inline: true },
                                { name: 'Requested At', value: new Date(newRequest.requestedAt).toLocaleString(), inline: true }
                            )
                            .setFooter({ text: `Request ID: ${newRequest.id} | Requested via button click` })
                            .setTimestamp();
                        
                        // Create reject button for admins
                        const actionRow = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`reject_${newRequest.id}`)
                                    .setLabel('❌ Reject Request')
                                    .setStyle(ButtonStyle.Danger)
                            );
                        
                        await globalRequestChannel.send({ embeds: [requestEmbed], components: [actionRow] });
                    } else {
                        const warningEmbed = new EmbedBuilder()
                            .setColor(0xFFAA00)
                            .setTitle('⚠️ Warning')
                            .setDescription(`The configured global request channel (${globalRequestChannelId}) is invalid or inaccessible. Your request has been saved but administrators might not be notified.`);
                        
                        await interaction.followUp({ embeds: [warningEmbed], ephemeral: true });
                    }
                } catch (channelError) {
                    const warningEmbed = new EmbedBuilder()
                        .setColor(0xFFAA00)
                        .setTitle('⚠️ Warning')
                        .setDescription('An error occurred while sending the request to the global channel. Your request has been saved but administrators might not be notified.');
                    
                    await interaction.followUp({ embeds: [warningEmbed], ephemeral: true });
                }
                // --- End Send to Global Request Channel ---

            } catch (error) {
                console.error("Error submitting request:", error);
                await interaction.reply({
                    embeds: [new EmbedBuilder().setColor(0xFF4444).setTitle('❌ Error').setDescription('There was an error submitting your request. Please try again later.')],
                    ephemeral: true
                });
            }
        }
    }
};

// Helper function to handle download button interactions (FALLBACK for old messages)
// New download buttons use URL style and open links directly
async function handleDownloadButton(interaction) {
    try {
        // Parse the button ID: download_{movieId}_{quality}
        const buttonParts = interaction.customId.split('_');
        if (buttonParts.length < 3) {
            return interaction.reply({
                content: '❌ Invalid download button format.',
                ephemeral: true
            });
        }
        
        const movieId = buttonParts[1];
        const quality = buttonParts.slice(2).join('_').replace(/_/g, ' ');
        
        // Get the movie from database
        const movie = dbManager.getMovie(movieId);
        if (!movie) {
            return interaction.reply({
                content: '❌ Movie not found in database.',
                ephemeral: true
            });
        }
        
        // Find the watch link for this quality
        const watchLink = movie.watchLinks[quality] || movie.watchLinks[Object.keys(movie.watchLinks).find(q => 
            q.replace(/[^a-zA-Z0-9]/g, '_') === quality.replace(/[^a-zA-Z0-9]/g, '_')
        )];
        
        if (!watchLink) {
            return interaction.reply({
                content: `❌ No download link found for quality: ${quality}`,
                ephemeral: true
            });
        }
        
        // Create download embed
        const downloadEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle(`📱 ${movie.name} - ${quality.toUpperCase()}`)
            .setDescription(`**Ready to download!** Click the link below:\n\n🔗 **[DOWNLOAD ${quality.toUpperCase()}](${watchLink})**`)
            .addFields(
                { name: 'Languages', value: Array.isArray(movie.languages) ? movie.languages.join(', ') : (movie.language || 'N/A'), inline: true },
                { name: 'Format', value: quality.toUpperCase(), inline: true }
            )
            .setFooter({ text: 'Click the download link above • Powered by Esca' });
        
        // Add thumbnail if available
        if (movie.tmdbDetails?.poster_path) {
            downloadEmbed.setThumbnail(`https://image.tmdb.org/t/p/w500${movie.tmdbDetails.poster_path}`);
        } else if (movie.customPosterUrl) {
            downloadEmbed.setThumbnail(movie.customPosterUrl);
        }
        
        await interaction.reply({
            content: `🎬 **${movie.name}** - ${quality.toUpperCase()}\n🔗 **Direct Download:** ${watchLink}`,
            embeds: [downloadEmbed],
            ephemeral: true
        });
        
        // Log the download request
        console.log(`Download requested: ${movie.name} (${quality}) by ${interaction.user.tag}`);
        
    } catch (error) {
        console.error('Error handling download button:', error);
        await interaction.reply({
            content: '❌ An error occurred while processing your download request.',
            ephemeral: true
        });
    }
}