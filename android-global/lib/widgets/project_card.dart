import 'package:flutter/material.dart';
import '../models/project.dart';

class ProjectCard extends StatelessWidget {
  final Project project;
  final VoidCallback? onTap;

  const ProjectCard({
    Key? key,
    required this.project,
    this.onTap,
  }) : super(key: key);

  IconData _getTypeIcon() {
    switch (project.projectType) {
      case 'solar_pv':
        return Icons.wb_sunny;
      case 'wind':
        return Icons.cloud;
      case 'storage':
        return Icons.battery_charging_full;
      case 'hybrid':
        return Icons.electric_bolt;
      default:
        return Icons.energy_savings_leaf;
    }
  }

  Color _getTypeColor() {
    switch (project.projectType) {
      case 'solar_pv':
        return Color(0xFFF59E0B);
      case 'wind':
        return Color(0xFF06B6D4);
      case 'storage':
        return Color(0xFF8B5CF6);
      case 'hybrid':
        return Color(0xFF3B82F6);
      default:
        return Color(0xFF10B981);
    }
  }

  Color _getStatusColor() {
    switch (project.status) {
      case 'operating':
        return Color(0xFF10B981);
      case 'construction':
        return Color(0xFFF59E0B);
      case 'planning':
        return Color(0xFF3B82F6);
      case 'retired':
        return Color(0xFF6B7280);
      default:
        return Color(0xFF64748B);
    }
  }

  @override
  Widget build(BuildContext context) {
    final typeColor = _getTypeColor();
    final statusColor = _getStatusColor();

    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: typeColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(_getTypeIcon(), color: typeColor, size: 20),
                  ),
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      project.statusLabel,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: statusColor,
                      ),
                    ),
                  ),
                ],
              ),
              SizedBox(height: 12),
              Text(
                project.name,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF0F172A),
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              SizedBox(height: 8),
              Row(
                children: [
                  Icon(Icons.location_on_outlined, size: 14, color: Color(0xFF64748B)),
                  SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      '${project.province} · ${project.capacityMw.toStringAsFixed(0)}MW',
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFF64748B),
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              SizedBox(height: 12),
              if (project.tags.isNotEmpty)
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: project.tags.take(2).map((tag) {
                    return Container(
                      padding: EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        tag,
                        style: TextStyle(
                          fontSize: 10,
                          color: Color(0xFF475569),
                        ),
                      ),
                    );
                  }).toList(),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
