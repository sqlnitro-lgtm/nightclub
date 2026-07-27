const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType} = require('discord.js');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addemoji')
    .setDescription('Ajoute un emoji au serveur')
    .setContexts([InteractionContextType.Guild])
    .addStringOption((opt) => opt.setName('nom').setDescription("Nom de l'emoji").setRequired(true).setMaxLength(32))
    .addAttachmentOption((opt) => opt.setName('image').setDescription("Image de l'emoji").setRequired(true)),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const name = interaction.options.getString('nom').replace(/[^a-zA-Z0-9_]/g, '');
    const image = interaction.options.getAttachment('image');

    if (!name) {
      return interaction.reply({ content: 'Nom invalide — lettres, chiffres et underscores uniquement.', ephemeral: true });
    }
    if (!image.contentType?.startsWith('image/')) {
      return interaction.reply({ content: "Le fichier fourni n'est pas une image.", ephemeral: true });
    }

    await interaction.deferReply();

    try {
      const emoji = await interaction.guild.emojis.create({ attachment: image.url, name, reason: `Ajouté par ${interaction.user.tag}` });
      const embed = new EmbedBuilder().setColor(0x00b050).setDescription(`✅ Emoji ${emoji} (\`:${emoji.name}:\`) ajouté.`);
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply({ content: `Impossible d'ajouter cet emoji : \`${err.message}\`.` });
    }
  },
};
