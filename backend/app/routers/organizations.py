    if not member_result.scalar_one_or_none():
        raise NotFoundError("Organization")
