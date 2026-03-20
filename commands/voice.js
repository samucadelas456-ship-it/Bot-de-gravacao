const { SlashCommandBuilder, ChannelType, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const ffmpegStatic = require('ffmpeg-static');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voice')
        .setDescription('Iniciar gravação em um canal de voz')
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal de voz para gravar')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildVoice))
        .addStringOption(option =>
            option.setName('qualidade')
                .setDescription('Qualidade do áudio')
                .setRequired(false)
                .addChoices(
                    { name: '📦 Normal (128kbps)', value: '128' },
                    { name: '🚀 Alta (192kbps)', value: '192' },
                    { name: '💎 Máxima (320kbps)', value: '320' }
                )),

    async execute(interaction, client) {
        const channel = interaction.options.getChannel('canal');
        const qualidade = interaction.options.getString('qualidade') || '128';

        if (!channel.joinable) {
            return interaction.reply({ content: '❌ Não consigo entrar neste canal! Verifique permissões.', flags: 64 });
        }
        if (client.recordings.has(interaction.guildId)) {
            return interaction.reply({ content: '❌ Já existe uma gravação em andamento!', flags: 64 });
        }

        await interaction.reply({ content: `🎙️ Iniciando gravação no canal **${channel.name}** (${qualidade}kbps)...`, flags: 64 });

        try {
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: true
            });

            await entersState(connection, VoiceConnectionStatus.Ready, 30000);
            console.log(`✅ Conectado a ${channel.name} (${interaction.guild.name})`);

            // Criar diretório de gravações
            const recordingsDir = path.join(__dirname, '../recordings');
            if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir);

            const timestamp = Date.now();
            const date = new Date();
            const safeGuildName = interaction.guild.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const fileName = `${safeGuildName}_${timestamp}.mp3`;
            const filePath = path.join(recordingsDir, fileName);

            // Lista de participantes
            const usersInCall = channel.members
                .filter(m => !m.user.bot)
                .map(m => m.user.tag)
                .join(', ') || 'Nenhum participante';

            // Processo FFmpeg
            const ffmpegArgs = [
                '-i', 'pipe:0',
                '-c:a', 'libmp3lame',
                '-b:a', `${qualidade}k`,
                '-ac', '2',
                '-ar', '48000',
                '-f', 'mp3',
                '-y',
                filePath
            ];
            const ffmpegProcess = spawn(ffmpegStatic, ffmpegArgs);
            const audioStream = connection.receiver.subscribe('all', { mode: 'pcm', end: 'manual' });
            audioStream.pipe(ffmpegProcess.stdin);

            ffmpegProcess.stderr.on('data', data => console.log(`FFmpeg: ${data}`));
            ffmpegProcess.on('error', error => console.error('FFmpeg error:', error));

            const recordingInfo = {
                id: timestamp,
                startTime: timestamp,
                channelName: channel.name,
                channelId: channel.id,
                guildId: interaction.guildId,
                guildName: interaction.guild.name,
                startedBy: interaction.user.tag,
                startedById: interaction.user.id,
                usersInCall,
                usersList: channel.members.filter(m => !m.user.bot).map(m => m.user.tag),
                filePath,
                fileName,
                date: date.toLocaleDateString('pt-BR'),
                time: date.toLocaleTimeString('pt-BR'),
                qualidade: `${qualidade}kbps`,
                status: 'gravando'
            };

            client.recordings.set(interaction.guildId, {
                connection,
                ffmpegProcess,
                audioStream,
                info: recordingInfo
            });

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🎙️ Gravação Iniciada')
                .setDescription(`Ativa no canal **${channel.name}**`)
                .addFields(
                    { name: '📊 Servidor', value: interaction.guild.name, inline: true },
                    { name: '👤 Iniciado por', value: interaction.user.tag, inline: true },
                    { name: '⏱️ Início', value: `${recordingInfo.date} ${recordingInfo.time}`, inline: true },
                    { name: '🎵 Qualidade', value: `${qualidade}kbps`, inline: true },
                    { name: '👥 Participantes', value: usersInCall }
                )
                .setFooter({ text: 'Use /stop para finalizar' })
                .setTimestamp();

            await interaction.editReply({ content: null, embeds: [embed] });

            connection.on(VoiceConnectionStatus.Disconnected, async () => {
                console.log(`🔌 Desconectado em ${interaction.guild.name}`);
                // Chama a função de parar (definida no index.js)
                const { stopRecording } = require('../index.js');
                if (stopRecording) stopRecording(interaction.guildId, 'disconnected');
            });

        } catch (error) {
            console.error('Erro ao iniciar gravação:', error);
            await interaction.editReply({ content: `❌ Erro: ${error.message}` });
            if (client.recordings.has(interaction.guildId)) client.recordings.delete(interaction.guildId);
        }
    }
};
