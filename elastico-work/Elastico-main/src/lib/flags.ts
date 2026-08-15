/**
 * FIFA 3-letter country codes → ISO 3166-1 alpha-2 → real flag emoji
 * Uses Unicode regional indicator symbols — renders as actual flags on all modern browsers/OS.
 */

const FIFA_TO_ISO: Record<string, string> = {
  // Europe
  ALB: 'AL', AND: 'AD', ARM: 'AM', AUT: 'AT', AZE: 'AZ',
  BLR: 'BY', BEL: 'BE', BIH: 'BA', BUL: 'BG', CRO: 'HR',
  CYP: 'CY', CZE: 'CZ', DEN: 'DK', ENG: 'GB', EST: 'EE',
  FRO: 'FO', FIN: 'FI', FRA: 'FR', GEO: 'GE', GER: 'DE',
  GRC: 'GR', HUN: 'HU', ISL: 'IS', IRL: 'IE', ISR: 'IL',
  ITA: 'IT', KOS: 'XK', LVA: 'LV', LIE: 'LI', LTU: 'LT',
  LUX: 'LU', MLT: 'MT', MDA: 'MD', MNE: 'ME', NED: 'NL',
  MKD: 'MK', NOR: 'NO', POL: 'PL', POR: 'PT', ROU: 'RO',
  RUS: 'RU', SMR: 'SM', SCO: 'GB', SRB: 'RS', SVK: 'SK',
  SVN: 'SI', ESP: 'ES', SWE: 'SE', SUI: 'CH', TUR: 'TR',
  UKR: 'UA', WAL: 'GB',
  // South America
  ARG: 'AR', BOL: 'BO', BRA: 'BR', CHI: 'CL', COL: 'CO',
  ECU: 'EC', PAR: 'PY', PER: 'PE', URU: 'UY', VEN: 'VE',
  // North/Central America & Caribbean
  CAN: 'CA', CRC: 'CR', SLV: 'SV', GTM: 'GT', HON: 'HN',
  JAM: 'JM', MEX: 'MX', PAN: 'PA', USA: 'US', HAI: 'HT',
  TTO: 'TT', CUB: 'CU',
  // Africa
  ALG: 'DZ', CMR: 'CM', CGO: 'CG', EGY: 'EG', GHA: 'GH',
  CIV: 'CI', KEN: 'KE', MAR: 'MA', NGA: 'NG', SEN: 'SN',
  RSA: 'ZA', TUN: 'TN', UGA: 'UG', ZAM: 'ZM', GUI: 'GN',
  BEN: 'BJ', BFA: 'BF', CPV: 'CV', GAB: 'GA', GMB: 'GM',
  MLI: 'ML', MOZ: 'MZ', NAM: 'NA', NER: 'NE', RWA: 'RW',
  SDN: 'SD', TOG: 'TG', ANG: 'AO', BDI: 'BI', COD: 'CD',
  LBY: 'LY', MDG: 'MG', MRI: 'MU',
  // Asia
  AUS: 'AU', CHN: 'CN', IND: 'IN', IDN: 'ID', IRN: 'IR',
  IRQ: 'IQ', JPN: 'JP', KOR: 'KR', KSA: 'SA', KUW: 'KW',
  MAS: 'MY', PRK: 'KP', QAT: 'QA', KSA: 'SA', SYR: 'SY',
  THA: 'TH', UAE: 'AE', UZB: 'UZ', VIE: 'VN', JOR: 'JO',
  LBN: 'LB', PLE: 'PS', OMA: 'OM', BHR: 'BH', TKM: 'TM',
  KGZ: 'KG', TJK: 'TJ', MNG: 'MN', SIN: 'SG',
  // Oceania
  NZL: 'NZ', FIJ: 'FJ', PNG: 'PG', SOL: 'SB',
}

function isoToFlag(iso: string): string {
  const codePoints = iso
    .toUpperCase()
    .split('')
    .map(char => 0x1F1E6 + char.charCodeAt(0) - 65)
  return String.fromCodePoint(...codePoints)
}

/**
 * Convert a FIFA 3-letter country code to a real flag emoji.
 * Falls back to the original code if not found.
 */
export function fifaFlag(fifaCode: string | null | undefined): string {
  if (!fifaCode) return ''
  const iso = FIFA_TO_ISO[fifaCode.toUpperCase()]
  if (!iso) return fifaCode // unknown code — show as-is
  return isoToFlag(iso)
}
