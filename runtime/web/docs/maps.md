# 地图

国内现网是 `runtime/web`。页面上的地图只有服务端瓦片代理这一条。`MAP_TILE_PROVIDER` 取 `tianditu`（或「天地图」）时要有 `TIANDITU_KEY`；取 `amap`、`gaode` 或「高德」时要有 `GAODE_MAP_KEY`。密钥只留在服务端。浏览器只请求 `/api/map-tiles/tile`，这个地址里没有密钥。什么都没配时，页面写「地图服务暂不可用」，并请用户直接填写经纬度。不回退到 OpenStreetMap 或 Nominatim。

不要把下面三条写成「高德已经做完」。

1. **瓦片代理。** 上面这条。配好密钥后，`/map`、`/resource/map` 和风电测算里的选点会画瓦片。`/map/compare` 和 `/map/report` 不画地图，只做对比和报告。
2. **Web 服务。** `AMAP_WEB_SERVICE_KEY` 只在服务端做地理编码、逆地理、周边和输入提示。高德用 GCJ-02，库存和对外坐标用 WGS84，进出时转换。没有密钥就不请求。
3. **JS SDK。** 现网页面不加载。安全密钥不能放进 `NEXT_PUBLIC`。以后若要加载，只能把 `_AMapSecurityConfig.serviceHost` 指到服务端代理，不能把 jscode 发给浏览器。

还要使用方提供，代码里不会编造：

- 高德商用授权
- Web 服务 Key，以及瓦片用的天地图 Key 或高德 Key
- 自然资源主管部门的审图号

审图号未提供时，地图角标写「审图号未配置」。

国际站（web-global、web-int，以及国际 App）没有地图页。不接高德，也不把 Mapbox 写成已经有地图。
