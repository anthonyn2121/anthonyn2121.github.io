/**
 * ─────────────────────────────────────────────────────────────────────────
 *  The myths on the "Above the skies" page. Each story belongs to one
 *  constellation; adding one makes that constellation glow on the chart
 *  and join the story list.
 * ─────────────────────────────────────────────────────────────────────────
 */

export interface MythSource {
  /** Author, e.g. "Hyginus". */
  author: string;
  /** Work, e.g. "De Astronomia". */
  work: string;
  /** Book, chapter, or line reference, e.g. "2.34". */
  ref: string;
}

export interface Story {
  /** IAU abbreviation used in the sky data, e.g. "Ori" or "CVn". */
  id: string;
  /** Stories that share a group are listed together, in the order they appear here. */
  group: string;
  /** Short title for the story list, e.g. "Orion and Artemis". */
  title: string;
  /** Who the figure is. Greek names first, Roman names in brackets. */
  figure: string;
  /** The retelling, one string per paragraph. */
  story: string[];
  /** Where the myth comes from. */
  sources: MythSource[];
}

export const myths: Story[] = [
  {
    id: "Ori",
    group: "Artemis and the hunt",
    title: "Orion and Artemis",
    figure:
      "Orion was a giant hunter, called a son of Poseidon (Neptune) by Hesiod, who became the hunting companion of Artemis (Diana).",
    story: [
      "Orion was the greatest hunter of the early world, a giant who could walk across the waves. After King Oenopion of Chios blinded him for assaulting his daughter Merope, he found his way east and was healed by the rays of the Sun. He then went to Crete and hunted beside Artemis (Diana) and her mother Leto (Latona). Ovid calls him the goddess's companion, her guard and attendant. In Hyginus's telling, Artemis loved him and came close to marrying him.",
      "The ancient writers could not agree on how he died. In one version Orion boasted to Artemis and Leto that he could kill every beast the earth produced. Gaia (Terra), the Earth herself, took offence and sent up a giant scorpion, which stung him to death. Others say Artemis sent the scorpion herself. Hyginus, following the historian Istros, gives a crueller story. Apollo disliked his sister's love for Orion. One day, when Orion was swimming far out to sea, Apollo pointed to a dark speck among the waves and wagered that Artemis could not hit it. Proud of her aim, she shot and pierced Orion's head. The waves carried his body to the shore, and she mourned him with many tears.",
      "The oldest account is Homer's. In the Odyssey the gods resent Eos (Aurora), the Dawn, for taking Orion as her lover, until Artemis kills him with her gentle arrows on Ortygia. Every version ends in the sky. Pseudo-Eratosthenes says Zeus (Jupiter) placed Orion among the stars at the wish of Artemis and Leto, and the scorpion with him as a memorial. Hyginus has Artemis place him there herself, grieving for the companion she had killed. Ovid credits Leto, because Orion died shielding her from the scorpion's sting.",
    ],
    sources: [
      { author: "Homer", work: "Odyssey", ref: "5.121–124" },
      { author: "Hyginus", work: "De Astronomia", ref: "2.26.2; 2.34.3–4" },
      { author: "Pseudo-Eratosthenes", work: "Catasterismi", ref: "32" },
      { author: "Ovid", work: "Fasti", ref: "5.537–544" },
    ],
  },
  {
    id: "Sco",
    group: "Artemis and the hunt",
    title: "The Scorpion's Sting",
    figure: "Scorpius is the giant scorpion that killed Orion, set in the sky opposite its victim.",
    story: [
      "The Scorpion is in the sky because of Orion. Almost every ancient account of the constellation is a story of his death, though the writers disagree about who sent it. In Pseudo-Eratosthenes and Hyginus, Orion boasted to Artemis (Diana) and her mother Leto (Latona) that he could kill any animal the earth produced. Gaia (Terra), the Earth herself, was angered and sent the scorpion to sting him. Hyginus says Zeus (Jupiter) admired the courage of both and set the scorpion among the stars as a lesson to men not to be too self-confident.",
      "Aratus, writing in the third century BC, blames Artemis. Orion was hunting on Chios for King Oenopion when he laid hands on the goddess's robe. She split open the hills of the island and roused the scorpion against him, and it stung and killed him, mighty as he was. Pseudo-Eratosthenes records the same version: the creature rose from a hill on Chios at Artemis's command. Ovid adds a twist in the Fasti. The scorpion was aiming at Leto, and Orion stood in its way.",
      "Whichever version is told, the ending is the same. The hunter and the scorpion were set on opposite sides of the sky. Aratus explains that when the Scorpion rises in the east, Orion flees below the western horizon. The chase is still played out across the sky.",
    ],
    sources: [
      { author: "Aratus", work: "Phaenomena", ref: "636–646" },
      { author: "Pseudo-Eratosthenes", work: "Catasterismi", ref: "7; 32" },
      { author: "Hyginus", work: "De Astronomia", ref: "2.26.2" },
      { author: "Ovid", work: "Fasti", ref: "5.539–544" },
    ],
  },
  {
    id: "CMa",
    group: "Artemis and the hunt",
    title: "Orion's Great Dog",
    figure:
      "Canis Major is the larger of Orion's hunting dogs, with Sirius, the brightest star in the night sky, in its jaws.",
    story: [
      "Aratus describes the Dog as Orion's guardian, standing on its hind legs behind the hunter with a star blazing at the tip of its fearsome jaw. That star is Sirius, the \"Scorcher\", whose rising at dawn marked the hottest part of the Greek summer. Pseudo-Eratosthenes and Hyginus record the simplest explanation. This was Orion's own hunting dog, and because its master loved the hunt, it was raised to the stars with him.",
      "The same writers give the dog a second identity. It was a gift from Zeus (Jupiter) to Europa, to guard her. It passed to Minos of Crete, who gave it to Procris after she cured him of an illness. Ovid tells it differently: Procris received the dog from Artemis (Diana) and gave it to her husband Cephalus. Ovid also gives it a name, Laelaps. No beast could outrun it.",
      "Then a fox began ravaging the country around Thebes, a beast fated never to be caught. Cephalus brought his hound to hunt it. A dog that caught everything it chased was now chasing a fox that could never be caught. Zeus settled the paradox. In Hyginus and Ovid he turned both animals to stone. In Pseudo-Eratosthenes he turned only the fox to stone and raised the dog to the stars.",
    ],
    sources: [
      { author: "Aratus", work: "Phaenomena", ref: "326–337" },
      { author: "Pseudo-Eratosthenes", work: "Catasterismi", ref: "33" },
      { author: "Hyginus", work: "De Astronomia", ref: "2.35.1–2" },
      { author: "Ovid", work: "Metamorphoses", ref: "7.753–793" },
    ],
  },
  {
    id: "CMi",
    group: "Artemis and the hunt",
    title: "The Little Dog",
    figure: "Canis Minor is Orion's smaller dog, marked by Procyon, the star that rises just before the Dog Star.",
    story: [
      "The Greeks called this constellation Procyon, \"before the Dog\", because its bright star rises shortly before Sirius in Canis Major. Originally it was little more than that single star. Pseudo-Eratosthenes identifies it as Orion's dog, placed beside the hunter because he loved the chase, with the Hare and other animals close by. Hyginus agrees that some take it for Orion's dog, and says it belongs to all the same stories as the greater Dog.",
      "Hyginus also preserves a sadder tale from Attica. Dionysus (Bacchus) taught a man named Icarius how to make wine. When Icarius shared it with some shepherds, they became so drunk that their companions thought he had poisoned them, and they killed him. His dog Maera ran home howling to his daughter Erigone. It caught her dress in its teeth and led her to the body. In her grief Erigone hanged herself from the tree beneath which her father lay buried, and the dog took its own life too. Some said it threw itself into a well.",
      'Zeus (Jupiter) pitied them and set all three in the sky. Icarius became Boötes, Erigone became Virgo, and the dog became Canicula, the "little dog", which the Greeks call Procyon. Hyginus notes that some credit Dionysus with placing them there. Hyginus also records that some identified the greater Dog as Icarius\'s dog instead.',
    ],
    sources: [
      { author: "Pseudo-Eratosthenes", work: "Catasterismi", ref: "42" },
      { author: "Hyginus", work: "De Astronomia", ref: "2.36.1" },
      { author: "Hyginus", work: "De Astronomia", ref: "2.4.3–4; 2.35.2" },
    ],
  },
  {
    id: "CVn",
    group: "Artemis and the hunt",
    title: "The Hunting Dogs",
    figure: "Canes Venatici is a pair of hunting dogs, Asterion and Chara, held on a leash by Boötes the herdsman.",
    story: [
      "Unlike its neighbours, Canes Venatici has no ancient myth. The Polish astronomer Johannes Hevelius formed it in 1687 from faint stars beneath the tail of the Great Bear, and it appeared in print in 1690 in his star catalogue and atlas. Ptolemy had listed its two brightest stars as loose stars outside the figure of the Bear, so they were free to be used in a new figure.",
      'Hevelius drew two greyhounds held on a leash by Boötes, the Bear-Watcher, snapping at the heels of the Great Bear. He named the northern dog Asterion, "starry", and the southern dog Chara, "dear", and made them male and female. The picture fits an old image: Aratus had likened Boötes to a man driving the Bear around the pole. In this later tradition the herdsman and his two dogs chase the Great Bear around the pole every night.',
      "The idea that Boötes owned dogs is older than Hevelius, and it seems to come from a mistake. Ptolemy's Almagest describes Boötes carrying a kollorobos, a herdsman's staff. The star-name scholar Paul Kunitzsch traced the dogs to the 12th-century Latin translation of an Arabic version of the Almagest. The translator, Gerard of Cremona, apparently misread al-kullāb, the crook, as al-kilāb, the dogs. Star charts by Petrus Apianus in the 1530s showed Boötes with dogs at his heels, and a globe by Willem Blaeu in 1602 set two dogs among these stars before Hevelius named them.",
    ],
    sources: [
      { author: "Ian Ridpath", work: "Star Tales", ref: '"Canes Venatici"' },
      { author: "Ian Ridpath", work: "Star Tales", ref: '"Boötes", note on Kunitzsch' },
    ],
  },
  {
    id: "UMa",
    group: "Artemis and the hunt",
    title: "Callisto, the Great Bear",
    figure:
      "Ursa Major is Callisto, a huntress in the band of Artemis (Diana), who was turned into a bear and set circling the pole.",
    story: [
      "Callisto, daughter of King Lycaon of Arcadia, joined the band of Artemis (Diana) and swore, like the goddess, to remain a virgin. Hyginus says she joined the goddess out of love for hunting, and Artemis loved her for their likeness of temperament. Zeus (Jupiter) desired her. In Ovid's version he came to her disguised as Artemis herself, and she could not escape him.",
      "Months later, as the huntresses bathed in a stream, Callisto's pregnancy was revealed, and Artemis drove her from the company. The ancient versions disagree about what came next. In the account Pseudo-Eratosthenes credits to Hesiod, Artemis turned her into a bear in anger. Ovid blames Hera (Juno), who transformed her rival after the birth of her son Arcas. In Apollodorus, Zeus made Callisto a bear to hide her from Hera, and Artemis shot her, either because Hera persuaded her or because Callisto had broken her vow.",
      "In Ovid's telling, Arcas grew up to be a hunter. One day he met a bear that stood still and stared at him as if she knew him. Not recognising his mother, he raised his spear. Zeus stopped him and swept mother and son into the sky as neighbouring stars: Callisto the Great Bear, and Arcas the Bear-Watcher, also called Boötes. Hera was furious. She asked Tethys and Ocean to bar the Bear from their waters, and so, the story goes, the Great Bear circles the pole and never bathes in the sea.",
    ],
    sources: [
      { author: "Ovid", work: "Metamorphoses", ref: "2.401–530" },
      { author: "Pseudo-Eratosthenes", work: "Catasterismi", ref: "1" },
      { author: "Hyginus", work: "De Astronomia", ref: "2.1.1–5" },
      { author: "Apollodorus", work: "Bibliotheca", ref: "3.8.2" },
    ],
  },
  {
    id: "Per",
    group: "Perseus and Andromeda",
    title: "Perseus and Medusa",
    figure:
      "Perseus was the son of Zeus (Jupiter) and Danaë, the hero who beheaded the Gorgon Medusa and rescued Andromeda.",
    story: [
      "Zeus (Jupiter) came to Danaë as a shower of gold, and she bore him a son, Perseus. Cast adrift in a chest, mother and son washed up on the island of Seriphus, whose king, Polydectes, wanted Danaë. Her grown son stood in the way. When Perseus boasted that he would not refuse the king even the Gorgon's head, Polydectes held him to it. He was to bring back the head of Medusa, the one mortal Gorgon, whose gaze turned people to stone.",
      "Hermes (Mercury) and Athena (Minerva) guided him. He seized the single eye shared by the Graeae and made them show him the way to the nymphs, who gave him winged sandals, a pouch and the cap of Hades, which made its wearer invisible. Apollodorus says Hermes gave him an adamantine sickle; Hyginus says it came from Hephaestus (Vulcan). Perseus found the Gorgons asleep. Looking only at Medusa's reflection in a bronze shield, he cut off her head. From her neck sprang the winged horse Pegasus and the warrior Chrysaor, her children by Poseidon (Neptune).",
      "On the way home through Ethiopia he found Andromeda chained to a rock for a sea monster. He killed the beast and married her. Later he turned his enemies to stone with the head, then gave it to Athena, who set it on her shield. Athena also gave Perseus a place among the stars. He stands next to Andromeda, Cassiopeia and Cepheus, holding the Gorgon's head, marked by the star Algol.",
    ],
    sources: [
      { author: "Apollodorus", work: "Bibliotheca", ref: "2.4.1–3" },
      { author: "Pseudo-Eratosthenes", work: "Catasterismi", ref: "22" },
      { author: "Hyginus", work: "De Astronomia", ref: "2.12.1" },
      { author: "Ovid", work: "Metamorphoses", ref: "4.770–786" },
    ],
  },
  {
    id: "And",
    group: "Perseus and Andromeda",
    title: "Andromeda Chained",
    figure:
      "Andromeda was the princess of Ethiopia chained to a sea cliff as an offering to a monster and rescued by Perseus.",
    story: [
      "Andromeda was the daughter of Cepheus, king of Ethiopia, and Queen Cassiopeia. Her mother boasted that she was more beautiful than the Nereids, the nymphs of the sea. Poseidon (Neptune) shared their anger and sent a flood and a sea monster against the land. The oracle of Ammon declared that the kingdom would be saved only if Andromeda was given to the monster. Under pressure from his people, Cepheus chained his daughter to a rock by the sea.",
      "Perseus was flying past, carrying the head of Medusa, when he saw her. Ovid says he took her for a marble statue until the breeze stirred her hair, and was so struck that he almost forgot to beat his wings. He asked for her hand as his reward, and her parents agreed, adding a kingdom as her dowry. When the monster came, Perseus attacked it from the air and killed it.",
      "Andromeda had been promised to her uncle Phineus, who plotted against Perseus and was turned to stone by the Gorgon's head. She then chose to leave her parents and homeland and go with Perseus to Argos. Pseudo-Eratosthenes says Athena (Minerva) placed her among the stars as a memorial of Perseus's labours, with her arms still outstretched as they were on the rock. Aratus remarks that even in heaven, chains are her lot.",
    ],
    sources: [
      { author: "Apollodorus", work: "Bibliotheca", ref: "2.4.3" },
      { author: "Ovid", work: "Metamorphoses", ref: "4.663–739" },
      { author: "Pseudo-Eratosthenes", work: "Catasterismi", ref: "17" },
      { author: "Aratus", work: "Phaenomena", ref: "197–204" },
    ],
  },
  {
    id: "Cas",
    group: "Perseus and Andromeda",
    title: "Cassiopeia's Boast",
    figure:
      "Cassiopeia was the queen of Ethiopia whose boast about her beauty brought a sea monster down on her kingdom.",
    story: [
      "Queen Cassiopeia, wife of King Cepheus of Ethiopia, claimed to be more beautiful than the Nereids, the nymphs of the sea. Apollodorus says she boasted that she was better than all of them. Aratus names two of the nymphs she offended, Doris and Panope. The Nereids were enraged, and Poseidon (Neptune) took up their cause. He flooded the land and sent a sea monster to ravage it.",
      "The oracle of Ammon declared that the land would be freed only if Cassiopeia's daughter Andromeda was given to the monster. So the queen's pride fell on her child. Andromeda was chained to a rock by the sea, until Perseus arrived, killed the monster and set her free. Sophocles told the story in a tragedy, now lost, that Pseudo-Eratosthenes cites.",
      "Cassiopeia was placed in the sky beside her family, seated on her throne. The heavens did not let her forget her boast. Hyginus says that because of her impiety she seems to be carried around the pole lying on her back. Aratus describes her plunging head-first like a diver as she sets, since she was never going to rival the Nereids unpunished. From northern latitudes the W shape of her brightest stars turns upside down as it circles the pole each night.",
    ],
    sources: [
      { author: "Apollodorus", work: "Bibliotheca", ref: "2.4.3" },
      { author: "Pseudo-Eratosthenes", work: "Catasterismi", ref: "16" },
      { author: "Hyginus", work: "De Astronomia", ref: "2.10.1" },
      { author: "Aratus", work: "Phaenomena", ref: "654–658" },
    ],
  },
  {
    id: "Cep",
    group: "Perseus and Andromeda",
    title: "King Cepheus",
    figure: "Cepheus was the king of Ethiopia, husband of Cassiopeia and father of Andromeda.",
    story: [
      'Cepheus ruled the Ethiopians. Hyginus reports that Euripides made him a son of Phoenix. Aratus calls him "Iasid Cepheus" and says his whole unhappy family reached the sky because they were close kin of Zeus (Jupiter). His queen, Cassiopeia, boasted that she was lovelier than the Nereids, and Poseidon (Neptune) punished the kingdom with a flood and a sea monster.',
      "The oracle of Ammon told Cepheus that the land would be saved only if he gave his daughter Andromeda to the monster. His people forced him to obey, and he bound her to a rock by the sea. When Perseus arrived and offered to kill the beast in return for her hand, Cepheus swore to the bargain. Perseus killed the monster and freed her.",
      "Andromeda had been promised to Cepheus's brother Phineus, who plotted against Perseus and was turned to stone by the Gorgon's head. Andromeda chose to leave her parents and go with her rescuer. Hyginus says the gods placed Cepheus among the stars so that the whole family would be remembered. Pseudo-Eratosthenes credits the decision to Athena (Minerva). Aratus pictures him behind the Little Bear with both his arms outstretched.",
    ],
    sources: [
      { author: "Pseudo-Eratosthenes", work: "Catasterismi", ref: "15" },
      { author: "Hyginus", work: "De Astronomia", ref: "2.9.1" },
      { author: "Aratus", work: "Phaenomena", ref: "179–187" },
      { author: "Apollodorus", work: "Bibliotheca", ref: "2.4.3" },
    ],
  },
  {
    id: "Cet",
    group: "Perseus and Andromeda",
    title: "The Sea Monster",
    figure:
      "Cetus is the sea monster that Poseidon (Neptune) sent to ravage Ethiopia, and to which Andromeda was offered.",
    story: [
      "Cetus is the monster of the Andromeda story. When Queen Cassiopeia boasted that she was more beautiful than the Nereids, Poseidon (Neptune) sent it against the kingdom of her husband Cepheus. The Greek name, kētos, meant any huge sea creature. In Latin, cetus means a whale, but star atlases usually draw a hybrid beast with gaping jaws, the forefeet of a land animal and a coiling, scaly tail.",
      "The oracle of Ammon told Cepheus that the land would be freed only if he exposed his daughter Andromeda to the monster, and she was chained to a rock on the shore. Ovid describes the beast cutting through the waves like a warship driven by sweating oarsmen. Perseus, returning from killing Medusa, rose into the air, swooped down on its back and struck it again and again with his sword until it died.",
      "Pseudo-Eratosthenes, citing Sophocles's lost play Andromeda, says the monster was placed among the stars as a reminder of Perseus's deed. Hyginus adds that it earned its place by its huge size and the hero's valour. Cetus is the fourth-largest constellation, sprawled low in the sky south of Andromeda. Aratus describes it pressing on her from the south, though she lies far away.",
    ],
    sources: [
      { author: "Pseudo-Eratosthenes", work: "Catasterismi", ref: "36" },
      { author: "Hyginus", work: "De Astronomia", ref: "2.31.1" },
      { author: "Ovid", work: "Metamorphoses", ref: "4.663–734" },
      { author: "Aratus", work: "Phaenomena", ref: "353–358" },
    ],
  },
  {
    id: "Peg",
    group: "Perseus and Andromeda",
    title: "Pegasus, the Winged Horse",
    figure: "Pegasus is the winged horse that sprang from Medusa when Perseus beheaded her.",
    story: [
      "When Perseus cut off the head of the Gorgon Medusa, two children sprang from her neck: the warrior Chrysaor and the winged horse Pegasus. Ovid says they were born of their mother's blood. Their father was Poseidon (Neptune). Hesiod says Poseidon lay with Medusa in a soft meadow among spring flowers. Ovid tells a darker story, in which Poseidon violated her in a temple of Athena (Minerva), and the goddess punished Medusa by turning her hair to snakes.",
      "Hesiod says Pegasus flew away from the earth to the home of the immortals, where he lives in the house of Zeus (Jupiter) and carries his thunder and lightning. Aratus tells how the horse gave Mount Helicon its spring. There was no water on the summit until Pegasus struck the rock with his hoof. The water that gushed out was called Hippocrene, the Horse's Spring.",
      "Hyginus adds the story of Bellerophon, who rode Pegasus against the fire-breathing Chimera. Bellerophon later tried to fly up to heaven, but grew afraid as he looked down at the earth, fell and was killed. The horse flew on and was placed among the constellations by Zeus. In the sky only the front half of the horse appears. Three of its bright stars and one shared with Andromeda's head mark the Great Square.",
    ],
    sources: [
      { author: "Hesiod", work: "Theogony", ref: "278–286" },
      { author: "Ovid", work: "Metamorphoses", ref: "4.785–786, 4.794–803" },
      { author: "Aratus", work: "Phaenomena", ref: "205–224" },
      { author: "Hyginus", work: "De Astronomia", ref: "2.18.1" },
    ],
  },
];
