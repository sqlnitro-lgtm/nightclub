const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType} = require('discord.js');
const { canModerate } = require('../data/hierarchyHelper');
const { logModAction } = require('../data/modLogHelper');
const { requireAdmin } = require('../data/permissionHelper');
const { respondPlain } = require('../data/respond');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('softban')
    .setDescription('Bannit puis débannit immédiatement un membre (purge ses messages sans le bannir durablement)')
    .setContexts([InteractionContextType.Guild])
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre concerné').setRequired(true))
    .addIntegerOption((opt) =>
      opt
        .setName('supprimer_messages')
        .setDescription('Supprimer les messages des X derniers jours (0-7, défaut 1)')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(7)
    )
    .addStringOption((opt) => opt.setName('raison').setDescription('Raison').setRequired(false)),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const target = await interaction.guild.members.fetch(interaction.options.getUser('membre').id).catch(() => null);
    const reason = interaction.options.getString('raison');
    const deleteDays = interaction.options.getInteger('supprimer_messages') ?? 1;

    if (!target) {
      return interaction.reply({ content: 'Ce membre est introuvable sur ce serveur.', ephemeral: true });
    }

    const modCheck = canModerate(interaction.guild, interaction.member, target);
    if (!modCheck.ok) return interaction.reply({ content: modCheck.reason, ephemeral: true });

    if (!target.bannable) {
      return interaction.reply({ content: "Le bot n'a pas la permission de bannir ce membre.", ephemeral: true });
    }

    await target.send({ content: `<a:ableh:1525532035928690688> Tu as été expulsé (softban) de **${interaction.guild.name}** — tu peux revenir.${reason ? `\nRaison : ${reason}` : ''}` }).catch(() => {});

    try {
      await interaction.guild.members.ban(target.id, { deleteMessageSeconds: deleteDays * 24 * 60 * 60, reason: `Softban : ${reason ?? 'aucune raison'}` });
      await interaction.guild.members.unban(target.id, 'Softban — levée automatique immédiate');
    } catch (err) {
      return interaction.reply({ content: `Impossible d'effectuer le softban : \`${err.message}\`.`, ephemeral: true });
    }

    await logModAction(interaction.guild, { action: 'softban', target, moderator: interaction.user, reason });

    const embed = new EmbedBuilder()
      .setColor(0xff6600)
      .setDescription(`<a:ableh:1525532035928690688> <@${target.id}> a été softban (messages purgés, peut revenir).` + (reason ? `\n**Raison :** ${reason}` : ''));
    await respondPlain(interaction, { embeds: [embed] });
  },
};
