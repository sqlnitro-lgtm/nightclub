/**
 * embedVersion.js
 * ------------------------------------------------------------------
 * Traduit n'importe quel message du bot entre les deux présentations :
 * embed classique (V1) et Components V2. Utilisé en repli par =v1/=v2
 * quand le message ciblé n'est pas un panneau connu (voir index.js,
 * PANNEAUX_VERSIONNES) — le panneau de ticket garde son constructeur
 * dédié, qui rend mieux parce qu'il sait ce que chaque ligne signifie.
 *
 * Ce qui est conservé : couleur, contenu texte, titre, description,
 * champs, image et pied de page de chaque embed ; les boutons et menus,
 * qui gardent leur customId et continuent donc de fonctionner.
 * Ce qui se perd, faute d'équivalent dans l'autre format : l'auteur et
 * l'horodatage d'un embed, et la distinction champ en ligne / pleine
 * largeur.
 * ------------------------------------------------------------------
 */

const {
  ActionRowBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  SeparatorBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  EmbedBuilder,
  MessageFlags,
  ComponentType,
} = require('discord.js');

// Discord plafonne un message V2 à 40 composants et 4000 caractères. On
// garde une marge : la traduction ne doit jamais produire un message que
// l'API refusera, sinon la conversion échoue et le message d'origine
// reste tel quel sans explication.
const MAX_COMPOSANTS = 38;
const MAX_CARACTERES = 3900;

/** Compte les composants d'un arbre, accessoires compris — c'est ce que Discord additionne. */
function compterComposants(noeud) {
  return (
    1 +
    (noeud.components ?? []).reduce((total, enfant) => total + compterComposants(enfant), 0) +
    (noeud.accessory ? 1 : 0)
  );
}

/** Les rangées de boutons/menus d'un message, reconstruites à l'identique. */
function rangeesInteractives(message) {
  const rangees = [];
  for (const composant of message.components ?? []) {
    if (composant.type !== ComponentType.ActionRow) continue;
    try {
      rangees.push(ActionRowBuilder.from(composant));
    } catch {
      // Rangée illisible (composant d'une version plus récente) : on
      // préfère la perdre que de faire échouer toute la conversion.
    }
  }
  return rangees;
}

/**
 * V1 -> V2. Tout le texte (contenu + chaque embed) devient des blocs de
 * texte, les boutons restent en rangées à l'intérieur du conteneur.
 */
function versV2(message) {
  const embeds = message.embeds ?? [];
  const conteneur = new ContainerBuilder();
  // La barre de couleur du conteneur reprend celle du premier embed qui en a une.
  const couleur = embeds.find((e) => typeof e?.color === 'number')?.color;
  if (typeof couleur === 'number') conteneur.setAccentColor(couleur);

  const texte = (contenu) => conteneur.addTextDisplayComponents(new TextDisplayBuilder().setContent(String(contenu).slice(0, 4000)));
  const trait = () => conteneur.addSeparatorComponents(new SeparatorBuilder());

  // Le contenu texte du message : V2 interdit `content`, il faut donc le
  // faire entrer dans le conteneur sous peine de le perdre.
  if (message.content) texte(message.content);

  // Tous les embeds, pas seulement le premier : un message peut en porter
  // jusqu'à dix, et n'en convertir qu'un perdrait le reste.
  embeds.forEach((embed, index) => {
    // Trait entre deux embeds : ils étaient des blocs distincts.
    if (index > 0 || message.content) trait();

    // L'en-tête forme un seul bloc de lecture (titre puis intro), alors
    // que chaque champ était visuellement détaché dans l'embed d'origine
    // — sans trait entre eux, la conversion donnait un pavé d'un tenant.
    if (embed?.title) texte(`## ${embed.title}`);
    if (embed?.description) texte(embed.description);

    for (const champ of embed?.fields ?? []) {
      trait();
      texte(`**${champ.name}**\n${champ.value}`);
    }

    const image = embed?.image?.url ?? embed?.thumbnail?.url;
    if (image) {
      conteneur.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(image)));
    }

    if (embed?.footer?.text) {
      trait();
      texte(`-# ${embed.footer.text}`);
    }
  });

  for (const rangee of rangeesInteractives(message)) {
    conteneur.addActionRowComponents(rangee);
  }

  const json = conteneur.toJSON();
  if (compterComposants(json) > MAX_COMPOSANTS || JSON.stringify(json).length > MAX_CARACTERES) {
    throw new Error('ce message est trop gros pour tenir en version 2 (limite Discord de 40 composants / 4000 caractères)');
  }

  return { content: '', embeds: [], components: [conteneur], flags: MessageFlags.IsComponentsV2 };
}

