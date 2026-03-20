const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('logs')
        .setDescription('Ver gravações anteriores'),

    async execute(interaction, client) {
        const recordingsDir = path.join(__dirname, '../recordings');
        if (!fs.existsSync(recordingsDir)) {
            return interaction.reply({ content: '❌ Nenhuma gravação encontrada.', flags: 64 });
        }

        const files = fs.readdirSync(recordingsDir)
            .filter(f => f.endsWith('.json'))
            .filter(f => {
                try {
                    const data = JSON.parse(fs.readFileSync(path.join(recordingsDir, f), 'utf8'));
                    return data.guildId === interaction.guildId;
                } catch { return false; }
            })
            .sort((a, b) => fs.statSync(path.join(recordingsDir, b)).mtimeMs - fs.statSync(path.join(recordingsDir, a)).mtimeMs)
            .slice(0, 10);

        if (files.length === 0) {
            return interaction.reply({ content: '❌ Nenhuma gravação neste servidor.', flags: 64 });
        }

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📋 Histórico de Gravações')
            .setDescription(`Últimas ${files.length} gravações:`)
            .setTimestamp();

        const buttons = [];
        for (let i = 0; i < files.length; i++) {
            const filePath = path.join(recordingDir, files[i]);
            const info = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            embed.addFields({
                name: `📝 Gravação #${i+1}`,
                value: `**Canal:** ${info.channelName}\n**Data:** ${info.date} ${info.time}\n**Duração:** ${info.duration || 'N/A'}`
            });
            const baseName = files[i].replace('.json', '');
            buttons.push(new ButtonBuilder()
                .setCustomId(`log_${baseName}`)
                .setLabel(`${i+1}`)
                .setStyle(ButtonStyle.Secondary)
            );
        }

        const rows = [];
        for (let i = 0; i < buttons.length; i += 5) {
            const row = new ActionRowBuilder();
            buttons.slice(i, i+5).forEach(btn => row.addComponents(btn));
            rows.push(row);
        }

        await interaction.reply({ embeds: [embed], components: rows, flags: 64 });
    }
};
