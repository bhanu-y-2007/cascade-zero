"""
Geospatial and Country Resolution Utilities for CASCADE ZERO.
Provides country detection from place strings, coordinates bounding boxes,
and geographic centroids for map navigation.
"""

from typing import Any

# Standardized country centroids and zoom levels for map zooming
COUNTRY_GEO_DATA: dict[str, dict[str, Any]] = {
    'Japan': {'center': [36.2048, 138.2529], 'zoom': 5, 'bounds': [[30.0, 128.0], [45.5, 146.0]]},
    'United States': {'center': [37.0902, -95.7129], 'zoom': 4, 'bounds': [[24.5, -125.0], [49.5, -66.9]]},
    'India': {'center': [20.5937, 78.9629], 'zoom': 5, 'bounds': [[8.0, 68.0], [35.5, 97.5]]},
    'Australia': {'center': [-25.2744, 133.7751], 'zoom': 4, 'bounds': [[-44.0, 112.0], [-10.0, 154.0]]},
    'New Zealand': {'center': [-40.9006, 174.8860], 'zoom': 5, 'bounds': [[-47.5, 166.0], [-34.0, 179.0]]},
    'Indonesia': {'center': [-0.7893, 113.9213], 'zoom': 5, 'bounds': [[-11.0, 95.0], [6.0, 141.0]]},
    'Philippines': {'center': [12.8797, 121.7740], 'zoom': 6, 'bounds': [[4.5, 116.5], [21.5, 127.0]]},
    'Italy': {'center': [41.8719, 12.5674], 'zoom': 6, 'bounds': [[36.5, 6.5], [47.1, 18.5]]},
    'Greece': {'center': [39.0742, 21.8243], 'zoom': 6, 'bounds': [[34.8, 19.3], [41.8, 28.5]]},
    'Turkey': {'center': [38.9637, 35.2433], 'zoom': 5, 'bounds': [[35.8, 25.6], [42.1, 44.8]]},
    'Chile': {'center': [-35.6751, -71.5430], 'zoom': 4, 'bounds': [[-56.0, -76.0], [-17.5, -66.0]]},
    'Mexico': {'center': [23.6345, -102.5528], 'zoom': 5, 'bounds': [[14.5, -118.5], [32.8, -86.7]]},
    'Canada': {'center': [56.1304, -106.3468], 'zoom': 3, 'bounds': [[41.7, -141.0], [83.1, -52.6]]},
    'China': {'center': [35.8617, 104.1954], 'zoom': 4, 'bounds': [[18.0, 73.5], [53.6, 135.0]]},
    'United Kingdom': {'center': [55.3781, -3.4360], 'zoom': 6, 'bounds': [[49.8, -8.6], [60.9, 1.8]]},
    'France': {'center': [46.2276, 2.2137], 'zoom': 5, 'bounds': [[41.3, -5.2], [51.1, 9.6]]},
    'Germany': {'center': [51.1657, 10.4515], 'zoom': 6, 'bounds': [[47.2, 5.8], [55.1, 15.1]]},
    'Spain': {'center': [40.4637, -3.7492], 'zoom': 5, 'bounds': [[36.0, -9.3], [43.8, 4.4]]},
    'Brazil': {'center': [-14.2350, -51.9253], 'zoom': 4, 'bounds': [[-33.8, -73.9], [5.3, -34.7]]},
    'South Africa': {'center': [-30.5595, 22.9375], 'zoom': 5, 'bounds': [[-34.9, 16.4], [-22.1, 32.9]]},
    'Kenya': {'center': [-0.0236, 37.9062], 'zoom': 6, 'bounds': [[-4.7, 33.9], [5.0, 41.9]]},
    'Vanuatu': {'center': [-15.3767, 166.9592], 'zoom': 6, 'bounds': [[-20.3, 166.5], [-13.0, 170.5]]},
    'Papua New Guinea': {'center': [-6.3150, 143.9555], 'zoom': 5, 'bounds': [[-11.7, 140.8], [-1.0, 156.0]]},
    'Iceland': {'center': [64.9631, -19.0208], 'zoom': 6, 'bounds': [[63.3, -24.6], [66.6, -13.5]]},
    'Fiji': {'center': [-17.7134, 178.0650], 'zoom': 6, 'bounds': [[-21.0, 177.0], [-15.5, 182.0]]},
    'Tonga': {'center': [-21.1789, -175.1982], 'zoom': 6, 'bounds': [[-22.5, -176.5], [-15.5, -173.5]]},
    'Solomon Islands': {'center': [-9.6457, 160.1562], 'zoom': 6, 'bounds': [[-12.5, 155.5], [-6.5, 163.0]]},
    'Peru': {'center': [-9.1900, -75.0152], 'zoom': 5, 'bounds': [[-18.4, -81.4], [-0.03, -68.6]]},
    'Colombia': {'center': [4.5709, -74.2973], 'zoom': 5, 'bounds': [[-4.3, -79.1], [12.5, -66.8]]},
    'Ecuador': {'center': [-1.8312, -78.1834], 'zoom': 6, 'bounds': [[-5.1, -81.1], [1.5, -75.1]]},
    'Argentina': {'center': [-38.4161, -63.6167], 'zoom': 4, 'bounds': [[-55.1, -73.6], [-21.8, -53.6]]},
    'Taiwan': {'center': [23.6978, 120.9605], 'zoom': 7, 'bounds': [[21.8, 119.9], [25.4, 122.1]]},
    'South Korea': {'center': [35.9078, 127.7669], 'zoom': 7, 'bounds': [[33.0, 125.0], [38.7, 131.0]]},
    'Vietnam': {'center': [14.0583, 108.2772], 'zoom': 5, 'bounds': [[8.5, 102.1], [23.4, 109.5]]},
    'Thailand': {'center': [15.8700, 100.9925], 'zoom': 5, 'bounds': [[5.6, 97.3], [20.5, 105.7]]},
    'Bangladesh': {'center': [23.6850, 90.3563], 'zoom': 6, 'bounds': [[20.7, 88.0], [26.7, 92.7]]},
    'Pakistan': {'center': [30.3753, 69.3451], 'zoom': 5, 'bounds': [[23.7, 60.8], [37.1, 77.8]]},
    'Iran': {'center': [32.4279, 53.6880], 'zoom': 5, 'bounds': [[25.0, 44.0], [39.8, 63.4]]},
    'Afghanistan': {'center': [33.9391, 67.7100], 'zoom': 5, 'bounds': [[29.3, 60.5], [38.5, 74.9]]},
    'Morocco': {'center': [31.7917, -7.0926], 'zoom': 5, 'bounds': [[21.4, -17.1], [36.0, -1.0]]},
    'Egypt': {'center': [26.8206, 30.8025], 'zoom': 5, 'bounds': [[22.0, 24.7], [31.7, 36.9]]},
    'Nigeria': {'center': [9.0820, 8.6753], 'zoom': 5, 'bounds': [[4.2, 2.6], [13.9, 14.7]]},
    'Norway': {'center': [60.4720, 8.4689], 'zoom': 5, 'bounds': [[57.9, 4.5], [71.2, 31.1]]},
    'Portugal': {'center': [39.3999, -8.2245], 'zoom': 6, 'bounds': [[36.9, -9.6], [42.2, -6.1]]},
    'Costa Rica': {'center': [9.7489, -83.7534], 'zoom': 7, 'bounds': [[8.0, -86.0], [11.3, -82.5]]},
    'Guatemala': {'center': [15.7835, -90.2308], 'zoom': 7, 'bounds': [[13.7, -92.3], [17.9, -88.2]]},
}

