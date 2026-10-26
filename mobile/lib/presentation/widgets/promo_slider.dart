import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_theme.dart';
import '../../logic/phone_provider.dart';

class PromoItem {
  final String imagePath;
  final String title;
  final String subtitle;
  final String actionType; // 'all', 'iphone', 'chat'

  const PromoItem({
    required this.imagePath,
    required this.title,
    required this.subtitle,
    required this.actionType,
  });
}

class PromoSlider extends ConsumerStatefulWidget {
  final double height;
  final bool autoPlay;

  const PromoSlider({
    super.key,
    this.height = 185.0,
    this.autoPlay = true,
  });

  static const List<PromoItem> defaultPromos = [
    PromoItem(
      imagePath: 'assets/promo_banner_1.jpg',
      title: 'Micky Mobile Store',
      subtitle: 'Your Perfect Phone Is Just a Click Away',
      actionType: 'all',
    ),
    PromoItem(
      imagePath: 'assets/promo_banner_2.png',
      title: 'iPhone 17 Pro Max',
      subtitle: 'የእርስዎ የመጨረሻ ማሻሻያ - በኦንላይን ይግዙ',
      actionType: 'iphone',
    ),
    PromoItem(
      imagePath: 'assets/promo_banner_3.png',
      title: 'iPhone 18 Pro Special',
      subtitle: 'ኦሪጅናል ምርት ከፈጣን መላኪያ ጋር',
      actionType: 'iphone',
    ),
  ];

  @override
  ConsumerState<PromoSlider> createState() => _PromoSliderState();
}

class _PromoSliderState extends ConsumerState<PromoSlider> {
  late final PageController _pageController;
  int _currentIndex = 0;
  Timer? _autoPlayTimer;
  bool _isUserInteracting = false;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    if (widget.autoPlay) {
      _startAutoPlay();
    }
  }

  void _startAutoPlay() {
    _autoPlayTimer?.cancel();
    _autoPlayTimer = Timer.periodic(const Duration(seconds: 4), (timer) {
      if (!_isUserInteracting && _pageController.hasClients) {
        final nextIndex = (_currentIndex + 1) % PromoSlider.defaultPromos.length;
        _pageController.animateToPage(
          nextIndex,
          duration: const Duration(milliseconds: 650),
          curve: Curves.easeInOutCubic,
        );
      }
    });
  }

  void _onSlideTapped(PromoItem promo) {
    if (promo.actionType == 'iphone') {
      ref.read(brandFilterProvider.notifier).state = 'iPhone';
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Showing Apple iPhone Collection'),
          duration: Duration(seconds: 2),
          backgroundColor: AppTheme.coral,
        ),
      );
    } else if (promo.actionType == 'all') {
      ref.read(brandFilterProvider.notifier).state = 'All';
    } else if (promo.actionType == 'chat') {
      context.push('/chat');
    }
  }

  @override
  void dispose() {
    _autoPlayTimer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const promos = PromoSlider.defaultPromos;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: widget.height,
          child: NotificationListener<ScrollNotification>(
            onNotification: (notification) {
              if (notification is ScrollStartNotification) {
                _isUserInteracting = true;
              } else if (notification is ScrollEndNotification) {
                _isUserInteracting = false;
              }
              return false;
            },
            child: PageView.builder(
              controller: _pageController,
              itemCount: promos.length,
              onPageChanged: (index) {
                setState(() {
                  _currentIndex = index;
                });
              },
              itemBuilder: (context, index) {
                final promo = promos[index];
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16.0),
                  child: InkWell(
                    onTap: () => _onSlideTapped(promo),
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.08),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: Image.asset(
                          promo.imagePath,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => Container(
                            color: AppTheme.coral.withOpacity(0.1),
                            child: Center(
                              child: Text(
                                promo.title,
                                style: const TextStyle(fontWeight: FontWeight.bold),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ),
        const SizedBox(height: 8),
        // Interactive indicator dots
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(promos.length, (index) {
            final isActive = index == _currentIndex;
            return GestureDetector(
              onTap: () {
                _pageController.animateToPage(
                  index,
                  duration: const Duration(milliseconds: 400),
                  curve: Curves.easeInOut,
                );
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: isActive ? 22 : 7,
                height: 7,
                decoration: BoxDecoration(
                  color: isActive ? AppTheme.coral : Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            );
          }),
        ),
      ],
    );
  }
}

/// In-Feed Promotional Banner (specifically designed for breaking after Row 3)
class Row3BreakBanner extends ConsumerWidget {
  const Row3BreakBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: () {
            ref.read(brandFilterProvider.notifier).state = 'iPhone';
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Exploring Flagship iPhones'),
                duration: Duration(seconds: 2),
                backgroundColor: AppTheme.coral,
              ),
            );
          },
          child: Image.asset(
            'assets/promo_banner_3.png',
            fit: BoxFit.cover,
            height: 165,
            width: double.infinity,
            errorBuilder: (_, __, ___) => Image.asset(
              'assets/promo_banner_2.png',
              fit: BoxFit.cover,
              height: 165,
              width: double.infinity,
            ),
          ),
        ),
      ),
    );
  }
}
