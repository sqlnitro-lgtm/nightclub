const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('move')
    .setDescription('Déplace un membre vers un autre salon vocal')
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre à déplacer').setRequired(true))
    .addChannelOption((opt) =>
      opt.setName('salon').setDescription('Le salon vocal de destination').addChannelTypes(ChannelType.GuildVoice).setRequired(true)
    ),

  async execute(interaction) {
    const target = await interaction.guild.members.fetch(interaction.options.getUser('membre').id).catch(() => null);
    const channel = interaction.options.getChannel('salon');

    if (!target) {
      return interaction.reply({ content: 'Ce membre est introuvable sur ce serveur.', ephemeral: true });
    }
    if (!target.voice.channel) {
      return interaction.reply({ content: `<@${target.id}> n'est pas en vocal.`, ephemeral: true });
    }

    try {
      await target.voice.setChannel(channel, `Déplacé par ${interaction.user.tag}`);
    } catch (err) {
      return interaction.reply({ content: `Impossible de déplacer ce membre : \`${err.message}\`.`, ephemeral: true });
    }

    const embed = new EmbedBuilder().setColor(0x5865f2).setDescription(`✅ <@${target.id}> déplacé vers <#${channel.id}>.`);
    await interaction.reply({ embeds: [embed] });
  },
};
