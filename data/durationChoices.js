/**
 * durationChoices.js - options de durée standard (5 min, 10 min, 15 min,
 * 30 min, 1 heure, 1 jour), réutilisées par /mute, /timeout, /tempban.
 */
const DURATION_CHOICES = [
  { name: '5 minutes', value: '5m' },
  { name: '10 minutes', value: '10m' },
  { name: '15 minutes', value: '15m' },
  { name: '30 minutes', value: '30m' },
  { name: '1 heure', value: '1h' },
  { name: '1 jour', value: '1j' },
];

const DURATION_MS = {
  '5m': 5 * 60 * 1000,
  '10m': 10 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '1j': 24 * 60 * 60 * 1000,
};

const DURATION_LABEL = Object.fromEntries(DURATION_CHOICES.map((c) => [c.value, c.name]));

module.exports = { DURATION_CHOICES, DURATION_MS, DURATION_LABEL };
