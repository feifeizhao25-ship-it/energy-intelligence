'use client';

import React, { useEffect, useRef, useState } from 'react';
import DomesticTileMap from './DomesticTileMap';

// 设置高德地图安全配置
if (typeof window !== 'undefined') {
    const securityCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE;
    if (securityCode && securityCode.trim()) {
        (window as any)._AMapSecurityConfig = {
            securityJsCode: securityCode,
        };
    }
}

interface ResourceMapProps {
    layer: string;
    mapStyle: string;
    onSelectLocation: (location: any) => void;
}

/**
 * 高德地图加载失败时的提示。国内版不再自动切换到境外地图与地名服务（OSM 瓦片、境外 CDN 上的 Leaflet、Nominatim）：
 * 这些服务境内常不可达，而且会把用户查询的位置发往境外。这里只提示「地图服务暂不可用」，并允许手动输入经纬度继续。
 */
export const MAP_UNAVAILABLE_TEXT = '地图服务暂不可用';
export const MAP_KEY_UNSET_TEXT = '地图未配置密钥，请直接填写经纬度';

const MapUnavailable = ({ onSelect, keyUnset = false }: { onSelect: (location: { lat: number; lng: number; name: string }) => void; keyUnset?: boolean }) => {
    const [lat, setLat] = useState('');
    const [lng, setLng] = useState('');
    const latNum = Number(lat);
    const lngNum = Number(lng);
    const valid = lat !== '' && lng !== '' && Number.isFinite(latNum) && Number.isFinite(lngNum)
        && Math.abs(latNum) <= 90 && Math.abs(lngNum) <= 180;
    return (
        <div role="status" className="flex h-full w-full items-center justify-center bg-slate-100 p-6">
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg">
                <p className="text-base font-bold text-slate-800">{keyUnset ? MAP_KEY_UNSET_TEXT : MAP_UNAVAILABLE_TEXT}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">请稍后刷新重试，或直接输入项目经纬度继续查询。</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-left text-xs text-slate-600">
                    <label>纬度<input value={lat} onChange={e => setLat(e.target.value)} inputMode="decimal" placeholder="例如 32.06" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" /></label>
                    <label>经度<input value={lng} onChange={e => setLng(e.target.value)} inputMode="decimal" placeholder="例如 118.79" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" /></label>
                </div>
                <button type="button" disabled={!valid}
                    onClick={() => onSelect({ lat: latNum, lng: lngNum, name: `位置 (${latNum.toFixed(4)}, ${lngNum.toFixed(4)})` })}
                    className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">按经纬度查询</button>
            </div>
        </div>
    );
};

