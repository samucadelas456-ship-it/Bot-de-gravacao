const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voice')
        .setDescription('Entrar em um canal de voz')
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal de voz')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildVoice)),
    
    async execute(interaction, client) {
        const channel = interaction.options.getChannel('canal');
        
        if (!channel.joinable) {
            return interaction.reply({ 
                content: '❌ Não consigo entrar neste canal!', 
                ephemeral: true 
            });
        }
        
        try {
            joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: true
            });
            
            client.recordings.set(interaction.guildId, {
                channelId: channel.id,
                startedAt: Date.now()
            });
            
            await interaction.reply({ 
                content: `✅ Entrei no canal **${channel.name}**!`, 
                ephemeral: true 
            });
            
        } catch (error) {
            console.error('Erro:', error);
            await interaction.reply({ 
                content: `❌ Erro: ${error.message}`, 
                ephemeral: true 
            });
        }
    }
};
