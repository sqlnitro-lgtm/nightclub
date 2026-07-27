/**
 * prefixBridge.js - permet d'utiliser CHAQUE commande slash aussi en
 * préfixe ("&nomdelacommande arguments..."), sans dupliquer la logique :
 * on parse le texte selon les options déclarées dans le SlashCommandBuilder
 * (command.data), on construit un objet qui imite l'interface minimale
 * d'une interaction (options.getX(), reply(), etc.), et on appelle
 * directement command.execute(fauxInteraction).
 *
 * Limite assumée : pas de guillemets/échappement pour les arguments texte
 * multi-mots avant le dernier — comme sur la plupart des bots à préfixe,
 * seul le tout dernier argument "STRING sans choix" peut contenir des espaces
 * (il consomme le reste de la ligne).
 */

const OPTION_TYPE = { STRING: 3, INTEGER: 4, BOOLEAN: 5, USER: 6, CHANNEL: 7, ROLE: 8 };

function extractId(token) {
  const match = token?.match(/\d{17,20}/);
  return match ? match[0] : null;
}

/** true si `opt` est le DERNIER paramètre texte libre (STRING sans choix) de la liste — celui qui doit avaler le reste de la ligne, même si des options facultatives (ex. un nombre) le suivent encore dans la déclaration. */
function isTrailingFreeText(options, optIndex) {
  const opt = options[optIndex];
  if (opt.type !== OPTION_TYPE.STRING || opt.choices?.length) return false;
  return !options.slice(optIndex + 1).some((o) => o.type === OPTION_TYPE.STRING && !o.choices?.length);
}

/** Découpe le texte restant en jetons selon les options déclarées ; renvoie {values} ou {error}. */
function parseTokens(rawText, options) {
  const tokens = rawText.trim().length ? rawText.trim().split(/\s+/) : [];
  const values = {};
  let i = 0;

  for (let optIndex = 0; optIndex < options.length; optIndex++) {
    const opt = options[optIndex];
    const isLastOption = isTrailingFreeText(options, optIndex);

    if (i >= tokens.length) {
      if (opt.required) return { error: `Argument manquant : \`${opt.name}\`.` };
      continue;
    }

    if (opt.type === OPTION_TYPE.USER || opt.type === OPTION_TYPE.ROLE || opt.type === OPTION_TYPE.CHANNEL) {
      const id = extractId(tokens[i]);
      if (!id) {
        if (!opt.required) continue;
        return { error: `\`${opt.name}\` doit être une mention ou un ID valide.` };
      }
      values[opt.name] = { _refId: id, _refType: opt.type };
      i++;
    } else if (opt.type === OPTION_TYPE.INTEGER) {
      const n = Number(tokens[i]);
      if (!Number.isInteger(n)) {
        if (!opt.required) continue;
        return { error: `\`${opt.name}\` doit être un nombre entier.` };
      }
      values[opt.name] = n;
      i++;
    } else if (opt.type === OPTION_TYPE.BOOLEAN) {
      const raw = tokens[i].toLowerCase();
      values[opt.name] = raw === 'oui' || raw === 'true' || raw === '1';
      i++;
    } else if (opt.type === OPTION_TYPE.STRING) {
      if (opt.choices?.length) {
        const found = opt.choices.find((c) => c.value.toLowerCase() === tokens[i].toLowerCase());
        if (!found) {
          if (!opt.required) continue;
          return { error: `\`${opt.name}\` doit être l'une de ces valeurs : ${opt.choices.map((c) => c.value).join(', ')}.` };
        }
        values[opt.name] = found.value;
        i++;
      } else if (isLastOption) {
        values[opt.name] = tokens.slice(i).join(' ');
        i = tokens.length;
      } else {
        values[opt.name] = tokens[i];
        i++;
      }
    }
  }

  return { values };
}

/** Résout les références {_refId, _refType} en vrais objets Discord (User/Role/Channel). */
async function resolveValues(guild, client, rawValues) {
  const resolved = {};
  for (const [key, value] of Object.entries(rawValues)) {
    if (value && typeof value === 'object' && '_refId' in value) {
      if (value._refType === OPTION_TYPE.USER) {
        resolved[key] = await client.users.fetch(value._refId).catch(() => null);
      } else if (value._refType === OPTION_TYPE.ROLE) {
        resolved[key] = await guild.roles.fetch(value._refId).catch(() => null);
      } else if (value._refType === OPTION_TYPE.CHANNEL) {
        resolved[key] = await guild.channels.fetch(value._refId).catch(() => null);
      }
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

/** Imite les méthodes de CommandInteractionOptionResolver réellement utilisées par les commandes. */
class PrefixOptions {
  constructor(values) {
    this.values = values;
  }
  getUser(name) {
    return this.values[name] ?? null;
  }
  getRole(name) {
    return this.values[name] ?? null;
  }
  getChannel(name) {
    return this.values[name] ?? null;
  }
  getString(name) {
    return this.values[name] ?? null;
  }
  getInteger(name) {
    return this.values[name] ?? null;
  }
  getBoolean(name) {
    return this.values[name] ?? null;
  }
}

/** Imite l'interface minimale d'une ChatInputCommandInteraction utilisée par nos commandes. */
class PrefixInteraction {
  constructor(message, values) {
    this.guild = message.guild;
    this.member = message.member;
    this.user = message.author;
    this.channel = message.channel;
    this.client = message.client;
    this.options = new PrefixOptions(values);
    this.replied = false;
    this.deferred = false;
    this._message = message;
  }

  async reply(payload) {
    this.replied = true;
    const opts = typeof payload === 'string' ? { content: payload } : payload;
    return this._message.reply({ content: opts.content, embeds: opts.embeds }).catch(() => {});
  }

  async deferReply() {
    this.deferred = true;
  }

  async editReply(payload) {
    const opts = typeof payload === 'string' ? { content: payload } : payload;
    return this._message.channel.send({ content: opts.content, embeds: opts.embeds }).catch(() => {});
  }

  async followUp(payload) {
    return this.reply(payload);
  }
}

/**
 * Tente d'exécuter `command` (fichier de commande slash) à partir d'un
 * message préfixé. Retourne true si la commande a été traitée (même en
 * cas d'erreur d'argument affichée à l'utilisateur), false si ignorée.
 */
async function tryRunAsPrefix(command, message, rawArgsText) {
  const options = command.data.toJSON().options ?? [];
  const { values, error } = parseTokens(rawArgsText, options);
  if (error) {
    await message.reply(`❌ ${error}`).catch(() => {});
    return true;
  }

  const resolved = message.guild ? await resolveValues(message.guild, message.client, values) : values;
  const fakeInteraction = new PrefixInteraction(message, resolved);

  try {
    await command.execute(fakeInteraction);
  } catch (err) {
    console.error(`[prefix:${command.data.name}] Erreur :`, err);
    await message.reply('❌ Une erreur est survenue lors de l\'exécution de cette commande.').catch(() => {});
  }
  return true;
}

module.exports = { tryRunAsPrefix };
