"""国内地图瓦片。未配置密钥时关闭。不使用 OpenStreetMap。"""
from __future__ import annotations

OSM_MARKERS = ("openstreetmap.org", "tile.openstreetmap")


def map_tiles(settings=None) -> dict:
    from app.config import settings as default_settings

    cfg = settings or default_settings
    if (getattr(cfg, "APP_EDITION", "") or "").lower() != "cn":
        return {"enabled": False, "reason": "not-cn", "provider": ""}
    url = (getattr(cfg, "MAP_TILE_URL", "") or "").lower()
    if any(marker in url for marker in OSM_MARKERS):
        return {"enabled": False, "reason": "osm-blocked", "provider": "disabled"}
    provider = (getattr(cfg, "MAP_TILE_PROVIDER", "") or "").strip().lower()
    if provider in {"tianditu", "天地图"}:
        if not (getattr(cfg, "TIANDITU_KEY", None) or "").strip():
            return {"enabled": False, "reason": "key-unset", "provider": "tianditu"}
        return {
            "enabled": True,
            "provider": "tianditu",
            "template": "https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk={key}",
        }
    if provider in {"amap", "gaode", "高德"}:
        if not (getattr(cfg, "GAODE_MAP_KEY", None) or "").strip():
            return {"enabled": False, "reason": "key-unset", "provider": "amap"}
        return {
            "enabled": True,
            "provider": "amap",
            "template": "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
        }
    return {"enabled": False, "reason": "unset", "provider": provider}
