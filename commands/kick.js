const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType} = require('discord.js');
const { canModerate } = require('../data/hierarchyHelper');
const { logModAction } = require('../data/modLogHelper');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulse un membre du serveur')
    .setContexts([InteractionContextType.Guild])
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre à expulser').setRequired(true))
    .addStringOption((opt) => opt.setName('raison').setDescription("Raison de l'expulsion").setRequired(false)),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const target = await interaction.guild.members.fetch(interaction.options.getUser('membre').id).catch(() => null);
    const reason = interaction.options.getString('raison');

    if (!target) {
      return interaction.reply({ content: 'Ce membre est introuvable sur ce serveur.', ephemeral: true });
    }

    const modCheck = canModerate(interaction.guild, interaction.member, target);
    if (!modCheck.ok) return interaction.reply({ content: modCheck.reason, ephemeral: true });

    if (!target.kickable) {
      return interaction.reply({ content: "Le bot n'a pas la permission d'expulser ce membre.", ephemeral: true });
    }

    await target.send({ content: `<:argent:1525538360322687097> Tu as été expulsé de **${interaction.guild.name}**.${reason ? `\nRaison : ${reason}` : ''}` }).catch(() => {});

    try {
      await target.kick(reason ?? undefined);
    } catch (err) {
      return interaction.reply({ content: `Impossible d'expulser ce membre : \`${err.message}\`.`, ephemeral: true });
    }

    await logModAction(interaction.guild, { action: 'kick', target, moderator: interaction.user, reason });

    const embed = new EmbedBuilder()
      .setColor(0xff9900)
      .setDescription(`<:argent:1525538360322687097> <@${target.id}> a été expulsé.` + (reason ? `\n**Raison :** ${reason}` : ''));
    await interaction.reply({ embeds: [embed] });
  },
};
