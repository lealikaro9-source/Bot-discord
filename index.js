const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionsBitfield, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, Collection } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildInvites 
    ],
});

// ==========================================
//           CENTRAL DE LICENÇAS (VENDAS)
// ==========================================
const LICENCAS = {
    "1473287580840886430": { expira: "15/06/2026" },
    "ID_DO_SERVE_2": { expira: "01/01/2026" },
    "ID_DO_SERVE_3": { expira: "01/01/2026" },
    "ID_DO_SERVE_4": { expira: "01/01/2026" },
    "ID_DO_SERVE_5": { expira: "01/01/2026" },
    "ID_DO_SERVE_6": { expira: "01/01/2026" },
    "ID_DO_SERVE_7": { expira: "01/01/2026" },
    "ID_DO_SERVE_8": { expira: "01/01/2026" }
};

function verificarLicenca(guildId) {
    if (!guildId) return false;
    const licenca = LICENCAS[guildId];
    if (!licenca) return false;

    try {
        const [dia, mes, ano] = licenca.expira.split('/').map(Number);
        const dataExpiracao = new Date(ano, mes - 1, dia, 23, 59, 59);
        return new Date() <= dataExpiracao;
    } catch (e) { return false; }
}

const ID_CARGO_SUPORTE = "ID_DO_SUPORTE"; 
const ID_CARGO_ANALISTA = "ID_DO_ANALISTA"; 
const ID_DONO_SISTEMA = "SEU_ID_AQUI"; 
const TAXA_ADM = 0.10; 
const ID_CANAL_CONVITES = "ID_DO_CANAL_SEUS_CONVITES";

const NOMES_CANAIS = {
    "tecnico": "📩-suporte",
    "reembolso": "💰-reembolso",
    "vagas": "🤝-vagas-mediador",
    "receber": "🔔-receber-evento",
    "planos": "🎫-tickets"
};

let filas = {}; 
let filaMediadores = []; 
let confirmacoesPartida = new Map(); 
let bancoDadosPix = new Map(); 
let ticketsAssumidos = new Map();
let mensagensAnuncio = []; 
const guildInvites = new Map();
let cacheSala = new Map();
let ranking = new Map();

client.once('ready', async () => { 
    console.log('✅ SISTEMA AURA ATIVO!'); 
    for (const [guildId, guild] of client.guilds.cache) {
        try {
            const firstInvites = await guild.invites.fetch();
            guildInvites.set(guildId, new Map(firstInvites.map((invite) => [invite.code, invite.uses])));
        } catch (e) { console.log(`Erro ao carregar convites da guild ${guildId}`); }
    }

    setInterval(async () => {
        if (filaMediadores.length > 0) {
            for (const msg of mensagensAnuncio) {
                try { await msg.delete(); } catch (e) {}
            }
            mensagensAnuncio = [];
            const canaisFila = ['1v1-mobile', '1v1-emulador', '2v2-mobile', '2v2-emulador', 'tatico']; 
            client.channels.cache.forEach(async (canal) => {
                if (!verificarLicenca(canal.guild?.id)) return;
                if (canaisFila.some(nome => canal.name.toLowerCase().includes(nome)) && canal.type === ChannelType.GuildText) {
                    try {
                        const msg = await canal.send('# 🟢 FILAS ON-LINE\n# ✅ MEDIADORES DISPONÍVEIS');
                        mensagensAnuncio.push(msg);
                    } catch (e) {}
                }
            });
        }
    }, 300000); 
});

client.on('guildMemberAdd', async (member) => {
    if (!verificarLicenca(member.guild.id)) return;
    const cachedInvites = guildInvites.get(member.guild.id);
    const newInvites = await member.guild.invites.fetch();
    const invite = newInvites.find(i => i.uses > (cachedInvites.get(i.code) || 0));
    guildInvites.set(member.guild.id, new Map(newInvites.map((invite) => [invite.code, invite.uses])));
    if (invite) {
        const canalLog = member.guild.channels.cache.get(ID_CANAL_CONVITES);
        if (canalLog) {
            const embedInvite = new EmbedBuilder()
                .setTitle(`⚡ ENTROU NA ORG MILOKA ⚡`)
                .setColor('#ff9900')
                .setDescription(`🔥 | Convidado: <@${member.id}>\n🔥 | Indicador: <@${invite.inviter.id}>\n🔥 | Indicou: ${invite.uses} invites.`);
            canalLog.send({ embeds: [embedInvite] });
        }
    }
});

