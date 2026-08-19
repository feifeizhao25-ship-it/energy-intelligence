'use client';

import React, { useEffect, useRef, useState } from 'react';

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
 * Leaflet Fallback Map Component (OpenStreetMap)
 * 这是一个备用方案，当高德地图由于网络或其他原因无法加载时使用。
 * 它提供了一个“普通地图”外观和基本的交互功能。
 */
const LeafletFallbackMap = ({ onSelect }: { onSelect: any }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const [isLeafletLoaded, setIsLeafletLoaded] = useState(false);

    useEffect(() => {
        // 动态加载 Leaflet JS 和 CSS
        if (!document.getElementById('leaflet-css')) {
            const link = document.createElement('link');
            link.id = 'leaflet-css';
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        }

        if (!(window as any).L) {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.onload = () => setIsLeafletLoaded(true);
            document.head.appendChild(script);
        } else {
            setIsLeafletLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (!isLeafletLoaded || !mapRef.current) return;

        const L = (window as any).L;
        const map = L.map(mapRef.current).setView([39.9, 116.4], 4);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        let marker: any = null;

        map.on('click', async (e: any) => {
            const { lat, lng } = e.latlng;

            if (marker) map.removeLayer(marker);
            marker = L.marker([lat, lng]).addTo(map);

            // 使用 Nominatim 进行逆地理编码以获取地址（免费服务）
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=zh`);
                const data = await res.json();
                const address = data.display_name || `选定位置 (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

                onSelect({
                    lat,
                    lng,
                    name: address
                });
            } catch (err) {
                onSelect({
                    lat,
                    lng,
                    name: `选定位置 (${lat.toFixed(4)}, ${lng.toFixed(4)})`
                });
            }
        });

        // 添加定位功能
        map.locate({ setView: true, maxZoom: 10 });
        map.on('locationfound', (e: any) => {
            L.circle(e.latlng, e.accuracy).addTo(map);
            L.marker(e.latlng).addTo(map).bindPopup("你在这里").openPopup();
        });

        return () => {
            map.remove();
        };
    }, [isLeafletLoaded, onSelect]);

    return (
        <div className="w-full h-full relative">
            <div ref={mapRef} className="w-full h-full bg-slate-100" />
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-md border border-slate-200 px-4 py-2 rounded-full shadow-lg text-sm font-medium text-slate-700">
                🌐 由于高德接口受限，已切换至全球通用地图 (OpenStreetMap)
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
    const [resourceData, setResourceData] = useState<any[]>([]);
    const selectionMarkerRef = useRef<any>(null);

    useEffect(() => {
        let isMounted = true;
        let mapInstance: any = null;

        const initMap = async () => {
            // 设置 5 秒超时，如果加载不出来则切换到备用地图
            const timeoutId = setTimeout(() => {
                if (isLoading && isMounted) {
                    console.warn('高德地图加载超时，切换至备用地图');
                    setIsLoading(false);
                    setIsMock(true);
                }
            }, 5000);

            try {
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
                            // Fallback to Nominatim (OpenStreetMap)
                            try {
                                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
                                    headers: { 'Accept-Language': 'zh-CN,zh;q=0.9' }
                                });
                                const data = await response.json();
                                if (data && data.display_name) {
                                    setAddress(data.display_name);
                                } else {
                                    setAddress(`位置 (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
                                }
                            } catch (error) {
                                // console.error('Nominatim fallback failed:', error);
                                setAddress(`位置 (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
                            }
                        }
                    });
                });

                // 处理搜索框回车键作为备选方案
                const searchInput = document.getElementById('map-search-input') as HTMLInputElement;
                const handleSearch = async (e: KeyboardEvent) => {
                    if (e.key === 'Enter' && searchInput.value) {
                        try {
                            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchInput.value)}&limit=1`, {
                                headers: { 'Accept-Language': 'zh-CN,zh;q=0.9' }
                            });
                            const data = await response.json();
                            if (data && data.length > 0) {
                                const { lat, lon, display_name } = data[0];
                                const lngNum = parseFloat(lon);
                                const latNum = parseFloat(lat);

                                if (mapInstance) {
                                    mapInstance.setCenter([lngNum, latNum]);
                                    mapInstance.setZoom(12);

                                    if (selectionMarkerRef.current) mapInstance.remove(selectionMarkerRef.current);
                                    const marker = new AMapNamespace.Marker({
                                        position: [lngNum, latNum],
                                        icon: new AMapNamespace.Icon({
                                            size: new AMapNamespace.Size(25, 34),
                                            image: '//a.amap.com/jsapi_demos/static/demo-center/icons/poi-marker-default.png',
                                            imageSize: new AMapNamespace.Size(25, 34)
                                        })
                                    });
                                    mapInstance.add(marker);
                                    selectionMarkerRef.current = marker;
                                }
                                onSelectLocation({ lat: latNum, lng: lngNum, name: display_name });
                            }
                        } catch (error) {
                            console.error('Manual search failed:', error);
                        }
                    }
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
    }, []);

    if (isMock) {
        return <LeafletFallbackMap onSelect={onSelectLocation} />;
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
