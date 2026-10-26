import 'dart:async';
import 'package:flutter/material.dart';
import 'package:micky_mobile/main.dart';

/// Animated in-app notification banner that slides in from right to left,
/// stays for 3 seconds, and slides back out to the right.
class CartNotificationBanner {
  static OverlayEntry? _currentEntry;
  static Timer? _dismissTimer;

  static void show({
    BuildContext? context,
    required String phoneName,
    required VoidCallback onViewCart,
    Duration displayDuration = const Duration(seconds: 3),
  }) {
    // Dismiss any existing banner first
    _dismissTimer?.cancel();
    _currentEntry?.remove();
    _currentEntry = null;

    final overlayState = context != null
        ? Overlay.maybeOf(context) ?? rootNavigatorKey.currentState?.overlay
        : rootNavigatorKey.currentState?.overlay;

    if (overlayState == null) return;

    late OverlayEntry entry;

    entry = OverlayEntry(
      builder: (ctx) => _AnimatedBanner(
        phoneName: phoneName,
        displayDuration: displayDuration,
        onViewCart: () {
          _dismissTimer?.cancel();
          _dismissTimer = null;
          entry.remove();
          if (_currentEntry == entry) _currentEntry = null;
          onViewCart();
        },
        onDismissed: () {
          if (_currentEntry == entry) {
            _currentEntry = null;
          }
          entry.remove();
        },
      ),
    );

    _currentEntry = entry;
    overlayState.insert(entry);
  }
}

class _AnimatedBanner extends StatefulWidget {
  final String phoneName;
  final Duration displayDuration;
  final VoidCallback onViewCart;
  final VoidCallback onDismissed;

  const _AnimatedBanner({
    required this.phoneName,
    required this.displayDuration,
    required this.onViewCart,
    required this.onDismissed,
  });

  @override
  State<_AnimatedBanner> createState() => _AnimatedBannerState();
}

class _AnimatedBannerState extends State<_AnimatedBanner>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<Offset> _slideAnimation;
  late final Animation<double> _fadeAnimation;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 380),
      reverseDuration: const Duration(milliseconds: 320),
    );

    // Slide in from right (Offset(1.2, 0)) to center (Offset.zero)
    _slideAnimation = Tween<Offset>(
      begin: const Offset(1.2, 0.0),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(
        parent: _controller,
        curve: Curves.easeOutCubic,
        reverseCurve: Curves.easeInCubic,
      ),
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: Curves.easeOut,
        reverseCurve: Curves.easeIn,
      ),
    );

    // Start slide in right-to-left
    _controller.forward().then((_) {
      if (!mounted) return;
      // Stay for 3 seconds then slide back out to the right
      _timer = Timer(widget.displayDuration, () {
        if (!mounted) return;
        _controller.reverse().then((_) {
          if (mounted) widget.onDismissed();
        });
      });
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _manualDismiss() {
    _timer?.cancel();
    _controller.reverse().then((_) {
      if (mounted) widget.onDismissed();
    });
  }

  @override
  Widget build(BuildContext context) {
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return Positioned(
      bottom: bottomPadding + 20,
      left: 16,
      right: 16,
      child: SlideTransition(
        position: _slideAnimation,
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: Material(
            color: Colors.transparent,
            child: GestureDetector(
              onHorizontalDragEnd: (details) {
                // Allow swiping to dismiss to the right
                if (details.primaryVelocity != null &&
                    details.primaryVelocity! > 100) {
                  _manualDismiss();
                }
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFF16A34A), // Rich green
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: const [
                    BoxShadow(
                      color: Colors.black26,
                      blurRadius: 10,
                      offset: Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.check_circle,
                      color: Colors.white,
                      size: 22,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        '${widget.phoneName} added to your cart!',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    InkWell(
                      onTap: widget.onViewCart,
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        child: const Text(
                          'VIEW CART',
                          style: TextStyle(
                            color: Colors.yellowAccent,
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
