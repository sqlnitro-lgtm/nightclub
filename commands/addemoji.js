const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType} = require('discord.js');
const { requireAdmin } = require('../data/permissionHelper');
const { respondPlain } = require('../data/respond');

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

    await interaction.deferReply({ ephemeral: true });

    try {
      const emoji = await interaction.guild.emojis.create({ attachment: image.url, name, reason: `Ajouté par ${interaction.user.tag}` });
      const embed = new EmbedBuilder().setColor(0x00b050).setDescription(`<a:1Kiss:1525528118352154674> Emoji ${emoji} (\`:${emoji.name}:\`) ajouté.`);
      await respondPlain(interaction, { embeds: [embed] });
    } catch (err) {
      await interaction.editReply({ content: `Impossible d'ajouter cet emoji : \`${err.message}\`.` });
    }
  },
};
