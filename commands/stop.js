const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Parar a gravação atual'),

    async execute(interaction, client) {
        const recording = client.recordings.get(interaction.guildId);
        if (!recording) {
            return interaction.reply({ content: '❌ Não há gravação em andamento!', flags: 64 });
        }
        if (recording.info.startedById !== interaction.user.id) {
            return interaction.reply({ content: '❌ Apenas quem iniciou pode parar!', flags: 64 });
        }

        await interaction.reply({ content: '⏹️ Finalizando gravação...', flags: 64 });

        try {
            const duration = Date.now() - recording.info.startTime;
            const seconds = Math.floor(duration / 1000);
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            const durationStr = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;

            if (recording.ffmpegProcess) recording.ffmpegProcess.kill('SIGINT');
            if (recording.connection) recording.connection.destroy();

            setTimeout(() => {
                try {
                    const filePath = recording.info.filePath;
                    if (fs.existsSync(filePath)) {
                        recording.info.duration = durationStr;
                        recording.info.durationSeconds = seconds;
                        recording.info.endTime = Date.now();
                        const infoPath = filePath.replace('.mp3', '.json');
                        fs.writeFileSync(infoPath, JSON.stringify(recording.info, null, 2));

                        const stats = fs.statSync(filePath);
                        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

                        const embed = new EmbedBuilder()
                            .setColor(0x00FF00)
                            .setTitle('✅ Gravação Finalizada')
                            .addFields(
                                { name: '📻 Canal', value: recording.info.channelName, inline: true },
                                { name: '⏱️ Duração', value: durationStr, inline: true },
                                { name: '🎵 Qualidade', value: recording.info.qualidade, inline: true },
                                { name: '📦 Tamanho', value: `${fileSizeMB} MB`, inline: true },
                                { name: '📅 Data', value: recording.info.date, inline: true },
                                { name: '👥 Participantes', value: recording.info.usersInCall }
                            )
                            .setTimestamp();

                        const row = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`download_${recording.info.fileName}`)
                                    .setLabel(`📥 Baixar Áudio (${fileSizeMB} MB)`)
                                    .setStyle(ButtonStyle.Primary)
                            );

                        interaction.editReply({ content: null, embeds: [embed], components: [row] });
                        console.log(`✅ Gravação finalizada: ${recording.info.fileName}`);
                    } else {
                        interaction.editReply({ content: '❌ Arquivo de áudio não encontrado.' });
                    }
                } catch (err) {
                    console.error('Erro ao processar:', err);
                    interaction.editReply({ content: '❌ Erro ao processar gravação.' });
                }
                client.recordings.delete(interaction.guildId);
            }, 2000);

        } catch (error) {
            console.error('Erro ao parar:', error);
            await interaction.editReply({ content: '❌ Erro ao finalizar gravação.' });
            client.recordings.delete(interaction.guildId);
        }
    }
};
