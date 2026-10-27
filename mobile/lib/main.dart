import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'core/theme/app_theme.dart';
import 'data/services/supabase_service.dart';
import 'presentation/screens/catalog/catalog_screen.dart';
import 'presentation/screens/splash/splash_screen.dart';
import 'presentation/screens/cart/cart_screen.dart';
import 'presentation/screens/chat/live_chat_screen.dart';
import 'presentation/screens/auth/login_screen.dart';
import 'presentation/screens/auth/register_screen.dart';
import 'presentation/screens/auth/forgot_password_screen.dart';
import 'presentation/screens/profile/profile_screen.dart';
import 'presentation/screens/orders/orders_screen.dart';
import 'presentation/screens/orders/order_tracking_screen.dart';
import 'presentation/screens/orders/order_confirmation_screen.dart';
import 'presentation/screens/notifications/notification_center_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SupabaseService.initialize();
  runApp(const ProviderScope(child: MickyMobileApp()));
}

final rootNavigatorKey = GlobalKey<NavigatorState>();
final rootScaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();

final appRouter = GoRouter(
  navigatorKey: rootNavigatorKey,
  initialLocation: '/splash',
  routes: [
    GoRoute(
      path: '/splash',
      builder: (context, state) => const SplashScreen(),
    ),
    GoRoute(
      path: '/',
      builder: (context, state) => const CatalogScreen(),
    ),
    GoRoute(
      path: '/cart',
      builder: (context, state) => const CartScreen(),
    ),
    GoRoute(
      path: '/chat',
      builder: (context, state) => const LiveChatScreen(),
    ),
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/register',
      builder: (context, state) => const RegisterScreen(),
    ),
    GoRoute(
      path: '/forgot-password',
      builder: (context, state) {
        final email = state.uri.queryParameters['email'];
        return ForgotPasswordScreen(initialEmail: email);
      },
    ),
    GoRoute(
      path: '/profile',
      builder: (context, state) => const ProfileScreen(),
    ),
    GoRoute(
      path: '/orders',
      builder: (context, state) {
        final status = state.uri.queryParameters['status'];
        return OrdersScreen(initialFilter: status);
      },
    ),
    GoRoute(
      path: '/order-tracking',
      builder: (context, state) {
        final orderId = state.uri.queryParameters['id'] ?? '';
        final txRef = state.uri.queryParameters['ref'];
        return OrderTrackingScreen(orderId: orderId, txRef: txRef);
      },
    ),
    GoRoute(
      path: '/notifications',
      builder: (context, state) => const NotificationCenterScreen(),
    ),
  ],
);

class MickyMobileApp extends StatelessWidget {
  const MickyMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Micky-Mobile',
      theme: AppTheme.lightTheme,
      scaffoldMessengerKey: rootScaffoldMessengerKey,
      routerConfig: appRouter,
      debugShowCheckedModeBanner: false,
    );
  }
}