function criarEmbedAdm() {
    const lista = filaMediadores.length > 0 ? filaMediadores.map((id, index) => `**${index + 1}º.** <@${id}>`).join('\n') : ' ';
    return new EmbedBuilder().setTitle('Entrar em espera...').setColor('#2b2d31').setDescription(`**Mediadores presentes:**\n${lista}`).setFooter({ text: 'Aura System' });
}

function criarEmbedFila(categoria, modo, valor) {
    const idFilaVisual = `${categoria}_${valor}`;
    if (!filas[idFilaVisual]) filas[idFilaVisual] = [];
    const listaJogadores = filas[idFilaVisual].length > 0 ? filas[idFilaVisual].map((user, index) => {
        return `**${index + 1}º** <@${user.id}> | ${user.modo}`;
    }).join('\n') : '*Vazia*';
    return new EmbedBuilder().setTitle(`${modo} | ${categoria.toUpperCase()} | AURA`).setColor('#7000FF').addFields({ name: '💰 Valor:', value: `R$ ${valor}`, inline: true }, { name: '👤 Jogadores na Fila:', value: listaJogadores, inline: false });
}client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    if (!verificarLicenca(message.guild.id)) return;

    if (message.content.toLowerCase().startsWith('.p')) {
        const target = message.mentions.users.first() || message.author;
        const stats = ranking.get(target.id) || { vitorias: 0, derrotas: 0, consecutivas: 0, total: 0 };
        const embedPerfil = new EmbedBuilder()
            .setAuthor({ name: `Perfil de ${target.username}`, iconURL: target.displayAvatarURL() })
            .setColor('#1a1aff')
            .setDescription(`**Estatísticas de pontos**\n\n**Vitórias:** ${stats.vitorias} ・ **Derrotas:** ${stats.derrotas}\n**Consecutivas:** ${stats.consecutivas} ・ **Total:** ${stats.total}`);
        return message.reply({ embeds: [embedPerfil] });
    }

    if (message.content.toLowerCase() === '.aux') {
        if (!message.channel.isThread()) return;
        const rowAux = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('menu_auxiliar')
                .setPlaceholder('Painel Auxiliar do Mediador')
                .addOptions([
                    { label: 'Escolher Vencedor', value: 'escolher_vencedor', emoji: '🏆' },
                    { label: 'Fechar Sala', value: 'fechar_sala_adm', emoji: '🗑️' }
                ])
        );
        await message.channel.send({ embeds: [new EmbedBuilder().setTitle("O que deseja fazer?").setColor("#2b2d31")], components: [rowAux] });
    }

    if (message.channel.isThread()) {
        const texto = message.content.trim();
        const idMatch = texto.match(/\b\d{9}\b/);
        if (idMatch && texto.length > 9) {
            const idSala = idMatch[0];
            const senhaSala = texto.replace(idSala, '').trim();
            if (senhaSala.length > 0) return anunciarSala(message, idSala, senhaSala);
        }
        if (idMatch && texto.length === 9) {
            cacheSala.set(message.channel.id, idMatch[0]);
            return;
        }
        if (cacheSala.has(message.channel.id) && !idMatch && texto.length <= 10) {
            const idSala = cacheSala.get(message.channel.id);
            const senhaSala = texto;
            cacheSala.delete(message.channel.id);
            return anunciarSala(message, idSala, senhaSala);
        }
    }
});

