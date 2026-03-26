import '../models/models.dart';

class MockData {
  static const user = User(
    id: 'usr_001',
    name: 'Alex Thompson',
    email: 'alex.thompson@solarventures.com',
    company: 'Solar Ventures Capital',
    country: 'US',
    plan: 'pro',
    currency: 'USD',
    timezone: 'America/New_York',
  );

  static const List<Project> projects = [
    Project(
      id: 'prj_001',
      name: 'Nevada Solar Ranch I',
      type: 'solar',
      status: 'operating',
      locationAddress: 'Clark County, NV',
      locationCountry: 'US',
      capacity: 150,
      lat: 36.17,
      lng: -115.14,
      startDate: '2022-06-01',
      budget: 165000000,
      tags: ['utility-scale', 'PPA'],
    ),
    Project(
      id: 'prj_002',
      name: 'Texas Wind Farm Alpha',
      type: 'wind',
      status: 'operating',
      locationAddress: 'Pecos County, TX',
      locationCountry: 'US',
      capacity: 200,
      lat: 31.85,
      lng: -102.37,
      startDate: '2021-01-15',
      budget: 280000000,
      tags: ['onshore-wind', 'merchant'],
    ),
    Project(
      id: 'prj_003',
      name: 'Dubai BESS Project',
      type: 'storage',
      status: 'development',
      locationAddress: 'Dubai, UAE',
      locationCountry: 'AE',
      capacity: 50,
      lat: 25.20,
      lng: 55.27,
      startDate: '2024-01-10',
      budget: 45000000,
      tags: ['BESS', 'MENA'],
    ),
  ];

  static const solar = SolarAssessment(
    ghi: 2187.4,
    dni: 1943.2,
    dhi: 412.8,
    score: 91.2,
    peakSunHours: 5.99,
    optimalTilt: 27,
    avgTemperature: 21.3,
    resourceClass: 'I',
    dataSource: 'NASA POWER',
    monthlyGHI: [142, 165, 201, 228, 247, 265, 259, 242, 208, 175, 143, 132],
  );

  static const wind = WindAssessment(
    meanSpeed: 8.4,
    weibullK: 2.18,
    weibullC: 9.47,
    wpd: 432,
    score: 88.6,
    turbulenceIntensity: 0.11,
    resourceClass: 'I',
    monthlySpeed: [9.1, 8.8, 8.9, 8.7, 8.2, 7.9, 7.8, 8.0, 8.3, 8.6, 9.0, 9.2],
    roseDirections: [
      {'dir': 'N', 'freq': 5.2, 'speed': 7.8},
      {'dir': 'NE', 'freq': 6.1, 'speed': 8.2},
      {'dir': 'E', 'freq': 8.5, 'speed': 9.3},
      {'dir': 'SE', 'freq': 6.4, 'speed': 8.6},
      {'dir': 'S', 'freq': 4.8, 'speed': 7.6},
      {'dir': 'SW', 'freq': 6.8, 'speed': 8.4},
      {'dir': 'W', 'freq': 9.1, 'speed': 9.5},
      {'dir': 'NW', 'freq': 7.4, 'speed': 8.8},
    ],
  );

  static const List<Alert> alerts = [
    Alert(
      id: 'a1',
      title: 'Performance Ratio Drop',
      severity: 'warning',
      message: 'Inverter block 3A PR dropped 4.2% below baseline.',
      isRead: false,
    ),
    Alert(
      id: 'a2',
      title: 'Turbine 47 Gearbox Temperature',
      severity: 'critical',
      message: 'T47 gearbox temperature exceeded 78°C threshold.',
      isRead: false,
    ),
    Alert(
      id: 'a3',
      title: 'Monthly Report Ready',
      severity: 'info',
      message: 'February 2024 portfolio report is ready.',
      isRead: true,
    ),
  ];

  static const weeklyGen = [112.3, 128.7, 119.4, 135.2, 142.8, 138.5, 130.9];

  static const dashboardMetrics = {
    'generation': 847.3,
    'revenue': 46601500.0,
    'carbonAvoided': 423650.0,
    'health': 84.0,
  };
}
