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

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _initializeApp();
  }

  Future<void> _initializeApp() async {
    final startTime = DateTime.now();

    // Preload inventory in the background so dashboard opens instantly without a second loading screen
    try {
      await ref.read(phonesFutureProvider.future);
    } catch (_) {}

    // Ensure the splash screen is clearly visible for ~2.5 seconds
    final elapsed = DateTime.now().difference(startTime).inMilliseconds;
    final remaining = 2500 - elapsed;
    if (remaining > 0) {
      await Future.delayed(Duration(milliseconds: remaining));
    }

    if (mounted) {
      context.go('/');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: SizedBox.expand(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const SizedBox(height: 16),

              // 1. Top: Micky Mobile Ethiopia Logo
              Image.asset(
                'assets/micky_logo.png',
                width: 250,
                height: 170,
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

              const SizedBox(height: 14),

              // 2. Middle: Mickey Mouse Mascot
              Image.asset(
                'assets/mickey_mascot.png',
                width: 215,
                height: 275,
                fit: BoxFit.contain,
                errorBuilder: (context, error, stackTrace) => const SizedBox(height: 100),
              ),

              const SizedBox(height: 36),

              // 3. Bottom: Coral Loading Spinner
              const SizedBox(
                width: 40,
                height: 40,
                child: CircularProgressIndicator(
                  strokeWidth: 3.5,
                  valueColor: AlwaysStoppedAnimation<Color>(AppTheme.coral),
                ),
              ),

              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
