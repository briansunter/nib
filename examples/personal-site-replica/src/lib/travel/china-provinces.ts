export const CHINA_PROVINCE_META = {
  AH: { adminCode: '340000', name: 'Anhui' },
  BJ: { adminCode: '110000', name: 'Beijing' },
  CQ: { adminCode: '500000', name: 'Chongqing' },
  FJ: { adminCode: '350000', name: 'Fujian' },
  GD: { adminCode: '440000', name: 'Guangdong' },
  GS: { adminCode: '620000', name: 'Gansu' },
  GX: { adminCode: '450000', name: 'Guangxi' },
  GZ: { adminCode: '520000', name: 'Guizhou' },
  HA: { adminCode: '410000', name: 'Henan' },
  HB: { adminCode: '420000', name: 'Hubei' },
  HE: { adminCode: '130000', name: 'Hebei' },
  HI: { adminCode: '460000', name: 'Hainan' },
  HK: { adminCode: '810000', name: 'Hong Kong' },
  HL: { adminCode: '230000', name: 'Heilongjiang' },
  HN: { adminCode: '430000', name: 'Hunan' },
  JL: { adminCode: '220000', name: 'Jilin' },
  JS: { adminCode: '320000', name: 'Jiangsu' },
  JX: { adminCode: '360000', name: 'Jiangxi' },
  LN: { adminCode: '210000', name: 'Liaoning' },
  MO: { adminCode: '820000', name: 'Macau' },
  NM: { adminCode: '150000', name: 'Inner Mongolia' },
  NX: { adminCode: '640000', name: 'Ningxia' },
  QH: { adminCode: '630000', name: 'Qinghai' },
  SC: { adminCode: '510000', name: 'Sichuan' },
  SD: { adminCode: '370000', name: 'Shandong' },
  SH: { adminCode: '310000', name: 'Shanghai' },
  SN: { adminCode: '610000', name: 'Shaanxi' },
  SX: { adminCode: '140000', name: 'Shanxi' },
  TJ: { adminCode: '120000', name: 'Tianjin' },
  TW: { adminCode: '710000', name: 'Taiwan' },
  XJ: { adminCode: '650000', name: 'Xinjiang' },
  XZ: { adminCode: '540000', name: 'Tibet' },
  YN: { adminCode: '530000', name: 'Yunnan' },
  ZJ: { adminCode: '330000', name: 'Zhejiang' },
} as const;

type ChinaProvinceMeta =
  (typeof CHINA_PROVINCE_META)[keyof typeof CHINA_PROVINCE_META];

const CHINA_PROVINCE_LOOKUP = CHINA_PROVINCE_META as Record<
  string,
  ChinaProvinceMeta
>;

const CHINA_PROVINCE_BY_ADMIN_CODE: Map<string, ChinaProvinceMeta> = new Map(
  Object.values(CHINA_PROVINCE_META).map((province) => [
    province.adminCode,
    province,
  ]),
);

export function normalizeChinaProvinceCode(
  code: string | undefined,
): string | undefined {
  const normalized = code?.trim().toUpperCase().replace(/^CN-/, '');
  return normalized || undefined;
}

export function getChinaProvinceMeta(
  code: string,
): ChinaProvinceMeta | undefined {
  return CHINA_PROVINCE_LOOKUP[code];
}

export function getChinaProvinceNameByAdminCode(
  adminCode: string,
): string | undefined {
  return CHINA_PROVINCE_BY_ADMIN_CODE.get(adminCode)?.name;
}
