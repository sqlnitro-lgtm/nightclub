const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType, InteractionContextType} = require('discord.js');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createchannel')
    .setDescription('Crée un salon')
    .setContexts([InteractionContextType.Guild])
    .addStringOption((opt) => opt.setName('nom').setDescription('Nom du salon').setRequired(true))
    .addStringOption((opt) =>
      opt
        .setName('type')
        .setDescription('Type de salon (défaut : texte)')
        .setRequired(false)
        .addChoices({ name: 'Texte', value: 'text' }, { name: 'Vocal', value: 'voice' })
    )
    .addChannelOption((opt) =>
      opt.setName('categorie').setDescription('Catégorie parente').addChannelTypes(ChannelType.GuildCategory).setRequired(false)
    ),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const name = interaction.options.getString('nom');
    const typeChoice = interaction.options.getString('type') ?? 'text';
    const category = interaction.options.getChannel('categorie');

    try {
      const channel = await interaction.guild.channels.create({
        name,
        type: typeChoice === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText,
        parent: category?.id ?? null,
        reason: `Créé par ${interaction.user.tag}`,
      });

      const embed = new EmbedBuilder().setColor(0x00b050).setDescription(`✅ Salon <#${channel.id}> créé.`);
      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      await interaction.reply({ content: `Impossible de créer ce salon : \`${err.message}\`.`, ephemeral: true });
    }
  },
};
