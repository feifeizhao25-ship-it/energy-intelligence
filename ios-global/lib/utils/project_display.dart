import 'dart:convert';

/// Display helpers for projects returned by `/api/v1/projects`.
///
/// The server sends `location` as an object `{latitude, longitude, address}` and the capacity as
/// `capacity_kw`. Rendering those with `.toString()` printed raw map text
/// ("{latitude: 31, longitude: -100, address: West Texas}") and hid the capacity.

/// Human-readable location, or null when nothing usable was sent.
String? projectLocationText(dynamic location) {
  if (location == null) return null;
  if (location is Map) return _fromMap(location);
  final s = location.toString().trim();
  if (s.isEmpty) return null;
  if (s.startsWith('{') && s.endsWith('}')) {
    try {
      final decoded = jsonDecode(s);
      if (decoded is Map) return _fromMap(decoded);
    } catch (_) {
      // Dart-style map text: {latitude: 31, longitude: -100, address: West Texas}
      final m = <String, String>{};
      for (final part in s.substring(1, s.length - 1).split(RegExp(r',\s*(?=\w+:)'))) {
        final i = part.indexOf(':');
        if (i > 0) m[part.substring(0, i).trim()] = part.substring(i + 1).trim();
      }
      if (m.isNotEmpty) return _fromMap(m);
    }
    return null;
  }
  return s;
}

String? _fromMap(Map m) {
  final address = (m['address'] ?? '').toString().trim();
  if (address.isNotEmpty && address.toLowerCase() != 'null') return address;
  final lat = _num(m['latitude'] ?? m['lat']);
  final lng = _num(m['longitude'] ?? m['lng']);
  if (lat == null || lng == null) return null;
  final ns = lat >= 0 ? 'N' : 'S';
  final ew = lng >= 0 ? 'E' : 'W';
  return '${lat.abs().toStringAsFixed(2)}°$ns, ${lng.abs().toStringAsFixed(2)}°$ew';
}

double? _num(dynamic v) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v.trim());
  return null;
}

/// Capacity in MW as text ("100 MW"), from `capacity_mw` / `capacityMw` / `capacity` or `capacity_kw`.
String? projectCapacityText(Map<String, dynamic> p) {
  double? mw = _num(p['capacity_mw'] ?? p['capacityMw'] ?? p['capacity']);
  if (mw == null) {
    final kw = _num(p['capacity_kw']);
    if (kw != null) mw = kw / 1000;
  }
  if (mw == null || mw <= 0) return null;
  final t = mw == mw.roundToDouble() ? mw.toStringAsFixed(0) : mw.toStringAsFixed(1);
  return '$t MW';
}
