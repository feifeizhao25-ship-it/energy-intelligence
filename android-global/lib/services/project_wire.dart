/// Translates between the server's project contract (technology, capacity_kw, location {latitude, longitude,
/// address}) and the flat shape the screens read (projectType, lat, lng, address, capacityMw). Without this a
/// project saved on the server shows as "solar, 0 MW, no place" in the list.
class ProjectWire {
  const ProjectWire._();

  static String projectTypeOf(Object? technology) {
    final t = (technology ?? '').toString().toLowerCase();
    if (t.contains('wind')) return 'wind';
    if (t.contains('storage') || t.contains('battery')) return 'storage';
    if (t.contains('hybrid')) return 'hybrid';
    if (t.isEmpty || t.contains('solar') || t.contains('pv') || t.contains('crystalline')) return 'solar_pv';
    return t;
  }

  static double? _number(Object? v) {
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v);
    return null;
  }

  static Map<String, dynamic> fromWire(Map<String, dynamic> raw) {
    final loc = raw['location'];
    final locMap = loc is Map ? loc : const {};
    final address = (loc is String ? loc : locMap['address'])?.toString() ?? '';
    final lat = _number(locMap['latitude']) ?? _number(raw['latitude']) ?? _number(raw['lat']);
    final lng = _number(locMap['longitude']) ?? _number(raw['longitude']) ?? _number(raw['lng']);
    final kw = _number(raw['capacity_kw']);
    final mw = _number(raw['capacity_mw']) ?? _number(raw['capacityMw']) ?? (kw == null ? null : kw / 1000);
    final technology = raw['technology'] ?? raw['projectType'] ?? raw['type'];
    return {
      ...raw,
      'technology': technology,
      'projectType': projectTypeOf(technology),
      'location': address,
      'address': address,
      'lat': lat ?? 0.0,
      'lng': lng ?? 0.0,
      'latitude': lat,
      'longitude': lng,
      'capacity_mw': mw,
      'capacityMw': mw ?? 0.0,
      'created_at': raw['created_at'] ?? raw['createdAt'],
    };
  }

  /// Body for POST /api/v1/projects.
  static Map<String, dynamic> toWire({
    required String name,
    required String technology,
    required double capacityMw,
    required double latitude,
    required double longitude,
    String? address,
    String? description,
  }) {
    return {
      'name': name,
      'technology': technology,
      'capacity_kw': capacityMw * 1000,
      'location': {
        'latitude': latitude,
        'longitude': longitude,
        if (address != null && address.trim().isNotEmpty) 'address': address.trim(),
      },
      if (description != null && description.trim().isNotEmpty) 'description': description.trim(),
    };
  }

  /// POST responses are wrapped as {code, message, data}.
  static Map<String, dynamic> unwrap(Map<String, dynamic> resp) {
    final data = resp['data'];
    return data is Map ? Map<String, dynamic>.from(data) : resp;
  }
}
