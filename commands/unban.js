const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType} = require('discord.js');
const { logModAction } = require('../data/modLogHelper');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription("Débannit un membre (par ID)")
    .setContexts([InteractionContextType.Guild])
    .addStringOption((opt) => opt.setName('id').setDescription("ID Discord du membre à débannir").setRequired(true))
    .addStringOption((opt) => opt.setName('raison').setDescription('Raison').setRequired(false)),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const userId = interaction.options.getString('id').trim();
    const reason = interaction.options.getString('raison');

    if (!/^\d{17,20}$/.test(userId)) {
      return interaction.reply({ content: 'ID Discord invalide.', ephemeral: true });
    }

    const ban = await interaction.guild.bans.fetch(userId).catch(() => null);
    if (!ban) {
      return interaction.reply({ content: "Cet ID n'est pas banni sur ce serveur.", ephemeral: true });
    }

    try {
      await interaction.guild.members.unban(userId, reason ?? undefined);
    } catch (err) {
      return interaction.reply({ content: `Impossible de débannir : \`${err.message}\`.`, ephemeral: true });
    }

    await logModAction(interaction.guild, { action: 'unban', target: { id: userId }, moderator: interaction.user, reason });

    const embed = new EmbedBuilder().setColor(0x00b050).setDescription(`<a:1Kiss:1525528118352154674> <@${userId}> a été débanni.` + (reason ? `\n**Raison :** ${reason}` : ''));
    await interaction.reply({ embeds: [embed] });
  },
};
