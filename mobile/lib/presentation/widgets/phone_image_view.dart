import 'package:flutter/material.dart';
import 'package:micky_mobile/core/theme/app_theme.dart';

/// Professional phone image widget with elegant local asset and silhouette fallbacks.
class PhoneImageView extends StatelessWidget {
  final String? imageUrl;
  final String brand;
  final String model;
  final BoxFit fit;

  const PhoneImageView({
    super.key,
    required this.imageUrl,
    required this.brand,
    required this.model,
    this.fit = BoxFit.contain,
  });

  String? _getLocalAsset() {
    final m = model.toLowerCase();
    final b = brand.toLowerCase();
    if (m.contains('s24') || (b.contains('samsung') && m.contains('ultra'))) {
      return 'assets/phones/s24_ultra.jpg';
    }
    if (m.contains('15 pro') || m.contains('15')) {
      return 'assets/phones/iphone_15_pro_max.jpg';
    }
    if (m.contains('s23') || m.contains('fe')) {
      return 'assets/phones/s23_fe.jpg';
    }
    if (m.contains('14 pro') || m.contains('14')) {
      return 'assets/phones/iphone_14_pro.jpg';
    }
    if (m.contains('a15') || (b.contains('samsung') && m.contains('a'))) {
      return 'assets/phones/galaxy_a15.jpg';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final trimmed = imageUrl?.trim();

    // 1. Direct local asset
    if (trimmed != null && trimmed.startsWith('assets/')) {
      return Image.asset(
        trimmed,
        fit: fit,
        errorBuilder: (context, error, stackTrace) => _buildWithFallbackAsset(),
      );
    }

    // 2. Remote network image with local asset fallback on error
    if (trimmed != null && (trimmed.startsWith('http://') || trimmed.startsWith('https://'))) {
      return Image.network(
        trimmed,
        fit: fit,
        loadingBuilder: (context, child, loadingProgress) {
          if (loadingProgress == null) return child;
          return Center(
            child: SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                value: loadingProgress.expectedTotalBytes != null
                    ? loadingProgress.cumulativeBytesLoaded /
                        loadingProgress.expectedTotalBytes!
                    : null,
                color: AppTheme.coral.withOpacity(0.5),
              ),
            ),
          );
        },
        errorBuilder: (context, error, stackTrace) {
          // If network lookup fails (e.g. DNS / offline), display bundled real photo!
          return _buildWithFallbackAsset();
        },
      );
    }

    // 3. Fallback to asset or placeholder
    return _buildWithFallbackAsset();
  }

  Widget _buildWithFallbackAsset() {
    final localAsset = _getLocalAsset();
    if (localAsset != null) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: Image.asset(
          localAsset,
          fit: fit,
          errorBuilder: (_, __, ___) => _buildPlaceholder(),
        ),
      );
    }
    return _buildPlaceholder();
  }

  Widget _buildPlaceholder() {
    final isApple = brand.toLowerCase().contains('iphone') ||
        brand.toLowerCase().contains('apple');
    final isSamsung = brand.toLowerCase().contains('samsung');

    return Container(
      width: double.infinity,
      height: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Colors.grey.shade50,
            Colors.grey.shade100,
          ],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Stylized smartphone silhouette
          Container(
            width: 76,
            height: 114,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isApple ? Colors.grey.shade300 : AppTheme.coral.withOpacity(0.3),
                width: 2,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Speaker Notch
                Container(
                  margin: const EdgeInsets.only(top: 6),
                  width: 24,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),

                // Screen Display Area with Inner Icon
                Expanded(
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
                    decoration: BoxDecoration(
                      color: isApple
                          ? const Color(0xFFF1F5F9)
                          : const Color(0xFFFFF1F2),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Center(
                      child: Icon(
                        isApple ? Icons.phone_iphone_rounded : Icons.smartphone_rounded,
                        size: 32,
                        color: isApple ? Colors.grey.shade700 : AppTheme.coral,
                      ),
                    ),
                  ),
                ),

                // Home indicator bar
                Container(
                  margin: const EdgeInsets.only(bottom: 6),
                  width: 32,
                  height: 3,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ],
            ),
          ),

          // Brand Chip Badge
          Positioned(
            bottom: 6,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: isApple ? const Color(0xFF1E293B) : AppTheme.coral,
                borderRadius: BorderRadius.circular(10),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.12),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Text(
                isApple ? 'iPhone' : (isSamsung ? 'Samsung' : brand),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.3,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