/** Le texte d'un composant V2, quel que soit son emballage. */
function extraireTextes(noeud, recolte) {
  if (noeud.type === ComponentType.TextDisplay && noeud.content) recolte.push(noeud.content);
  for (const enfant of noeud.components ?? []) extraireTextes(enfant, recolte);
}

/**
 * V2 -> V1. Les blocs de texte redeviennent titre / description / pied de
 * page, les boutons repassent en rangées sous l'embed.
 *
 * Le titre est la première ligne en `##`, le pied de page la dernière en
 * `-#` : c'est exactement ce que produit versV2, donc un aller-retour
 * retombe sur ses pieds.
 */
function versV1(message) {
  const conteneur = message.components?.find((c) => c.type === ComponentType.Container) ?? { components: message.components ?? [] };

  const textes = [];
  for (const enfant of conteneur.components ?? []) extraireTextes(enfant, textes);

  let titre = null;
  let pied = null;
  const description = [];

  for (const texte of textes) {
    if (!titre && texte.startsWith('## ')) {
      titre = texte.slice(3).trim();
      continue;
    }
    if (texte.startsWith('-# ')) {
      pied = texte.slice(3).trim();
      continue;
    }
    description.push(texte);
  }

  const embed = new EmbedBuilder();
  // discord.js expose accentColor sur l'objet composant, mais le JSON brut
  // de l'API porte accent_color : selon d'où vient le message on tombe
  // sur l'un ou l'autre.
  const couleur = conteneur.accentColor ?? conteneur.accent_color ?? conteneur.data?.accent_color;
  if (typeof couleur === 'number') embed.setColor(couleur);
  if (titre) embed.setTitle(titre.slice(0, 256));
  if (pied) embed.setFooter({ text: pied.slice(0, 2048) });

  const corps = description.join('\n\n').slice(0, 4096);
  // Un embed sans titre, sans description ni pied serait refusé par
  // Discord : on met un caractère invisible plutôt que d'échouer sur un
  // panneau qui n'aurait eu que des boutons.
  if (corps) embed.setDescription(corps);
  else if (!titre && !pied) embed.setDescription('​');

  // Les boutons des Sections (accessoires) n'ont pas de place en V1 : ils
  // redeviennent une rangée de boutons classique, sous l'embed.
  const boutonsAccessoires = [];
  for (const enfant of conteneur.components ?? []) {
    if (enfant.type === ComponentType.Section && enfant.accessory?.type === ComponentType.Button) {
      boutonsAccessoires.push(enfant.accessory);
    }
  }

  const rangees = rangeesInteractives({ components: conteneur.components });
  for (let i = 0; i < boutonsAccessoires.length; i += 5) {
    const groupe = boutonsAccessoires.slice(i, i + 5);
    try {
      rangees.push(new ActionRowBuilder().addComponents(groupe.map((b) => ({ ...b }))));
    } catch {
      // Bouton irrécupérable : on continue sans lui plutôt que de perdre
      // toute la conversion.
    }
  }

  return { content: '', embeds: [embed], components: rangees.slice(0, 5), flags: 0 };
}

module.exports = { versV1, versV2 };
