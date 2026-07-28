/**
 * /dog - met un membre "en laisse" (ou l'en libère si déjà en laisse) :
 * pseudo formaté "Nom (🐕 de Propriétaire)" et verrouillé (revert auto
 * si changé, voir index.js), et le fait suivre le propriétaire en vocal
 * (réutilise data/voiceFollowStore.js, comme =follow). Un seul membre
 * en laisse par propriétaire à la fois. Retirer la laisse de quelqu'un
 * d'autre que la sienne demande Administrator.
 */
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType} = require('discord.js');
const { getLeash, getLeashedByOwner, setLeash, removeLeash } = require('../data/leashStore');
const { setFollow, clearFollow } = require('../data/voiceFollowStore');
const { canModerate } = require('../data/hierarchyHelper');
const { requireAdmin } = require('../data/permissionHelper');

// Les pseudos Discord ne peuvent pas contenir d'emoji personnalisé (<a:...:id>) —
// seuls les caractères Unicode s'y affichent correctement, d'où un emoji dédié pour le pseudo.
const DOG_NICK_EMOJI = '🐕';
const DOG_EMBED_EMOJI = '<a:xopurpleflash:1526275608097587232>';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dog')
    .setDescription('Met un membre en laisse (ou le libère si déjà en laisse)')
    .setContexts([InteractionContextType.Guild])
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre à mettre en laisse / libérer').setRequired(true)),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const target = await interaction.guild.members.fetch(interaction.options.getUser('membre').id).catch(() => null);
    if (!target) {
      return interaction.reply({ content: 'Ce membre est introuvable sur ce serveur.', ephemeral: true });
    }

    const existing = getLeash(interaction.guild.id, target.id);

    if (existing) {
      const isOwner = existing.ownerId === interaction.user.id;
      const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
      if (!isOwner && !isAdmin) {
        return interaction.reply({ content: `Seul <@${existing.ownerId}> (ou un Administrateur) peut retirer cette laisse.`, ephemeral: true });
      }

      await target.setNickname(existing.originalNick, `Laisse retirée par ${interaction.user.tag}`).catch(() => {});
      clearFollow(target.id);
      removeLeash(interaction.guild.id, target.id);

      const embed = new EmbedBuilder().setColor(0x00b050).setDescription(`${DOG_EMBED_EMOJI} <@${target.id}> n'est plus en laisse.`);
      return interaction.reply({ embeds: [embed] });
    }

    const modCheck = canModerate(interaction.guild, interaction.member, target);
    if (!modCheck.ok) return interaction.reply({ content: modCheck.reason, ephemeral: true });

    if (!target.manageable) {
      return interaction.reply({ content: "Le bot n'a pas la permission de renommer ce membre.", ephemeral: true });
    }

    const alreadyHeld = getLeashedByOwner(interaction.guild.id, interaction.user.id);
    if (alreadyHeld) {
      return interaction.reply({ content: `Tu as déjà <@${alreadyHeld.targetId}> en laisse — libère-le d'abord (\`/dog\` sur lui) avant d'en prendre un autre.`, ephemeral: true });
    }

    const originalNick = target.nickname;
    const ownerName = interaction.member.nickname || interaction.user.username;
    const baseName = target.nickname || target.user.username;
    const lockedNick = `${baseName} (${DOG_NICK_EMOJI} de ${ownerName})`.slice(0, 32);

    try {
      await target.setNickname(lockedNick, `Mis en laisse par ${interaction.user.tag}`);
    } catch (err) {
      return interaction.reply({ content: `Impossible de changer le pseudo : \`${err.message}\`.`, ephemeral: true });
    }

    setLeash(interaction.guild.id, target.id, interaction.user.id, originalNick, lockedNick);
    setFollow(target.id, interaction.user.id);

    const embed = new EmbedBuilder()
      .setColor(0x999999)
      .setDescription(`${DOG_EMBED_EMOJI} <@${target.id}> est maintenant en laisse — pseudo verrouillé, te suit automatiquement en vocal. Relance \`/dog\` sur lui pour le libérer.`);
    await interaction.reply({ embeds: [embed] });
  },
};
