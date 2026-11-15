"""公开数据任务的错峰时刻。不占用已有的 02:15 省级门户抓取。"""

from __future__ import annotations

# 墙钟均为 Asia/Shanghai。Celery 打开 enable_utc 后会自行换算。
BUCKETS = {
    "daily_literature": {
        "cron": "20 3 * * *",
        "label": "每天 03:20",
        "crontab_kwargs": {"hour": 3, "minute": 20},
    },
    "daily_osm": {
        "cron": "50 3 * * *",
        "label": "每天 03:50",
        "crontab_kwargs": {"hour": 3, "minute": 50},
    },
    "weekday_carbon": {
        "cron": "20 18 * * 1-5",
        "label": "周一至周五 18:20",
        "crontab_kwargs": {"day_of_week": "1-5", "hour": 18, "minute": 20},
    },
    "monthly_official": {
        "cron": "10 4 26 * *",
        "label": "每月 26 日 04:10",
        "crontab_kwargs": {"day_of_month": "26", "hour": 4, "minute": 10},
    },
    "weekly_policy": {
        "cron": "10 6 * * 2",
        "label": "每周二 06:10",
        "crontab_kwargs": {"day_of_week": "2", "hour": 6, "minute": 10},
    },
    "quarterly_geo": {
        "cron": "40 5 1 1,4,7,10 *",
        "label": "每季首日 05:40",
        "crontab_kwargs": {"day_of_month": "1", "month_of_year": "1,4,7,10", "hour": 5, "minute": 40},
    },
    "yearly_reference": {
        "cron": "40 6 8 1 *",
        "label": "每年 1 月 8 日 06:40",
        "crontab_kwargs": {"month_of_year": "1", "day_of_month": "8", "hour": 6, "minute": 40},
    },
}


def beat_entries() -> dict:
    from celery.schedules import crontab

    entries = {}
    for bucket, spec in BUCKETS.items():
        entries["public-ingest-%s" % bucket] = {
            "task": "energy.domestic.public_ingest",
            "schedule": crontab(**spec["crontab_kwargs"]),
            "args": (bucket,),
        }
    return entries