export default function ResourceMap({ layer, mapStyle, onSelectLocation }: ResourceMapProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<any>(null);
    const [AMap, setAMap] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isMock, setIsMock] = useState(false);
    const [keyUnset, setKeyUnset] = useState(false);
    const [domestic, setDomestic] = useState(false);
    const [resourceData, setResourceData] = useState<any[]>([]);
    const selectionMarkerRef = useRef<any>(null);

    useEffect(() => {
        let isMounted = true;
        let mapInstance: any = null;

        const initMap = async () => {
            // 设置 5 秒超时，加载不出来则提示「地图服务暂不可用」
            const timeoutId = setTimeout(() => {
                if (isLoading && isMounted) {
                    console.warn('高德地图加载超时');
                    setIsLoading(false);
                    setIsMock(true);
                }
            }, 5000);

            try {
                const status = await fetch('/api/map-tiles').then((response) => response.json()).catch(() => ({ enabled: false, reason: 'unset' }));
                if (!isMounted) return;
                if (status?.enabled) {
                    clearTimeout(timeoutId);
                    setDomestic(true);
                    setIsLoading(false);
                    return;
                }
                if (status?.reason === 'key-unset' || status?.reason === 'unset' || status?.reason === 'osm-blocked') {
                    clearTimeout(timeoutId);
                    setKeyUnset(true);
                    setIsLoading(false);
                    setIsMock(true);
                    return;
                }
                const { default: AMapLoader } = await import('@amap/amap-jsapi-loader');
                const AMapNamespace = await AMapLoader.load({
                    key: process.env.NEXT_PUBLIC_AMAP_KEY || '',
                    version: '2.0',
                    plugins: ['AMap.Geocoder', 'AMap.ToolBar', 'AMap.Scale', 'AMap.Geolocation', 'AMap.AutoComplete', 'AMap.PlaceSearch'],
                });

                clearTimeout(timeoutId);
                if (!isMounted) return;

                setAMap(AMapNamespace);

                mapInstance = new AMapNamespace.Map(mapContainer.current, {
                    zoom: 4,
                    center: [105, 38],
                    viewMode: '2D',
                    resizeEnable: true,
                    // 使用标准彩色地图样式，更符合普通用户习惯
                    mapStyle: 'amap://styles/normal',
                    features: ['bg', 'point', 'road', 'building']
                });

                // 为调试和自动化测试暴露 API
                (window as any).amapInstance = mapInstance;

                // 添加常用控件
                mapInstance.addControl(new AMapNamespace.Scale());
                mapInstance.addControl(new AMapNamespace.ToolBar({ position: 'RT' }));

                const geocoder = new AMapNamespace.Geocoder({
                    city: '全国',
                    extensions: 'base'
                });

                // 集成搜索功能
                const autoOptions = {
                    input: 'map-search-input',
                    outPutDir: 'map-search-result' // 指定输出容器以防 z-index 问题
                };
                const auto = new AMapNamespace.AutoComplete(autoOptions);
                const placeSearch = new AMapNamespace.PlaceSearch({
                    map: mapInstance
                });

                auto.on('select', (selectResult: any) => {
                    const poi = selectResult.poi;
                    if (poi.location) {
                        const { lng, lat } = poi.location;
                        onSelectLocation({
                            lat,
                            lng,
                            name: poi.name + (poi.address ? ' (' + poi.address + ')' : '')
                        });

                        if (selectionMarkerRef.current) mapInstance.remove(selectionMarkerRef.current);
                        const marker = new AMapNamespace.Marker({
                            position: [lng, lat],
                            icon: new AMapNamespace.Icon({
                                size: new AMapNamespace.Size(25, 34),
                                image: '//a.amap.com/jsapi_demos/static/demo-center/icons/poi-marker-default.png',
                                imageSize: new AMapNamespace.Size(25, 34)
                            })
                        });
                        mapInstance.add(marker);
                        selectionMarkerRef.current = marker;
                        mapInstance.setCenter([lng, lat]);
                        mapInstance.setZoom(12);
                    } else {
                        // 如果 POI 没有位置，使用名称搜索
                        placeSearch.search(poi.name);
                    }
                });

                // 添加定位功能
                const geolocation = new AMapNamespace.Geolocation({
                    enableHighAccuracy: true,
                    timeout: 10000,
                    offset: [10, 20],
                    zoomToAccuracy: true,
                    position: 'LB'
                });
                mapInstance.addControl(geolocation);

                // 默认进行一次定位
                geolocation.getCurrentPosition((status: string, result: any) => {
                    if (status === 'complete') {
                        console.log('定位成功', result.position);
                    }
                });

                // 点击地图选址
                mapInstance.on('click', async (e: any) => {
                    const { lng, lat } = e.lnglat;

                    // 定义一个通用的地址处理函数
                    const setAddress = (address: string) => {
                        if (selectionMarkerRef.current) {
                            mapInstance.remove(selectionMarkerRef.current);
                        }
                        const marker = new AMapNamespace.Marker({
                            position: [lng, lat],
                            title: address,
                            icon: new AMapNamespace.Icon({
                                size: new AMapNamespace.Size(25, 34),
                                image: '//a.amap.com/jsapi_demos/static/demo-center/icons/poi-marker-default.png',
                                imageSize: new AMapNamespace.Size(25, 34)
                            })
                        });
                        mapInstance.add(marker);
                        selectionMarkerRef.current = marker;
                        onSelectLocation({ lat, lng, name: address });
                    };

                    // 尝试高德地理解析
                    geocoder.getAddress([lng, lat], async (status: string, result: any) => {
                        if (status === 'complete' && result.regeocode) {
                            setAddress(result.regeocode.formattedAddress);
                        } else {
                            // 高德逆地理编码失败时只显示坐标，不再请求境外 Nominatim
                            setAddress(`位置 (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
                        }
                    });
                });

                // 处理搜索框回车键作为备选方案
                const searchInput = document.getElementById('map-search-input') as HTMLInputElement;
                // 回车搜索：用高德 PlaceSearch，不再请求境外 Nominatim
                const handleSearch = (e: KeyboardEvent) => {
                    if (e.key === 'Enter' && searchInput.value) placeSearch.search(searchInput.value);
                };

                if (searchInput) {
                    searchInput.addEventListener('keydown', handleSearch);
                }

                setMap(mapInstance);
                setIsLoading(false);

                // 瓦片渲染检测
                setTimeout(() => {
                    if (isMounted && mapInstance) {
                        const layers = mapInstance.getLayers();
                        if (!layers || layers.length === 0) {
                            setIsMock(true);
                        }
                    }
                }, 2000);

            } catch (e) {
                console.error('高德地图初始化失败', e);
                if (isMounted) {
                    setIsLoading(false);
                    setIsMock(true);
                }
            }
        };

        initMap();

        return () => {
            isMounted = false;
            if (mapInstance) mapInstance.destroy();
        };
        // 地图 SDK 只初始化一次；加载状态和父回调不应触发实例销毁重建。
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (domestic) {
        return (
            <DomesticTileMap onPick={(location) => onSelectLocation({
                lat: location.lat,
                lng: location.lng,
                name: `位置 (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})`,
            })} />
        );
    }

    if (isMock) {
        return <MapUnavailable onSelect={onSelectLocation} keyUnset={keyUnset} />;
    }

    return (
        <div className="w-full h-full relative">
            {isLoading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
                    <div className="text-white flex flex-col items-center">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                        <div className="font-medium">正在初始化标准地图...</div>
                    </div>
                </div>
            )}
            {/* 搜索结果容器 */}
            <div id="map-search-result" className="absolute top-20 left-10 z-[100] max-h-60 overflow-y-auto w-80 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-xl empty:hidden shadow-2xl text-white pointer-events-auto [&_.amap-sug-result]:bg-transparent [&_.amap-sug-result]:border-none [&_.amap-sug-result]:p-2 [&_.amap-sug-result:hover]:bg-white/10 [&_.amap-sug-result]:cursor-pointer [&_.amap-sug-result_.auto-item]:text-xs [&_.amap-sug-result_.auto-item-span]:text-slate-400"></div>

            <div
                ref={mapContainer}
                className="w-full h-full bg-slate-950"
            />
            {/* 浮动操作按钮支持定位 */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur-md border border-slate-200 px-6 py-2.5 rounded-full shadow-xl text-sm font-semibold text-slate-800 pointer-events-none transition-all group-hover:opacity-0">
                点击地图任意位置定位并搜索地址
            </div>
        </div>
    );
}
