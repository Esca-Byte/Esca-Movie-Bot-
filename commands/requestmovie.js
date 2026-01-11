const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const dbManager = require('../utils/dbManager');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/config.json');
const statisticsManager = require('../utils/statisticsManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('requestmovie')
        .setDescription('Requests a movie/webseries to be added to the database.')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('The name of the movie or webseries to request.')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const movieName = interaction.options.getString('name');
        const existingMovie = dbManager.getMovie(movieName);
        
        if (existingMovie) {
            const embed = new EmbedBuilder()
                .setColor(0xFFAA00)
                .setTitle('Movie Already Exists')
                .setDescription(`"${movieName}" is already in the database! Use \`/getmovie ${movieName}\` to find it.`);
            
            return interaction.editReply({ embeds: [embed] });
        }
        
        const existingRequests = dbManager.getRequests();
        const duplicateRequest = existingRequests.find(req =>
            req.movieName.toLowerCase() === movieName.toLowerCase() && req.status === 'pending'
        );
        
        if (duplicateRequest) {
            const embed = new EmbedBuilder()
                .setColor(0xFFAA00)
                .setTitle('Duplicate Request')
                .setDescription(`A request for "**${movieName}**" has already been submitted by <@${duplicateRequest.requestedBy}> and is pending.`);
            
            return interaction.editReply({ embeds: [embed] });
        }
        
        try {
            const newRequest = {
                id: uuidv4(),
                movieName: movieName,
                requestedBy: interaction.user.id,
                requestedAt: new Date().toISOString(),
                guildId: interaction.guild.id,
                guildName: interaction.guild.name,
                status: 'pending'
            };
            
            dbManager.addRequest(newRequest);
            
            // Track the request for statistics
            statisticsManager.trackMovieRequest(movieName, interaction.user.id);
            
            const successEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Request Submitted')
                .setDescription(`Your request for "**${movieName}**" has been submitted! It has been sent to the administrators.`);
            
            await interaction.editReply({ embeds: [successEmbed] });
            
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
                        .setFooter({ text: `Request ID: ${newRequest.id}` })
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
            console.error('Error submitting request:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF4444)
                .setTitle('❌ Error')
                .setDescription('There was an error submitting your request. Please try again later.');
            
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
};