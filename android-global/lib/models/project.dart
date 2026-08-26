class Project {
  final String id;
  final String userId;
  final String name;
  final String projectType;
  final String status;
  final double lat;
  final double lng;
  final String address;
  final String province;
  final double capacityMw;
  final List<String> tags;
  final DateTime createdAt;

  Project({
    required this.id,
    required this.userId,
    required this.name,
    required this.projectType,
    required this.status,
    required this.lat,
    required this.lng,
    required this.address,
    required this.province,
    required this.capacityMw,
    required this.tags,
    required this.createdAt,
  });

  factory Project.fromJson(Map<String, dynamic> json) {
    return Project(
      id: json['id'] ?? '',
      userId: json['user_id'] ?? json['userId'] ?? '',
      name: json['name'] ?? '',
      projectType: json['projectType'] ?? json['type'] ?? 'solar_pv',
      status: json['status'] ?? 'operating',
      lat: (json['latitude'] ?? json['lat'] ?? 0.0).toDouble(),
      lng: (json['longitude'] ?? json['lng'] ?? 0.0).toDouble(),
      address: json['location'] ?? json['address'] ?? '',
      province: json['province'] ?? '',
      capacityMw:
          (json['capacity_mw'] ?? json['capacityMw'] ?? json['capacity'] ?? 0.0)
              .toDouble(),
      tags: List<String>.from(json['tags'] ?? []),
      createdAt:
          DateTime.tryParse(json['created_at'] ?? json['createdAt'] ?? '') ??
          DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'name': name,
      'projectType': projectType,
      'status': status,
      'lat': lat,
      'lng': lng,
      'address': address,
      'province': province,
      'capacityMw': capacityMw,
      'tags': tags,
      'createdAt': createdAt.toIso8601String(),
    };
  }

  String get projectTypeLabel {
    switch (projectType) {
      case 'solar_pv':
        return 'Solar';
      case 'wind':
        return 'Wind';
      case 'storage':
        return 'Storage';
      case 'hybrid':
        return 'Hybrid';
      default:
        return projectType;
    }
  }

  String get statusLabel {
    switch (status) {
      case 'planning':
        return 'Planning';
      case 'construction':
        return 'Under Construction';
      case 'operating':
        return 'Operational';
      case 'retired':
        return 'Decommissioned';
      default:
        return status;
    }
  }
}
