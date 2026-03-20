const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Sair do canal de voz'),
    
    async execute(interaction, client) {
        const connection = getVoiceConnection(interaction.guildId);
        
        if (!connection) {
            return interaction.reply({ 
                content: '❌ Não estou em nenhum canal!', 
                ephemeral: true 
            });
        }
        
        connection.destroy();
        client.recordings.delete(interaction.guildId);
        
        await interaction.reply({ 
            content: '👋 Sai do canal de voz!', 
            ephemeral: true 
        });
    }
};
