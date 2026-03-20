const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Ver status do bot'),
    
    async execute(interaction, client) {
        const connection = getVoiceConnection(interaction.guildId);
        
        const embed = new EmbedBuilder()
            .setColor(connection ? 0x00FF00 : 0xFF0000)
            .setTitle('📊 Status')
            .addFields(
                { name: '🤖 Bot', value: client.user.tag, inline: true },
                { name: '📡 Ping', value: `${client.ws.ping}ms`, inline: true },
                { name: '🔊 Em call?', value: connection ? 'Sim' : 'Não', inline: true }
            );
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
