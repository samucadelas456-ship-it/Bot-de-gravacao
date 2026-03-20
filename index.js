const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const config = require('./config.js');

// Verifica se as variáveis de ambiente foram fornecidas
if (!config.token || !config.clientId) {
    console.error('❌ Erro: Variáveis de ambiente DISCORD_TOKEN e CLIENT_ID são obrigatórias!');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();
client.recordings = new Map(); // gravações ativas

// Carregar comandos da pasta commands
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            const command = require(filePath);
            client.commands.set(command.data.name, command);
            console.log(`✅ Comando carregado: ${command.data.name}`);
        } catch (error) {
            console.error(`❌ Erro ao carregar comando ${file}:`, error);
        }
    }
}

client.once('ready', () => {
    console.log(`✅ Bot está online como ${client.user.tag}`);
    console.log(`📊 Em ${client.guilds.cache.size} servidores`);

    // Registrar comandos slash globalmente
    const commands = [];
    client.commands.forEach(command => {
        commands.push(command.data.toJSON());
    });

    client.application.commands.set(commands)
        .then(() => console.log('✅ Comandos globais registrados!'))
        .catch(console.error);
});

client.on('interactionCreate', async interaction => {
    if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction, client);
        } catch (error) {
            console.error(`❌ Erro no comando ${interaction.commandName}:`, error);
            const errorMessage = '❌ Ocorreu um erro ao executar este comando.';
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, flags: 64 });
            } else {
                await interaction.reply({ content: errorMessage, flags: 64 });
            }
        }
    } else if (interaction.isButton()) {
        const customId = interaction.customId;

        // Download de áudio
        if (customId.startsWith('download_')) {
            const fileName = customId.replace('download_', '');
            const filePath = path.join(__dirname, 'recordings', fileName);

            if (fs.existsSync(filePath)) {
                await interaction.reply({ content: '📤 Preparando download...', flags: 64 });
                const stats = fs.statSync(filePath);
                const fileSizeMB = stats.size / (1024 * 1024);
                if (fileSizeMB > 24) {
                    await interaction.followUp({
                        content: `❌ Arquivo muito grande (${fileSizeMB.toFixed(2)}MB). Limite 25MB.`,
                        flags: 64
                    });
                } else {
                    await interaction.followUp({
                        files: [{ attachment: filePath, name: fileName }],
                        flags: 64
                    });
                }
            } else {
                await interaction.reply({ content: '❌ Arquivo não encontrado!', flags: 64 });
            }
        }
        // Visualizar detalhes de uma gravação do log
        else if (customId.startsWith('log_')) {
            const baseName = customId.replace('log_', '');
            const mp3Path = path.join(__dirname, 'recordings', `${baseName}.mp3`);
            const jsonPath = path.join(__dirname, 'recordings', `${baseName}.json`);

            if (fs.existsSync(mp3Path) && fs.existsSync(jsonPath)) {
                try {
                    const info = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                    if (info.guildId !== interaction.guildId) {
                        return interaction.reply({ content: '❌ Gravação de outro servidor!', flags: 64 });
                    }
                    const stats = fs.statSync(mp3Path);
                    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
                    const embed = new EmbedBuilder()
                        .setColor(0x0099FF)
                        .setTitle('📝 Detalhes da Gravação')
                        .addFields(
                            { name: '📻 Canal', value: info.channelName, inline: true },
                            { name: '⏱️ Duração', value: info.duration || 'N/A', inline: true },
                            { name: '📅 Data', value: info.date, inline: true },
                            { name: '👤 Iniciado por', value: info.startedBy, inline: true },
                            { name: '📦 Tamanho', value: `${fileSizeMB} MB`, inline: true }
                        )
                        .setTimestamp();
                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`download_${path.basename(mp3Path)}`)
                                .setLabel(`📥 Baixar Áudio (${fileSizeMB} MB)`)
                                .setStyle(ButtonStyle.Primary)
                        );
                    await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
                } catch (error) {
                    console.error('Erro:', error);
                    await interaction.reply({ content: '❌ Erro ao carregar gravação.', flags: 64 });
                }
            } else {
                await interaction.reply({ content: '❌ Gravação não encontrada!', flags: 64 });
            }
        }
        else if (customId === 'cancel_download' || customId === 'cancel') {
            await interaction.update({ components: [] });
        }
    }
});

// Monitorar quando o bot sai da call
client.on('voiceStateUpdate', (oldState, newState) => {
    if (oldState.member.id === client.user.id && !newState.channelId) {
        const guildId = oldState.guild.id;
        if (client.recordings.has(guildId)) {
            console.log(`🔴 Bot saiu da call, finalizando gravação em ${guildId}`);
            stopRecording(guildId, 'bot_left');
        }
    }
});

async function stopRecording(guildId, reason = 'manual') {
    const recording = client.recordings.get(guildId);
    if (!recording) return;

    try {
        console.log(`⏹️ Finalizando gravação (${reason})`);
        const duration = Date.now() - recording.info.startTime;
        const durationSeconds = Math.floor(duration / 1000);
        const minutes = Math.floor(durationSeconds / 60);
        const seconds = durationSeconds % 60;
        const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        if (recording.ffmpegProcess) recording.ffmpegProcess.kill('SIGINT');
        if (recording.connection) recording.connection.destroy();

        setTimeout(() => {
            try {
                recording.info.duration = durationStr;
                recording.info.durationSeconds = durationSeconds;
                recording.info.endTime = Date.now();
                recording.info.endReason = reason;
                const infoPath = recording.info.filePath.replace('.mp3', '.json');
                fs.writeFileSync(infoPath, JSON.stringify(recording.info, null, 2));
                console.log(`✅ Gravação salva: ${recording.info.fileName} (${durationStr})`);

                // Notificar usuário
                const guild = client.guilds.cache.get(guildId);
                if (guild) {
                    const user = guild.members.cache.get(recording.info.startedById)?.user;
                    if (user) {
                        user.send(`✅ Gravação finalizada no canal **${recording.info.channelName}**\n⏱️ Duração: ${durationStr}`)
                            .catch(() => {});
                    }
                }
            } catch (error) {
                console.error('Erro ao processar gravação:', error);
            }
            client.recordings.delete(guildId);
        }, 2000);
    } catch (error) {
        console.error('Erro ao parar gravação:', error);
        client.recordings.delete(guildId);
    }
}

process.on('unhandledRejection', error => {
    console.error('❌ Erro não tratado:', error);
});

client.login(config.token);
