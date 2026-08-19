// 地图位置选择器组件 - 支持地图点选和地址搜索
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Search, X, Crosshair, Loader2, AlertTriangle } from 'lucide-react';

interface LocationData {
    lat: number;
    lng: number;
    address?: string;
    province?: string;
    city?: string;
    district?: string;
}

interface LocationPickerProps {
    value?: { lat: string; lng: string; province?: string };
    onChange: (location: LocationData) => void;
    placeholder?: string;
}

export default function LocationPicker({ value, onChange, placeholder = "点击地图或搜索地址选择位置" }: LocationPickerProps) {
    const mapRef = useRef<any>(null);
    const markerRef = useRef<any>(null);
    const [mapInstance, setMapInstance] = useState<any>(null);
    const [AMapInstance, setAMapInstance] = useState<any>(null);
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [mapError, setMapError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
    const [tempLocation, setTempLocation] = useState<LocationData | null>(null);

    // 初始化地图
    useEffect(() => {
        if (!isMapOpen) return;

        const loadMap = async () => {
            // 配置安全密钥
            if (process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE) {
                (window as any)._AMapSecurityConfig = {
                    securityJsCode: process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE,
                };
            }

            try {
                setMapError(null);
                const { default: AMapLoader } = await import('@amap/amap-jsapi-loader');

                // 使用高德地图 JS API 1.4.15 版本 (无需安全密钥)
                const AMap = await AMapLoader.load({
                    key: process.env.NEXT_PUBLIC_AMAP_KEY || '',
                    version: "1.4.15",
                    plugins: ['AMap.PlaceSearch', 'AMap.Autocomplete', 'AMap.Geocoder', 'AMap.Scale', 'AMap.ToolBar']
                });

                setAMapInstance(AMap);

                // 默认中心点（中国中心）
                let center: [number, number] = [105.0, 35.0];
                let zoom = 5;

                // 如果有已选位置，使用该位置作为中心点
                if (value?.lat && value?.lng) {
                    center = [parseFloat(value.lng), parseFloat(value.lat)];
                    zoom = 12;
                }

                const map = new AMap.Map("location-picker-map", {
                    viewMode: "2D",
                    zoom: zoom,
                    center: center,
                });

                // 添加控件
                try {
                    map.addControl(new AMap.Scale());
                    map.addControl(new AMap.ToolBar({ position: 'RT' }));
                } catch (e) {
                    console.warn("控件加载失败", e);
                }

                // 地图点击事件
                map.on('click', async (e: any) => {
                    const lat = e.lnglat.getLat();
                    const lng = e.lnglat.getLng();
                    await handleLocationSelect(lat, lng, AMap, map);
                });

                // 监听地图加载完成
                map.on('complete', () => {
                    console.log('地图加载完成');
                    setIsLoading(false);
                });

                setMapInstance(map);
                mapRef.current = map;

                // 设置超时，如果5秒内没有触发complete事件，也标记为加载完成
                setTimeout(() => {
                    setIsLoading(false);
                }, 3000);

                // 如果有已选位置，添加标记
                if (value?.lat && value?.lng) {
                    const lat = parseFloat(value.lat);
                    const lng = parseFloat(value.lng);
                    addMarker(lat, lng, AMap, map);
                    setTempLocation({ lat, lng, province: value.province });
                }

            } catch (error: any) {
                console.error("地图加载失败", error);
                setMapError(error.message || "地图加载失败，请检查网络连接");
                setIsLoading(false);
            }
        };

        loadMap();

        return () => {
            if (mapRef.current) {
                mapRef.current.destroy();
                mapRef.current = null;
            }
        };
    }, [isMapOpen, value, onChange, placeholder]);

    // 添加标记
    const addMarker = (lat: number, lng: number, AMap: any, map: any) => {
        // 清除已有标记
        if (markerRef.current) {
            map.remove(markerRef.current);
        }

        const marker = new AMap.Marker({
            position: new AMap.LngLat(lng, lat),
            title: '选定位置',
            animation: 'AMAP_ANIMATION_DROP'
        });

        map.add(marker);
        markerRef.current = marker;
    };

    // 处理位置选择
    const handleLocationSelect = async (lat: number, lng: number, AMap: any, map: any) => {
        addMarker(lat, lng, AMap, map);

        // 逆地理编码获取地址
        const geocoder = new AMap.Geocoder();

        geocoder.getAddress([lng, lat], (status: string, result: any) => {
            if (status === 'complete' && result.regeocode) {
                const addressComponent = result.regeocode.addressComponent;
                const newLocation: LocationData = {
                    lat,
                    lng,
                    address: result.regeocode.formattedAddress,
                    province: addressComponent.province,
                    city: addressComponent.city || addressComponent.province,
                    district: addressComponent.district
                };
                setTempLocation(newLocation);
            } else {
                setTempLocation({ lat, lng });
            }
        });

        // 移动地图中心
        map.setCenter([lng, lat]);
    };

    // 搜索地址
    const handleSearch = async () => {
        if (!searchQuery || !AMapInstance || !mapInstance) return;

        setIsSearching(true);

        try {
            const placeSearch = new AMapInstance.PlaceSearch({
                pageSize: 1,
                pageIndex: 1
            });

            placeSearch.search(searchQuery, (status: string, result: any) => {
                if (status === 'complete' && result.poiList?.pois?.length > 0) {
                    const poi = result.poiList.pois[0];
                    const location = poi.location;
                    const lat = location.lat;
                    const lng = location.lng;

                    mapInstance.setZoomAndCenter(14, [lng, lat]);
                    handleLocationSelect(lat, lng, AMapInstance, mapInstance);
                }
                setIsSearching(false);
            });
        } catch (error) {
            console.error("搜索失败", error);
            setIsSearching(false);
        }
    };

    // 定位到当前位置
    const handleLocateMe = () => {
        if (!AMapInstance || !mapInstance) return;

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    mapInstance.setZoomAndCenter(14, [lng, lat]);
                    handleLocationSelect(lat, lng, AMapInstance, mapInstance);
                },
                (error) => {
                    console.error("定位失败", error);
                    alert("无法获取当前位置，请手动选择");
                }
            );
        }
    };

    // 确认选择
    const handleConfirm = () => {
        if (tempLocation) {
            setSelectedLocation(tempLocation);
            onChange(tempLocation);
            setIsMapOpen(false);
        }
    };

    // 取消选择
    const handleCancel = () => {
        setTempLocation(null);
        setIsMapOpen(false);
    };

    // 显示的位置文本
    const displayText = selectedLocation
        ? (selectedLocation.address || `${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}`)
        : (value?.lat && value?.lng
            ? `${value.lat}, ${value.lng}`
            : placeholder);

    return (
        <div className="relative">
            {/* 位置选择按钮 */}
            <button
                type="button"
                onClick={() => setIsMapOpen(true)}
                className="w-full flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left group"
            >
                <MapPin className="w-5 h-5 text-blue-600 group-hover:text-blue-700" />
                <span className={`flex-1 ${selectedLocation || (value?.lat && value?.lng) ? 'text-gray-900' : 'text-gray-500'}`}>
                    {displayText}
                </span>
                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                    点击选择
                </span>
            </button>

            {/* 地图弹窗 */}
            {isMapOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
                        {/* 头部 */}
                        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-600 to-blue-700">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <MapPin className="w-5 h-5" />
                                选择项目位置
                            </h3>
                            <button
                                onClick={handleCancel}
                                className="text-white/80 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* 搜索栏 */}
                        <div className="p-4 border-b bg-gray-50">
                            <div className="flex gap-2">
                                <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="搜索地址、城市或地名..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <button
                                    onClick={handleSearch}
                                    disabled={isSearching}
                                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSearching ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Search className="w-4 h-4" />
                                    )}
                                    搜索
                                </button>
                                <button
                                    onClick={handleLocateMe}
                                    className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-100 flex items-center gap-2"
                                    title="定位到当前位置"
                                >
                                    <Crosshair className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* 地图容器 */}
                        <div className="relative h-[400px]">
                            {isLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                </div>
                            )}

                            {/* 地图错误提示 */}
                            {mapError && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                                    <div className="text-center p-6">
                                        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                                        <p className="text-gray-700 font-medium mb-2">地图加载失败</p>
                                        <p className="text-sm text-gray-500 mb-4">{mapError}</p>
                                        <p className="text-xs text-gray-400">您可以手动输入坐标</p>
                                    </div>
                                </div>
                            )}

                            <div id="location-picker-map" className="w-full h-full" />

                            {/* 提示文字 */}
                            {!mapError && !isLoading && (
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow text-sm text-gray-600">
                                    👆 点击地图选择位置
                                </div>
                            )}

                            {/* 选中位置信息 */}
                            {tempLocation && (
                                <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg shadow-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                            <MapPin className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-900 truncate">
                                                {tempLocation.address || '选定位置'}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                经度: {tempLocation.lng.toFixed(6)} | 纬度: {tempLocation.lat.toFixed(6)}
                                            </p>
                                            {tempLocation.province && (
                                                <p className="text-sm text-blue-600 mt-1">
                                                    {tempLocation.province} {tempLocation.city} {tempLocation.district}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 底部操作栏 */}
                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                            <button
                                onClick={handleCancel}
                                className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={!tempLocation}
                                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            >
                                <MapPin className="w-4 h-4" />
                                确认选择
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
