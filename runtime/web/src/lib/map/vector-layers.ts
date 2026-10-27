import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface MapFeature {
  type: 'Feature';
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
}

export interface MapLayer {
  id: string;
  title: string;
  kind: 'grid' | 'land' | string;
  features: MapFeature[];
  empty: boolean;
  message: string;
}

const EMPTY = '这一层还没有导入要素。空状态不是实测并网点或用地边界。';

export function layerStorePath() {
  return process.env.NENGJIAN_MAP_LAYER_STORE?.trim()
    || join(process.cwd(), 'src/data/map-layers.json');
}

export function readMapLayers(path = layerStorePath()) {
  let payload: { license_note?: string; layers?: Array<{ id: string; title: string; kind: string; features?: MapFeature[] }> };
  try {
    payload = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    payload = { license_note: '图层文件尚未就绪。', layers: [] };
  }
  const layers: MapLayer[] = (payload.layers || []).map((layer) => {
    const features = Array.isArray(layer.features) ? layer.features : [];
    return {
      id: layer.id,
      title: layer.title,
      kind: layer.kind,
      features,
      empty: features.length === 0,
      message: features.length === 0 ? EMPTY : `已载入 ${features.length} 个要素。`,
    };
  });
  return {
    licenseNote: payload.license_note || '',
    layers,
    empty: layers.every((layer) => layer.empty),
  };
}

export function importMapLayer(input: { id: string; title?: string; kind?: string; licenceNote?: string; featureCollection: unknown }, path = layerStorePath()) {
  const note = String(input.licenceNote || '').trim();
  if (note.length < 8) throw new Error('请填写许可说明，确认这些矢量允许保存在本系统');
  const collection = input.featureCollection as { type?: string; features?: MapFeature[] };
  if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
    throw new Error('请提交 GeoJSON FeatureCollection');
  }
  if (collection.features.length > 5000) throw new Error('单次最多导入 5000 个要素');
  for (const feature of collection.features) {
    if (feature?.type !== 'Feature' || !feature.geometry?.type) throw new Error('每个要素都要有几何类型');
  }
  const current = readMapLayers(path);
  const id = input.id === 'land-use' ? 'land-use' : 'grid-connection';
  const layers = [
    { id: 'grid-connection', title: '并网点', kind: 'grid', features: [] as MapFeature[] },
    { id: 'land-use', title: '用地边界', kind: 'land', features: [] as MapFeature[] },
  ];
  for (const layer of current.layers) {
    const slot = layers.find((item) => item.id === layer.id);
    if (slot) slot.features = layer.features;
  }
  const slot = layers.find((item) => item.id === id)!;
  slot.features = collection.features;
  if (input.title) slot.title = input.title;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({
    license_note: note,
    layers,
  }, null, 2));
  return readMapLayers(path);
}