async function anunciarSala(message, id, senha) {
    const dados = confirmacoesPartida.get(message.channel.id);
    const mencao = dados ? `<@${dados.jogadores[0]}>, <@${dados.jogadores[1]}>` : "";
    try {
        const mensagens = await message.channel.messages.fetch({ limit: 20 });
        await message.channel.bulkDelete(mensagens);
    } catch (e) { await message.delete().catch(() => {}); }
    const embed = new EmbedBuilder()
        .setTitle('🎮 SALA CRIADA - AURA').setColor('#00FFFF')
        .setDescription(`${mencao}\n\nA sala foi criada! Entrem imediatamente.`)
        .addFields({ name: '🆔 ID DA SALA:', value: `\`${id}\``, inline: true }, { name: '🔑 SENHA:', value: `\`${senha}\``, inline: true }, { name: '⏰ AVISO:', value: 'A sala inicia em **3 minutos**!', inline: false })
        .setFooter({ text: 'Aura System - Bom jogo!' });
    await message.channel.send({ content: mencao, embeds: [embed] });
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.guild) return;
    if (!verificarLicenca(interaction.guild.id)) return interaction.reply({ content: "❌ Licença inativa.", ephemeral: true });

    if (interaction.isModalSubmit() && interaction.customId === 'modal_config_pix') {
        const dados = { chave: interaction.fields.getTextInputValue('chave_pix'), modelo: interaction.fields.getTextInputValue('modelo_pix'), nome: interaction.fields.getTextInputValue('nome_pix'), qrcode: interaction.fields.getTextInputValue('qr_pix') || "Não configurado" };
        bancoDadosPix.set(interaction.user.id, dados);
        return interaction.reply({ content: "✅ Seu PIX foi salvo!", ephemeral: true });
    }

    if (interaction.customId === 'verificar_status_pix') {
        const pix = bancoDadosPix.get(interaction.user.id);
        if (!pix) return interaction.reply({ content: "❌ Sem PIX.", ephemeral: true });
        const embedStatus = new EmbedBuilder().setTitle('📌 Seus Dados').setColor('#2b2d31').addFields({ name: '👤 Nome:', value: pix.nome, inline: true }, { name: '📂 Tipo:', value: pix.modelo, inline: true }, { name: '🔑 Chave:', value: `\`${pix.chave}\``, inline: false });
        return interaction.reply({ embeds: [embedStatus], ephemeral: true });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'menu_auxiliar') {
        const escolha = interaction.values[0];
        const dados = confirmacoesPartida.get(interaction.channel.id);
        if (escolha === 'fechar_sala_adm') {
            await interaction.reply("⚠️ Fechando...");
            setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
        }
        if (escolha === 'escolher_vencedor') {
            if (!filaMediadores.includes(interaction.user.id)) return interaction.reply({ content: "❌ Só mediadores.", ephemeral: true });
            if (!dados) return interaction.reply({ content: "❌ Sem registro.", ephemeral: true });
            const p1 = interaction.guild.members.cache.get(dados.jogadores[0])?.user.username || "Jogador 1";
            const p2 = interaction.guild.members.cache.get(dados.jogadores[1])?.user.username || "Jogador 2";
            const rowVence = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`venceu_${dados.jogadores[0]}`).setLabel(`Venceu: ${p1}`).setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`venceu_${dados.jogadores[1]}`).setLabel(`Venceu: ${p2}`).setStyle(ButtonStyle.Success));
            await interaction.reply({ content: "Quem venceu?", components: [rowVence], ephemeral: true });
        }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'menu_atendimento') {
        await interaction.deferReply({ ephemeral: true });
        const tipoTicket = interaction.values[0]; 
        const nomeAlvo = NOMES_CANAIS[tipoTicket];
        const canalAlvo = interaction.guild.channels.cache.find(c => c.name.includes(nomeAlvo));
        if (!canalAlvo) return interaction.editReply({ content: `❌ Canal não achado.` });
        try {
            const thread = await canalAlvo.threads.create({ name: `📩・${tipoTicket}-${interaction.user.username}`, type: ChannelType.PrivateThread });
            await thread.members.add(interaction.user.id);
            const rowBotoes = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('finalizar_ticket').setLabel('Fechar').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('assumir_ticket').setLabel('Assumir').setStyle(ButtonStyle.Secondary));
            await thread.send({ content: `🚨 <@&${ID_CARGO_SUPORTE}>`, components: [rowBotoes] });
            return interaction.editReply({ content: `✅ Ticket aberto!` });
        } catch (e) { return interaction.editReply({ content: `❌ Erro.` }); }
    }

    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith('venceu_')) {
        const vId = interaction.customId.split('_')[1]; 
        const dadosPartida = confirmacoesPartida.get(interaction.channel.id);
        if (dadosPartida) {
            const dId = dadosPartida.jogadores.find(id => id !== vId);
            let statsV = ranking.get(vId) || { vitorias: 0, derrotas: 0, consecutivas: 0, total: 0 };
            statsV.vitorias += 1; statsV.total += 1; ranking.set(vId, statsV);
            let statsD = ranking.get(dId) || { vitorias: 0, derrotas: 0, consecutivas: 0, total: 0 };
            statsD.derrotas += 1; statsD.total += 1; ranking.set(dId, statsD);
            await interaction.channel.send(`# 🏆 VENCEDOR: <@${vId}>`);
        }
        return interaction.reply({ content: "Computado.", ephemeral: true });
    }

    if (interaction.customId === 'confirmar_inicio') {
        let dados = confirmacoesPartida.get(interaction.channel.id);
        if (!dados || !dados.jogadores.includes(interaction.user.id)) return;
        if (dados.confirmados.includes(interaction.user.id)) return;
        dados.confirmados.push(interaction.user.id);
        if (dados.confirmados.length === 2) {
            const pixM = bancoDadosPix.get(dados.mediador) || { chave: "Vazio", nome: "Vazio" };
            const vFinal = (parseFloat(dados.valor.replace(',', '.')) + TAXA_ADM).toFixed(2);
            await interaction.channel.send({ content: `**Pagar: R$ ${vFinal}**\n**Chave:** \`${pixM.chave}\`\n**Nome: ${pixM.nome}**` });
        } else { await interaction.reply({ content: "✅ Confirmado!" }); }
    }

    if (interaction.customId === 'configurar_pix_btn') {
        const modal = new ModalBuilder().setCustomId('modal_config_pix').setTitle('🔑 PIX');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('chave_pix').setLabel('Chave').setStyle(TextInputStyle.Short)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('modelo_pix').setLabel('Tipo').setStyle(TextInputStyle.Short)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nome_pix').setLabel('Nome').setStyle(TextInputStyle.Short)));
        return await interaction.showModal(modal);
    }

    if (interaction.customId === 'entrar_mediacao' || interaction.customId === 'sair_mediacao') {
        if (interaction.customId === 'entrar_mediacao') { if (!filaMediadores.includes(interaction.user.id)) filaMediadores.push(interaction.user.id); }
        else { filaMediadores = filaMediadores.filter(id => id !== interaction.user.id); }
        return interaction.update({ embeds: [criarEmbedAdm()] });
    }

    const partes = interaction.customId.split('_');
    if (partes[0] === 'entrar' || partes[0] === 'sair') {
        const [acao, cat, mod, val] = partes;
        const idFila = `${cat}_${val}`;
        if (acao === 'entrar') {
            if (!filaMediadores.length) return interaction.reply({ content: "Sem Mediadores!", ephemeral: true });
            if (!filas[idFila]) filas[idFila] = [];
            filas[idFila].push({ id: interaction.user.id, modo: interaction.component.label });
            if (filas[idFila].length >= 2) {
                const j1 = filas[idFila].shift().id; const j2 = filas[idFila].shift().id;
                await criarSalaAposta(interaction, [j1, j2], val, interaction.component.label, cat);
            }
        }
        await interaction.update({ embeds: [criarEmbedFila(cat, interaction.component.label, val)] });
    }
});

async function criarSalaAposta(interaction, jogadores, valor, modo, categoria) {
    try {
        const canalDestino = interaction.guild.channels.cache.find(c => c.name.includes('sua-fila-aqui'));
        const mediador = filaMediadores.shift(); filaMediadores.push(mediador);
        const thread = await canalDestino.threads.create({ name: `AURA-${modo}-${valor}`, type: ChannelType.PrivateThread });
        confirmacoesPartida.set(thread.id, { jogadores, confirmados: [], mediador, valor, modo });
        for (const id of jogadores) await thread.members.add(id);
        await thread.members.add(mediador);
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('confirmar_inicio').setLabel('Confirmar').setStyle(ButtonStyle.Success));
        await thread.send({ content: `<@${jogadores[0]}> <@${jogadores[1]}>`, components: [row] });
    } catch (e) {}
}

client.login("SEU_TOKEN_AQUI");
