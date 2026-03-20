const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();
client.recordings = new Map();

// Carregar comandos
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
    console.log(`✅ Bot online como ${client.user.tag}`);
    console.log(`📊 Em ${client.guilds.cache.size} servidores`);
    
    // Registrar comandos
    const commands = [];
    client.commands.forEach(cmd => commands.push(cmd.data.toJSON()));
    
    client.application.commands.set(commands)
        .then(() => console.log('✅ Comandos registrados!'))
        .catch(console.error);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    
    try {
        await command.execute(interaction, client);
    } catch (error) {
        console.error('❌ Erro:', error);
        await interaction.reply({ 
            content: '❌ Erro ao executar comando.', 
            ephemeral: true 
        });
    }
});

client.on('voiceStateUpdate', (oldState, newState) => {
    if (oldState.member.id === client.user.id && !newState.channelId) {
        const guildId = oldState.guild.id;
        if (client.recordings.has(guildId)) {
            client.recordings.delete(guildId);
            console.log(`🔌 Bot desconectado em ${guildId}`);
        }
    }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
    console.error('❌ DISCORD_TOKEN não configurado!');
    process.exit(1);
}

client.login(token);
