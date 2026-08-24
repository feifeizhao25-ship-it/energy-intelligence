"""Oracle 数据集 — 红线 R2（数值偏差容忍）的基准数据。

恢复说明：tests/test_redlines.py 引用 ORACLE_DATASETS["yinchuan_pv_100mw"]，
原文件丢失。按红线测试中使用的字段重建（name/location/capacity_kw/
technology/expected_ranges)。数值取行业典型区间。
"""

ORACLE_DATASETS = {
    "yinchuan_pv_100mw": {
        "name": "银川 100MW 光伏 Oracle 项目",
        "location": {
            "latitude": 38.4872,
            "longitude": 106.2309,
            "address": "宁夏银川",
        },
        "capacity_kw": 100000,
        "technology": "crystalline",
        "expected_ranges": {
            # 宁夏一类资源区固定式光伏容量系数典型区间
            "cf": (0.18, 0.26),
            "pr": (0.78, 0.86),
        },
    },
}
