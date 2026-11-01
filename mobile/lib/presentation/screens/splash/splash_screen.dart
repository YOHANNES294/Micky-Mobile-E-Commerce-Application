import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../logic/phone_provider.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _fadeController;
  late Animation<double> _fadeAnimation;
  bool _precached = false;

  @override
  void initState() {
    super.initState();
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeIn,
    );
    _fadeController.forward();

    _initializeApp();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_precached) {
      _precached = true;
      precacheImage(const AssetImage('assets/micky_logo.png'), context);
      precacheImage(const AssetImage('assets/mickey_mascot.png'), context);
    }
  }

  Future<void> _initializeApp() async {
    final startTime = DateTime.now();

    // Preload catalog inventory in the background while the splash is displaying
    // This prevents a second loading/spinner page when navigating to the dashboard
    try {
      await ref.read(phonesFutureProvider.future);
    } catch (_) {}

    // Keep the splash screen visible for at least 2200ms so the brand & mascot
    // are cleanly presented as a single unified loading screen
    final elapsed = DateTime.now().difference(startTime).inMilliseconds;
    final remaining = 2200 - elapsed;
    if (remaining > 0) {
      await Future.delayed(Duration(milliseconds: remaining));
    }

    if (mounted) {
      context.go('/');
    }
  }

  @override
  void dispose() {
    _fadeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;

    // Responsive sizing so all three elements fit nicely on any screen size
    final logoWidth = (screenHeight * 0.28).clamp(200.0, 270.0);
    final logoHeight = (screenHeight * 0.18).clamp(120.0, 180.0);
    final mascotWidth = (screenHeight * 0.24).clamp(160.0, 220.0);
    final mascotHeight = (screenHeight * 0.32).clamp(200.0, 280.0);

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: SizedBox(
            width: double.infinity,
            height: double.infinity,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const Spacer(flex: 2),

                // Top: Micky Mobile Ethiopia Logo
                Center(
                  child: Image.asset(
                    'assets/micky_logo.png',
                    width: logoWidth,
                    height: logoHeight,
                    fit: BoxFit.contain,
                    errorBuilder: (context, error, stackTrace) => const Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.phone_android, size: 48, color: AppTheme.coral),
                        SizedBox(height: 6),
                        Text(
                          'MICKY MOBILE',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                            color: AppTheme.coral,
                            letterSpacing: 1.5,
                          ),
                        ),
                        Text(
                          'ETHIOPIA',
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.black54,
                            letterSpacing: 2.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                const Spacer(flex: 1),

                // Middle: Mickey Mouse Character Mascot (between logo and search/loading icon)
                Center(
                  child: Image.asset(
                    'assets/mickey_mascot.png',
                    width: mascotWidth,
                    height: mascotHeight,
                    fit: BoxFit.contain,
                    errorBuilder: (context, error, stackTrace) => const SizedBox(height: 100),
                  ),
                ),

                const Spacer(flex: 2),

                // Bottom: Red/Coral Circular Loading Spinner
                const Center(
                  child: SizedBox(
                    width: 38,
                    height: 38,
                    child: CircularProgressIndicator(
                      strokeWidth: 3.2,
                      valueColor: AlwaysStoppedAnimation<Color>(AppTheme.coral),
                    ),
                  ),
                ),

                const Spacer(flex: 2),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
