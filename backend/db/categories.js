// ElStock — Category & Filter Definitions
// Each category has its own set of filters with fixed values

const BRANDS = [
  'Schneider Electric', 'Hager', 'Wago', 'Elko', 'Garo', 'Exxact', 'ABB', 'Plejd', 'Övrigt'
];

const CATEGORIES = [
  {
    id: 'kraftkablar',
    name: 'Kraftkablar',
    icon: '🔴',
    filters: [
      { id: 'type', label: 'Typ', values: ['EKKJ', 'FKKJ', 'MCMK', 'AMCMK', 'AXMK', 'AXKJ', 'Övrigt'] },
      { id: 'cross_section', label: 'Dimension (mm²)', values: ['1.5', '2.5', '4', '6', '10', '16', '25', '35', '50', '70', '95', '120'] },
      { id: 'cores', label: 'Antal ledare', values: ['2', '3', '4', '5'] },
    ]
  },
  {
    id: 'kopplingskablar',
    name: 'Kopplingskablar',
    icon: '🟠',
    filters: [
      { id: 'type', label: 'Typ', values: ['EKKX', 'ÖKK', 'SKX', 'Övrigt'] },
      { id: 'cross_section', label: 'Dimension (mm²)', values: ['0.5', '0.75', '1', '1.5', '2.5'] },
      { id: 'cores', label: 'Antal ledare', values: ['2', '3', '4', '5', '7', '12'] },
    ]
  },
  {
    id: 'installationskablar',
    name: 'Installationskablar',
    icon: '🟡',
    filters: [
      { id: 'type', label: 'Typ', values: ['EKK', 'EKKb', 'EKLK', 'Övrigt'] },
      { id: 'cross_section', label: 'Dimension (mm²)', values: ['1.5', '2.5', '4', '6', '10'] },
      { id: 'cores', label: 'Antal ledare', values: ['2', '3', '4', '5'] },
    ]
  },
  {
    id: 'datakabel',
    name: 'Datakabel',
    icon: '🔵',
    filters: [
      { id: 'type', label: 'Typ', values: ['Cat5e', 'Cat6', 'Cat6a', 'Cat7', 'Fiber', 'Övrigt'] },
      { id: 'shielding', label: 'Skärmning', values: ['UTP', 'FTP', 'STP', 'SFTP'] },
    ]
  },
  {
    id: 'kabelskarvar',
    name: 'Kabelskarvar & eltejp',
    icon: '⚡',
    filters: [
      { id: 'type', label: 'Typ', values: ['Skarvmuff', 'Eltejp', 'Självvulk. tejp', 'Krympslang', 'Övrigt'] },
      { id: 'color', label: 'Färg', values: ['Svart', 'Röd', 'Blå', 'Grön', 'Gul', 'Transparent'] },
    ]
  },
  {
    id: 'kontaktpressning',
    name: 'Kontaktpressning',
    icon: '🔧',
    filters: [
      { id: 'type', label: 'Typ', values: ['Kabelsko', 'Kabeländshylsa', 'Stifthylsa', 'Skarvskarv', 'Övrigt'] },
      { id: 'cross_section', label: 'Dimension (mm²)', values: ['0.5', '0.75', '1', '1.5', '2.5', '4', '6', '10', '16', '25', '35', '50'] },
    ]
  },
  {
    id: 'forlaggningsmateriel',
    name: 'Förläggningsmateriel',
    icon: '📦',
    filters: [
      { id: 'type', label: 'Typ', values: ['Kabelkanal', 'Kabelstege', 'Kabelkorg', 'Rör', 'Flex-rör', 'Kabelclips', 'Övrigt'] },
      { id: 'color', label: 'Färg', values: ['Vit', 'Grå', 'Svart'] },
      { id: 'size', label: 'Storlek', values: ['16mm', '20mm', '25mm', '32mm', '40mm', '50mm', '63mm', '75mm', '100mm', '150mm', '200mm'] },
    ]
  },
  {
    id: 'fastmateriel',
    name: 'Fästmateriel',
    icon: '🔩',
    filters: [
      { id: 'type', label: 'Typ', values: ['Skruv', 'Plugg', 'Bult', 'Bricka', 'Mutter', 'Kabelband', 'Bygel', 'Övrigt'] },
      { id: 'size', label: 'Storlek', values: ['M4', 'M5', 'M6', 'M8', 'M10', 'M12', '3.5x35', '4x40', '4x60', 'Övrigt'] },
    ]
  },
  {
    id: 'verktyg',
    name: 'Verktyg med tillbehör',
    icon: '🛠️',
    filters: [
      { id: 'type', label: 'Typ', values: ['Handverktyg', 'Mätinstrument', 'Borr', 'Bits', 'Knivar', 'Pressverktyg', 'Övrigt'] },
      { id: 'brand', label: 'Märke', values: BRANDS },
    ]
  },
  {
    id: 'ljusreglering',
    name: 'Ljusreglering & Detektorer',
    icon: '💡',
    filters: [
      { id: 'type', label: 'Typ', values: ['Dimmer', 'Ljusrelä', 'Rörelsedetektor', 'Närvarodetektor', 'Kopplingsur', 'Övrigt'] },
      { id: 'brand', label: 'Märke', values: BRANDS },
      { id: 'color', label: 'Färg', values: ['Vit', 'Svart', 'Grå', 'Titan'] },
      { id: 'voltage', label: 'Spänning', values: ['12V', '24V', '230V'] },
    ]
  },
  {
    id: 'stromstallare',
    name: 'Strömställare och Vägguttag',
    icon: '🔌',
    filters: [
      { id: 'type', label: 'Typ', values: ['Vägguttag 1-väg', 'Vägguttag 2-väg', 'Vägguttag 4-väg', 'Strömbrytare 1-väg', 'Strömbrytare 2-väg', 'Korsströmbrytare', 'Tryckknappsbrytare', 'Övrigt'] },
      { id: 'brand', label: 'Märke', values: BRANDS },
      { id: 'color', label: 'Färg', values: ['Vit', 'Svart', 'Grå', 'Titan', 'Aluminium'] },
      { id: 'grounding', label: 'Jordning', values: ['Jordad', 'Ojordad'] },
    ]
  },
  {
    id: 'anslutningsdon',
    name: 'Anslutningsdon & Uttagscentraler',
    icon: '🔗',
    filters: [
      { id: 'type', label: 'Typ', values: ['CEE-don 16A', 'CEE-don 32A', 'CEE-don 63A', 'Perilex', 'Uttacscentral', 'Skarvdon', 'Övrigt'] },
      { id: 'brand', label: 'Märke', values: BRANDS },
      { id: 'color', label: 'Färg', values: ['Blå (230V)', 'Röd (400V)', 'Gul (110V)', 'Svart'] },
      { id: 'ampere', label: 'Ampere', values: ['16A', '32A', '63A', '125A'] },
    ]
  },
  {
    id: 'sakringsmaterial',
    name: 'Säkringsmaterial',
    icon: '⚠️',
    filters: [
      { id: 'type', label: 'Typ', values: ['Automatsäkring', 'Jordfelsbrytare', 'Överspänningsskydd', 'Säkringshållare', 'NH-säkring', 'Kapslingssäkring', 'Övrigt'] },
      { id: 'brand', label: 'Märke', values: BRANDS },
      { id: 'ampere', label: 'Ampere', values: ['6A', '10A', '13A', '16A', '20A', '25A', '32A', '40A', '50A', '63A', '80A', '100A', '125A'] },
      { id: 'poles', label: 'Poler', values: ['1-pol', '2-pol', '3-pol', '4-pol'] },
      { id: 'curve', label: 'Karaktär', values: ['B', 'C', 'D', 'K'] },
    ]
  },
  {
    id: 'normmateriel',
    name: 'Normmateriel & Normkapslingar',
    icon: '🏠',
    filters: [
      { id: 'type', label: 'Typ', values: ['Apparatdosa', 'Kopplingsdosa', 'Infälldsdosa', 'Utanpåliggande dosa', 'Normkapsling', 'Övrigt'] },
      { id: 'brand', label: 'Märke', values: BRANDS },
      { id: 'color', label: 'Färg', values: ['Vit', 'Svart', 'Grå'] },
      { id: 'size', label: 'Storlek/Moduler', values: ['1M', '2M', '3M', '4M', '6M', '8M', '12M', 'Övrigt'] },
      { id: 'ip_class', label: 'IP-klass', values: ['IP20', 'IP44', 'IP54', 'IP65', 'IP67'] },
    ]
  },
];

module.exports = { CATEGORIES, BRANDS };
