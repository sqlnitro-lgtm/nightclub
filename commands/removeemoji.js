const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removeemoji')
    .setDescription('Retire un emoji du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions)
    .addStringOption((opt) => opt.setName('nom').setDescription("Nom exact de l'emoji à retirer").setRequired(true)),

  async execute(interaction) {
    const rawName = interaction.options.getString('nom').replace(/^:|:$/g, '');
    const emoji = interaction.guild.emojis.cache.find((e) => e.name === rawName);

    if (!emoji) {
      return interaction.reply({ content: `Aucun emoji nommé \`${rawName}\` trouvé sur ce serveur.`, ephemeral: true });
    }

    try {
      await emoji.delete(`Retiré par ${interaction.user.tag}`);
    } catch (err) {
      return interaction.reply({ content: `Impossible de retirer cet emoji : \`${err.message}\`.`, ephemeral: true });
    }

    const embed = new EmbedBuilder().setColor(0x00b050).setDescription(`✅ Emoji \`:${rawName}:\` retiré.`);
    await interaction.reply({ embeds: [embed] });
  },
};
