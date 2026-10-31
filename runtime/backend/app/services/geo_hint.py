"""Country inference from the free-text project address.

The project record stores one free-text address (``Project.location``) plus latitude/longitude and no country
column, so a report must never assume a country. This module recognises country, US-state and Indian-state names
(and a few big cities) in the address. When nothing matches it returns None and the report says the country is not
recorded, instead of defaulting to China.
"""
from __future__ import annotations

import re
from typing import Optional

# Names that are also a country or a state elsewhere (Georgia, Punjab, Washington, Delhi alone) are left out on
# purpose: a wrong country is worse than "not recorded".
_US_STATES = [
    "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware", "florida",
    "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine", "maryland",
    "massachusetts", "michigan", "minnesota", "mississippi", "missouri", "montana", "nebraska", "nevada",
    "new hampshire", "new jersey", "new mexico", "new york", "north carolina", "north dakota", "ohio", "oklahoma",
    "oregon", "pennsylvania", "rhode island", "south carolina", "south dakota", "tennessee", "texas", "utah",
    "vermont", "west virginia", "wisconsin", "wyoming", "ercot",
]
_IN_STATES = [
    "andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh", "goa", "gujarat", "haryana",
    "himachal pradesh", "jharkhand", "karnataka", "kerala", "madhya pradesh", "maharashtra", "manipur", "meghalaya",
    "mizoram", "nagaland", "odisha", "rajasthan", "sikkim", "tamil nadu", "telangana", "tripura", "uttar pradesh",
    "uttarakhand", "west bengal", "ladakh", "jammu",
]
_COUNTRIES = {
    "US": "united states|usa|u.s.a|u.s.|america",
    "IN": "india",
    "CN": "china|prc",
    "GB": "united kingdom|uk|england|scotland|wales|london",
    "DE": "germany|berlin|bavaria",
    "ES": "spain|seville|madrid|andalusia",
    "FR": "france|paris",
    "IT": "italy|sicily|rome",
    "KR": "south korea|korea|seoul",
    "JP": "japan|tokyo",
    "AU": "australia|sydney|queensland|new south wales",
    "ZA": "south africa|cape town|johannesburg",
    "BR": "brazil",
    "MX": "mexico",
    "CL": "chile|atacama",
    "SA": "saudi arabia",
    "AE": "united arab emirates|uae|dubai|abu dhabi",
    "EG": "egypt",
    "MA": "morocco",
    "NL": "netherlands",
    "DK": "denmark",
    "TR": "turkey|turkiye",
    "VN": "vietnam",
    "TH": "thailand",
    "ID": "indonesia",
    "PH": "philippines",
    "CA": "canada|alberta|ontario",
}

COUNTRY_NAMES = {
    "US": "United States", "IN": "India", "CN": "China", "GB": "United Kingdom", "DE": "Germany", "ES": "Spain",
    "FR": "France", "IT": "Italy", "KR": "South Korea", "JP": "Japan", "AU": "Australia", "ZA": "South Africa",
    "BR": "Brazil", "MX": "Mexico", "CL": "Chile", "SA": "Saudi Arabia", "AE": "United Arab Emirates", "EG": "Egypt",
    "MA": "Morocco", "NL": "Netherlands", "DK": "Denmark", "TR": "Turkey", "VN": "Vietnam", "TH": "Thailand",
    "ID": "Indonesia", "PH": "Philippines", "CA": "Canada",
}

_CN_HINT = re.compile(r"[\u3400-\u9fff]")


def _compile(terms):
    return re.compile(r"(?<![a-z])(?:" + "|".join(re.escape(t) for t in terms) + r")(?![a-z])", re.I)


_US_RE = _compile(_US_STATES)
_IN_RE = _compile(_IN_STATES)
_COUNTRY_RES = [(code, _compile(spec.split("|"))) for code, spec in _COUNTRIES.items()]


def infer_country(address: Optional[str]) -> Optional[str]:
    """ISO alpha-2 code recognised in the address, or None."""
    text = (address or "").strip()
    if not text or _CN_HINT.search(text):
        # Chinese place names belong to the domestic edition; do not guess a country from them here.
        return "CN" if _CN_HINT.search(text) else None
    for code, rx in _COUNTRY_RES:
        if rx.search(text):
            return code
    if _US_RE.search(text):
        return "US"
    if _IN_RE.search(text):
        return "IN"
    return None
