    report_url = await service.generate_report(
        format=format,
    )
    if not report_url:
        raise HTTPException(
            status_code=501,
            detail="Diagnosis report rendering is not configured; no placeholder download was created.",
        )
    return success(data={"download_url": report_url})