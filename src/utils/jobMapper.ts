import { BASE_HOST, API_BASE_URL } from '../services/api';

function resolveLogoUrl(path?: string): any {
  if (!path) return require('../../assets/logokarakalem.png');
  if (path.startsWith('data:image')) return { uri: path };

  const fullUrl = path.startsWith('http')
    ? path
    : path.startsWith('/uploads')
    ? `${BASE_HOST}${path}`
    : null;

  if (fullUrl) {
    const separator = fullUrl.includes('?') ? '&' : '?';
    return { uri: `${fullUrl}${separator}v=${Date.now()}` };
  }

  return { uri: `data:image/png;base64,${path}` };
}

const isOfferVisible = (o: any): boolean => {
  const vis = o.isVisible ?? o.IsVisible;
  if (vis === undefined || vis === null) return true;
  return vis !== false && vis !== 0 && vis !== 'false';
};

export const mapJobFromApi = (item: any) => {
  // ─── Hafriyat/Döküm: dumps (döküm yeri + nakit + mazot) ──────────────────
  let dumps: { place: string; cash: string; fuel: string }[] = [];

  if (item.jobType !== 1) {
    let usedNewFormat = false;

    if (item.extraOffersJson) {
      try {
        const parsed = JSON.parse(item.extraOffersJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasIsVisible = 'isVisible' in parsed[0] || 'IsVisible' in parsed[0];
          if (hasIsVisible) {
            // Yeni format: isVisible alanına göre filtrele — fallback'e düşme
            usedNewFormat = true;
            dumps = parsed
              .filter(isOfferVisible)
              .map((o: any) => ({
                place: o.name || o.Name || '-',
                cash: o.cash ? `${o.cash}₺` : '-',
                fuel: o.fuel ? `${o.fuel} LT` : '-',
              }));
          } else {
            // Eski extras format: Offer1 + Offer2 + extras birleştir
            if (item.offer1Name) {
              dumps.push({
                place: item.offer1Name,
                cash: item.offer1Cash ? `${item.offer1Cash}₺` : '-',
                fuel: item.offer1Fuel ? `${item.offer1Fuel} LT` : '-',
              });
            }
            if (item.offer2Name) {
              dumps.push({
                place: item.offer2Name,
                cash: item.offer2Cash ? `${item.offer2Cash}₺` : '-',
                fuel: item.offer2Fuel ? `${item.offer2Fuel} LT` : '-',
              });
            }
            parsed.forEach((o: any) => {
              dumps.push({
                place: o.dumpLocation || o.name || o.Name || '-',
                cash: o.cash ? `${o.cash}₺` : '-',
                fuel: o.fuel ? `${o.fuel} LT` : '-',
              });
            });
          }
        }
      } catch (e) {
        console.log('extraOffersJson parse error', e);
      }
    }

    // Fallback: yalnızca yeni format kullanılmadıysa (eski veri veya parse hatası)
    if (!usedNewFormat && dumps.length === 0) {
      if (item.offer1Name) {
        dumps.push({
          place: item.offer1Name,
          cash: item.offer1Cash ? `${item.offer1Cash}₺` : '-',
          fuel: item.offer1Fuel ? `${item.offer1Fuel} LT` : '-',
        });
      }
      if (item.offer2Name) {
        dumps.push({
          place: item.offer2Name,
          cash: item.offer2Cash ? `${item.offer2Cash}₺` : '-',
          fuel: item.offer2Fuel ? `${item.offer2Fuel} LT` : '-',
        });
      }
    }
  }

  // ─── Kum/Mıcır: routes (yükleme → boşaltma, ₺/ton, malzeme) ─────────────
  let routes: { loading: string; unloading: string; cash: string; material: string }[] = [];

  if (item.jobType === 1 && item.extraOffersJson) {
    try {
      const parsed = JSON.parse(item.extraOffersJson);
      if (Array.isArray(parsed)) {
        routes = parsed
          .filter((r: any) => r.loading !== undefined || r.Loading !== undefined)
          .map((r: any) => ({
            loading: r.loading || r.Loading || '-',
            unloading: r.unloading || r.Unloading || '-',
            cash: r.cash != null ? `${r.cash}₺/ton` : '-',
            material: r.material || r.Material || '-',
          }));
      }
    } catch (e) {
      console.log('extraOffersJson (kum/mıcır) parse error', e);
    }
  }

  return {
    id: item.id,
    ownerUserId: item.ownerUserId,
    company: item.companyName,
    site: item.name,
    jobType: item.jobType,
    loadingStartTime: item.loadingStartTime,
    loadingEndTime: item.loadingEndTime,
    logo: resolveLogoUrl(item.companyLogoPath ?? item.companyLogoBase64),

    dumps,
    routes,

    status: (item.isActive ?? item.IsActive) ? 'Yükleme Devam Ediyor' : 'Pasif',
    statusColor: (item.isActive ?? item.IsActive) ? '#C8E6C9' : '#FFE0E0',

    phone: item.contactPhone,
    locationUrl: item.locationUrl,
    description: item.description,
    signDescription: item.signDescription,
    provinceCode: item.provinceCode,
    provinceName: item.provinceName ?? '',
    districtName: item.districtName ?? '',
    isActive: item.isActive ?? item.IsActive ?? false,
  };
};
