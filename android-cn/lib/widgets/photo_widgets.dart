/// 新能源智库：图文并茂组件（照片卡片、空状态插图）。
library;

import 'package:flutter/material.dart';

/// 带照片背景的入口卡片内容（照片 + 深色渐变 + 文字）。
class EnPhotoCard extends StatelessWidget {
  const EnPhotoCard({
    super.key,
    required this.asset,
    required this.title,
    required this.subtitle,
    required this.icon,
    this.onTap,
    this.height = 168,
  });

  final String asset;
  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback? onTap;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      elevation: 2,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: SizedBox(
            height: height,
            width: double.infinity,
            child: Stack(fit: StackFit.expand, children: [
              const DecoratedBox(decoration: BoxDecoration(color: Color(0xFF1E3A8A))),
              Image.asset(asset, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const SizedBox.shrink()),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Color(0x14000000), Color(0xCC0B1220)],
                    stops: [0.25, 1.0],
                  ),
                ),
              ),
              Positioned(
                left: 18,
                right: 18,
                bottom: 16,
                child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(12)),
                    child: Icon(icon, color: Colors.white, size: 26),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(title, style: const TextStyle(fontSize: 20, height: 1.3, fontWeight: FontWeight.bold, color: Colors.white)),
                      const SizedBox(height: 2),
                      Text(subtitle, style: TextStyle(fontSize: 14, height: 1.4, color: Colors.white.withValues(alpha: 0.9))),
                    ]),
                  ),
                  const Icon(Icons.arrow_forward, color: Colors.white),
                ]),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

/// 空状态：照片 + 标题 + 说明
class EnEmptyState extends StatelessWidget {
  const EnEmptyState({
    super.key,
    required this.title,
    required this.message,
    this.asset = 'assets/images/en_empty_substation.webp',
    this.imageHeight = 150,
  });

  final String title;
  final String message;
  final String asset;
  final double imageHeight;

  @override
  Widget build(BuildContext context) {
    return Column(mainAxisSize: MainAxisSize.min, children: [
      ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Image.asset(asset, width: double.infinity, height: imageHeight, fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => SizedBox(height: imageHeight)),
      ),
      const SizedBox(height: 14),
      Text(title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 17, height: 1.4, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
      const SizedBox(height: 6),
      Text(message, textAlign: TextAlign.center, style: const TextStyle(fontSize: 14, height: 1.6, color: Color(0xFF64748B))),
    ]);
  }
}

/// 财务/资源入口行：左侧缩略照片
class EnThumbRow extends StatelessWidget {
  const EnThumbRow({super.key, required this.asset, required this.title, required this.subtitle, required this.icon, required this.color, required this.onTap});

  final String asset;
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.asset(asset, width: 96, height: 72, fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(width: 96, height: 72, color: color.withValues(alpha: 0.12), child: Icon(icon, color: color, size: 28))),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Icon(icon, size: 18, color: color),
                  const SizedBox(width: 6),
                  Expanded(child: Text(title, style: const TextStyle(fontSize: 17, height: 1.3, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)))),
                ]),
                const SizedBox(height: 4),
                Text(subtitle, style: const TextStyle(fontSize: 14, height: 1.5, color: Color(0xFF64748B))),
              ]),
            ),
            const Icon(Icons.arrow_forward, color: Color(0xFFCBD5E1)),
          ]),
        ),
      ),
    );
  }
}

/// 页面顶部横幅：照片 + 底部渐变说明（可带若干标签）
class EnBanner extends StatelessWidget {
  const EnBanner({super.key, required this.asset, required this.caption, this.chips = const [], this.height = 150});

  final String asset;
  final String caption;
  final List<(IconData, String)> chips;
  final double height;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: SizedBox(
        height: height,
        width: double.infinity,
        child: Stack(fit: StackFit.expand, children: [
          const DecoratedBox(decoration: BoxDecoration(color: Color(0xFF1E3A8A))),
          Image.asset(asset, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const SizedBox.shrink()),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x00000000), Color(0xCC0B1220)], stops: [0.3, 1.0]),
            ),
          ),
          Positioned(
            left: 16,
            right: 16,
            bottom: 14,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Text(caption, style: const TextStyle(fontSize: 16, height: 1.4, fontWeight: FontWeight.w600, color: Colors.white)),
              if (chips.isNotEmpty) ...[
                const SizedBox(height: 8),
                Wrap(spacing: 8, runSpacing: 6, children: [
                  for (final c in chips)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.22), borderRadius: BorderRadius.circular(999)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Icon(c.$1, size: 15, color: Colors.white),
                        const SizedBox(width: 4),
                        Text(c.$2, style: const TextStyle(fontSize: 14, height: 1.2, color: Colors.white)),
                      ]),
                    ),
                ]),
              ],
            ]),
          ),
        ]),
      ),
    );
  }
}
