const { SlashCommandBuilder, EmbedBuilder, ChannelType, InteractionContextType } = require('discord.js');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('channels')
    .setDescription('Gère les salons du serveur')
    .setContexts([InteractionContextType.Guild])
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Crée un salon')
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
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Supprime un salon')
        .addChannelOption((opt) =>
          opt
            .setName('salon')
            .setDescription('Le salon à supprimer (défaut : celui-ci)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildCategory)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('rename')
        .setDescription('Renomme un salon')
        .addStringOption((opt) => opt.setName('nouveau_nom').setDescription('Nouveau nom du salon').setRequired(true))
        .addChannelOption((opt) =>
          opt
            .setName('salon')
            .setDescription('Le salon à renommer (défaut : celui-ci)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildCategory)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('hide')
        .setDescription('Masque un salon pour @everyone')
        .addChannelOption((opt) =>
          opt.setName('salon').setDescription('Le salon à masquer (défaut : celui-ci)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice).setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('unhide')
        .setDescription('Rend un salon visible pour @everyone')
        .addChannelOption((opt) =>
          opt.setName('salon').setDescription('Le salon à rendre visible (défaut : celui-ci)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice).setRequired(false)
        )
    ),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
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
        const embed = new EmbedBuilder().setColor(0x00b050).setDescription(`<a:1Kiss:1525528118352154674> Salon <#${channel.id}> créé.`);
        return interaction.reply({ embeds: [embed] });
      } catch (err) {
        return interaction.reply({ content: `Impossible de créer ce salon : \`${err.message}\`.`, ephemeral: true });
      }
    }

    if (sub === 'delete') {
      const channel = interaction.options.getChannel('salon') ?? interaction.channel;
      const name = channel.name;
      // Répond avant de supprimer : si le salon ciblé est celui-ci, il n'existe
      // plus pour recevoir quoi que ce soit une fois channel.delete() résolu.
      await interaction.reply({ content: `<a:1Kiss:1525528118352154674> Salon **${name}** supprimé.`, ephemeral: true });
      try {
        await channel.delete(`Supprimé par ${interaction.user.tag}`);
      } catch (err) {
        await interaction.editReply({ content: `Impossible de supprimer ce salon : \`${err.message}\`.` }).catch(() => {});
      }
      return;
    }

    if (sub === 'rename') {
      const channel = interaction.options.getChannel('salon') ?? interaction.channel;
      const newName = interaction.options.getString('nouveau_nom');
      const oldName = channel.name;
      try {
        await channel.setName(newName, `Renommé par ${interaction.user.tag}`);
      } catch (err) {
        return interaction.reply({ content: `Impossible de renommer ce salon : \`${err.message}\`.`, ephemeral: true });
      }
      const embed = new EmbedBuilder().setColor(0x00b050).setDescription(`<a:1Kiss:1525528118352154674> Salon **${oldName}** renommé en **${newName}**.`);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'hide') {
      const channel = interaction.options.getChannel('salon') ?? interaction.channel;
      try {
        await channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: false });
      } catch (err) {
        return interaction.reply({ content: `Impossible de masquer ce salon : \`${err.message}\`.`, ephemeral: true });
      }
      const embed = new EmbedBuilder().setColor(0xff6600).setDescription(`<a:FakeNitroEmoji:1525583069996650560> <#${channel.id}> est maintenant masqué pour @everyone.`);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'unhide') {
      const channel = interaction.options.getChannel('salon') ?? interaction.channel;
      try {
        await channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: null });
      } catch (err) {
        return interaction.reply({ content: `Impossible de rendre ce salon visible : \`${err.message}\`.`, ephemeral: true });
      }
      const embed = new EmbedBuilder().setColor(0x00b050).setDescription(`<:hkexc:1525532083366137917> <#${channel.id}> est de nouveau visible pour @everyone.`);
      return interaction.reply({ embeds: [embed] });
    }
  },
};
