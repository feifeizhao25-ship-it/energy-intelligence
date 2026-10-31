/// Photo-led building blocks for the international edition: banner, photo cards,
/// empty states and project-type thumbnails. All images are bundled assets.
library;

import 'package:flutter/material.dart';

const _kDir = 'assets/images/';

/// Picks the photo that matches a technology string ("solar_pv", "Wind", "storage", ...).
String enTypeAsset(String? type) {
  final t = (type ?? '').toLowerCase();
  if (t.contains('solar') || t.contains('pv')) return '${_kDir}eg_panels.webp';
  if (t.contains('wind')) return '${_kDir}eg_wind.webp';
  if (t.contains('storage') || t.contains('battery') || t.contains('bess')) return '${_kDir}eg_storage.webp';
  return '${_kDir}eg_grid.webp';
}

Widget _img(String asset, {double? w, double? h}) => Image.asset(
      asset,
      width: w,
      height: h,
      fit: BoxFit.cover,
      errorBuilder: (_, _, _) => Container(width: w, height: h, color: const Color(0xFFE2E8F0)),
    );

class EnPhotoBanner extends StatelessWidget {
  const EnPhotoBanner({super.key, required this.asset, required this.title, required this.subtitle, this.height = 176});
  final String asset;
  final String title;
  final String subtitle;
  final double height;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: SizedBox(
        height: height,
        width: double.infinity,
        child: Stack(fit: StackFit.expand, children: [
          _img(asset),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0x00000000), Color(0xCC0B1B3A)],
              ),
            ),
          ),
          Positioned(
            left: 18,
            right: 18,
            bottom: 14,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Text(title, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800, height: 1.2)),
              const SizedBox(height: 4),
              Text(subtitle, style: const TextStyle(color: Colors.white, fontSize: 14, height: 1.4)),
            ]),
          ),
        ]),
      ),
    );
  }
}

class EnPhotoCard extends StatelessWidget {
  const EnPhotoCard({super.key, required this.asset, required this.title, required this.description, required this.onTap, this.cta});
  final String asset;
  final String title;
  final String description;
  final VoidCallback onTap;
  final String? cta;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '$title. $description',
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 12, offset: const Offset(0, 4))],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(
              height: 128,
              width: double.infinity,
              child: Stack(fit: StackFit.expand, children: [
                _img(asset),
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Color(0x00000000), Color(0xB30B1B3A)],
                    ),
                  ),
                ),
                Positioned(
                  left: 16,
                  right: 16,
                  bottom: 10,
                  child: Text(title, style: const TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w800)),
                ),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
              child: Row(children: [
                Expanded(child: Text(description, style: const TextStyle(fontSize: 14, height: 1.45, color: Color(0xFF475569)))),
                if (cta != null) ...[
                  const SizedBox(width: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                    decoration: BoxDecoration(color: const Color(0xFF1D4ED8), borderRadius: BorderRadius.circular(18)),
                    child: Text(cta!, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
                  ),
                ] else
                  const Icon(Icons.chevron_right, color: Color(0xFF64748B)),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

class EnActionTile extends StatelessWidget {
  const EnActionTile({super.key, required this.asset, required this.label, required this.onTap});
  final String asset;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final w = (MediaQuery.of(context).size.width - 32 - 12) / 2;
    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: SizedBox(
            width: w,
            height: 88,
            child: Stack(fit: StackFit.expand, children: [
              _img(asset),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Color(0x00000000), Color(0xB30B1B3A)],
                  ),
                ),
              ),
              Positioned(
                left: 12,
                right: 8,
                bottom: 8,
                child: Text(label, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700)),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

class EnEmptyPhoto extends StatelessWidget {
  const EnEmptyPhoto({super.key, required this.asset, required this.title, required this.message, this.action});
  final String asset;
  final String title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        ClipRRect(borderRadius: BorderRadius.circular(20), child: _img(asset, w: 260, h: 160)),
        const SizedBox(height: 16),
        Text(title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        Text(message, textAlign: TextAlign.center, style: const TextStyle(fontSize: 14.5, height: 1.5, color: Color(0xFF475569))),
        if (action != null) ...[const SizedBox(height: 16), action!],
      ]),
    );
  }
}

class EnTypeThumb extends StatelessWidget {
  const EnTypeThumb({super.key, required this.type, this.size = 56});
  final String? type;
  final double size;

  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: _img(enTypeAsset(type), w: size, h: size),
      );
}

class EnTypePhoto extends StatelessWidget {
  const EnTypePhoto({super.key, required this.type, this.height = 148});
  final String? type;
  final double height;

  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: SizedBox(height: height, width: double.infinity, child: _img(enTypeAsset(type))),
      );
}