US_STATE_CODES = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
    'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
    'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
    'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
    'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
    'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
    'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
    'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
    'PR': 'Puerto Rico', 'GU': 'Guam', 'VI': 'Virgin Islands'
}

COMMON_COUNTRY_NAMES = [
    'Japan', 'United States', 'India', 'Australia', 'New Zealand', 'Indonesia',
    'Philippines', 'Italy', 'Greece', 'Turkey', 'Chile', 'Mexico', 'Canada', 'China',
    'United Kingdom', 'France', 'Germany', 'Spain', 'Brazil', 'South Africa', 'Kenya',
    'Vanuatu', 'Papua New Guinea', 'Iceland', 'Fiji', 'Tonga', 'Solomon Islands',
    'Peru', 'Colombia', 'Ecuador', 'Argentina', 'Taiwan', 'South Korea', 'Vietnam',
    'Thailand', 'Bangladesh', 'Pakistan', 'Iran', 'Afghanistan', 'Morocco', 'Egypt',
    'Nigeria', 'Norway', 'Portugal', 'Costa Rica', 'Guatemala', 'Russia', 'Nepal'
]


def resolve_country(
    place: str = '',
    latitude: float = 0.0,
    longitude: float = 0.0,
    raw_country: str = '',
) -> str:
    """
    Intelligently resolve a standardized country name from raw feed attributes,
    place string, and geographic coordinates.
    """
    # 1. Clean raw country if present
    clean_raw = raw_country.strip()
    if clean_raw and clean_raw.lower() not in ('unknown', 'unspecified', 'global', 'none', ''):
        for country in COMMON_COUNTRY_NAMES:
            if country.lower() in clean_raw.lower():
                return country
        # If it's a known single-name country or comma separated
        primary = clean_raw.split(',')[0].strip()
        if primary:
            return primary

    # 2. Check place string for US state abbreviations or explicit country suffix
    place_clean = place.strip()
    if place_clean:
        # Check standard comma format: "12km E of Sendai, Japan" or "10km N of Malibu, CA"
        parts = [p.strip() for p in place_clean.split(',')]
        if len(parts) >= 2:
            last_part = parts[-1]
            if last_part.upper() in US_STATE_CODES or 'United States' in last_part or 'U.S.' in last_part:
                return 'United States'
            for country in COMMON_COUNTRY_NAMES:
                if country.lower() == last_part.lower() or country.lower() in last_part.lower():
                    return country

        for country in COMMON_COUNTRY_NAMES:
            if country.lower() in place_clean.lower():
                return country

        # Check for US state names in place
        for state_code, state_name in US_STATE_CODES.items():
            if f' {state_code}' in place_clean or state_name.lower() in place_clean.lower():
                return 'United States'

    # 3. Coordinate bounding box fallback for key regions
    for country, geo in COUNTRY_GEO_DATA.items():
        bounds = geo.get('bounds')
        if bounds and len(bounds) == 2:
            (min_lat, min_lon), (max_lat, max_lon) = bounds[0], bounds[1]
            if min_lat <= latitude <= max_lat and min_lon <= longitude <= max_lon:
                return country

    return 'Global Waters / Territory' if not place_clean else (place_clean.split(',')[-1].strip() or 'International')
