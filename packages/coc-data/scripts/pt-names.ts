/**
 * Nomes pt-BR OFICIAIS do jogo, por chave interna do catálogo.
 *
 * Fonte: o próprio `texts.csv` do jogo (coluna PT, via mirror datamine Statscell) + páginas
 * oficiais da Supercell / coc.guide para o conteúdo mais novo que o mirror ainda não cobre.
 * NÃO são traduções livres — são as strings que o jogo exibe em português.
 *
 * Cobertura: todas as tropas, feitiços e heróis + parte dos pets. Pendentes (caem no nome EN
 * público até serem preenchidos): máquinas de cerco novas, Ice Block, Thrower, 6 pets e os
 * equipamentos de herói. Tudo que falta só aparece bem acima do CV6. Ver docs/HANDOFF §6.
 */
export const PT_NAMES: Readonly<Record<string, string>> = {
  // ─── Tropas de elixir ───
  barbarian: "Bárbaro",
  archer: "Arqueira",
  goblin: "Goblin",
  giant: "Gigante",
  "wall-breaker": "Destruidor de Muros",
  balloon: "Balão",
  wizard: "Mago",
  healer: "Curadora",
  dragon: "Dragão",
  pekka: "P.E.K.K.A",
  babydragon: "Bebê Dragão",
  miner: "Mineiro",
  "electro-dragon": "Dragão Elétrico",
  yeti: "Yeti",
  "dragon-rider": "Dragão Dirigível",
  "electro-titan": "Titã Elétrica",
  "root-rider": "Poderosa Hera",
  // ─── Tropas de elixir negro ───
  gargoyle: "Servo", // Minion
  "boar-rider": "Corredor", // Hog Rider
  "warrior-girl": "Valquíria",
  golem: "Golem",
  warlock: "Bruxa", // Witch
  airdefenceseeker: "Lava Hound",
  bowler: "Lançador",
  "ice-golem": "Golem de Gelo",
  headhunter: "Caçadora de Heróis",
  "apprentice-warden": "Guardião Aprendiz",
  "druid-healer": "Druida",
  furnace: "Fornalha",
  // ─── Feitiços ───
  lighningstorm: "Feitiço de Relâmpago",
  healingwave: "Feitiço de Cura",
  haste: "Feitiço de Fúria", // Rage Spell
  jump: "Feitiço de Salto",
  freeze: "Feitiço de Gelo",
  poison: "Feitiço de Veneno",
  earthquake: "Feitiço de Terremoto",
  speedup: "Feitiço de Aceleração", // Haste Spell
  spawnskele: "Feitiço de Esqueleto",
  duplicate: "Feitiço de Clone",
  invisibility: "Feitiço de Invisibilidade",
  recall: "Feitiço de Retorno",
  spawnbats: "Feitiço Morcego",
  overgrowth: "Feitiço de Raízes",
  revive: "Feitiço de Reanimação",
  // ─── Máquinas de cerco ───
  "siege-machine-ram": "Quebra-muros", // Wall Wrecker
  "siege-machine-flyer": "Dirigível Bélico", // Battle Blimp
  "siege-bowler-balloon": "Quebradora de Pedras", // Stone Slammer
  "siege-machine-carrier": "Quartel de Cerco", // Siege Barracks
  "siege-log-launcher": "Lançador de Troncos",
  "battle-drill": "Escavadeira Bélica",
  // ─── Heróis ───
  "barbarian-king": "Rei Bárbaro",
  "archer-queen": "Rainha Arqueira",
  "grand-warden": "Grande Guardião",
  "warrior-princess": "Campeã Real", // Royal Champion
  "minion-hero": "Príncipe Servo", // Minion Prince
  // ─── Pets (parcial) ───
  bulldozer: "Poderoso Iaque", // Mighty Yak
  electrowl: "Coruja Elétrica",
  unipony: "Unicórnio",
  barky: "L.A.S.S.I",
  turtle: "L.A.S.S.I",
};
