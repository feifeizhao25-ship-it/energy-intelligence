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
      userId: json['userId'] ?? '',
      name: json['name'] ?? '',
      projectType: json['projectType'] ?? 'solar_pv',
      status: json['status'] ?? 'operating',
      lat: (json['lat'] ?? 0.0).toDouble(),
      lng: (json['lng'] ?? 0.0).toDouble(),
      address: json['address'] ?? '',
      province: json['province'] ?? '',
      capacityMw: (json['capacityMw'] ?? 0.0).toDouble(),
      tags: List<String>.from(json['tags'] ?? []),
      createdAt: DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
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
        return '光伏';
      case 'wind':
        return '风电';
      case 'storage':
        return '储能';
      case 'hybrid':
        return '混合';
      default:
        return projectType;
    }
  }

  String get statusLabel {
    switch (status) {
      case 'planning':
        return '规划中';
      case 'construction':
        return '建设中';
      case 'operating':
        return '运营中';
      case 'retired':
        return '已退役';
      default:
        return status;
    }
  }
}
