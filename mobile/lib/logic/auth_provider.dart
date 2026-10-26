import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:micky_mobile/data/models/phone.dart';
import 'package:micky_mobile/logic/cart_provider.dart';
import 'package:micky_mobile/main.dart';
import 'package:micky_mobile/presentation/screens/catalog/product_details_screen.dart';
import 'package:micky_mobile/presentation/screens/chat/live_chat_screen.dart';
import 'package:micky_mobile/presentation/widgets/cart_notification_banner.dart';

class UserProfile {
  final String id;
  final String email;
  final String fullName;
  final String phone;
  final String role;
  final String? avatarUrl;
  final String? deliveryAddress;

  const UserProfile({
    required this.id,
    required this.email,
    required this.fullName,
    required this.phone,
    this.role = 'client',
    this.avatarUrl,
    this.deliveryAddress,
  });

  factory UserProfile.fromUser(User user) {
    final meta = user.userMetadata ?? {};
    return UserProfile(
      id: user.id,
      email: user.email ?? '',
      fullName: (meta['full_name'] as String?)?.trim().isNotEmpty == true
          ? meta['full_name'] as String
          : (user.email?.split('@').first ?? 'Customer'),
      phone: (meta['phone'] as String?) ?? '',
      role: (meta['role'] as String?) ?? 'client',
      avatarUrl: meta['avatar_url'] as String?,
      deliveryAddress: meta['delivery_address'] as String?,
    );
  }

  UserProfile copyWith({
    String? fullName,
    String? phone,
    String? role,
    String? avatarUrl,
    String? deliveryAddress,
  }) {
    return UserProfile(
      id: id,
      email: email,
      fullName: fullName ?? this.fullName,
      phone: phone ?? this.phone,
      role: role ?? this.role,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      deliveryAddress: deliveryAddress ?? this.deliveryAddress,
    );
  }
}

enum PendingActionType {
  none,
  addToCart,
  openChat,
  openProductDetails,
  chatWithPhone,
  buyNow,
  addToWishlist,
}

class PendingAction {
  final PendingActionType type;
  final Phone? phone;

  const PendingAction({
    required this.type,
    this.phone,
  });
}

final pendingActionProvider = StateProvider<PendingAction?>((ref) => null);

class AuthNotifier extends StateNotifier<AsyncValue<UserProfile?>> {
  AuthNotifier()
      : super(
          AsyncValue.data(
            Supabase.instance.client.auth.currentUser != null
                ? UserProfile.fromUser(Supabase.instance.client.auth.currentUser!)
                : null,
          ),
        ) {
    _init();
  }

  StreamSubscription<AuthState>? _sub;

  void _init() {
    _sub = Supabase.instance.client.auth.onAuthStateChange.listen((data) {
      final user = data.session?.user;
      if (user != null) {
        state = AsyncValue.data(UserProfile.fromUser(user));
      } else {
        state = const AsyncValue.data(null);
      }
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  bool get isAuthenticated => state.value != null;
  UserProfile? get currentUser => state.value;

  Future<void> signIn({required String email, required String password}) async {
    state = const AsyncValue.loading();
    try {
      final res = await Supabase.instance.client.auth.signInWithPassword(
        email: email.trim(),
        password: password,
      );
      if (res.user != null) {
        state = AsyncValue.data(UserProfile.fromUser(res.user!));
      } else {
        throw Exception('Sign in failed: No user returned');
      }
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      rethrow;
    }
  }

  Future<void> signUp({
    required String fullName,
    required String email,
    required String phone,
    required String password,
  }) async {
    state = const AsyncValue.loading();
    try {
      final res = await Supabase.instance.client.auth.signUp(
        email: email.trim(),
        password: password,
        data: {
          'full_name': fullName.trim(),
          'phone': phone.trim(),
          'role': 'client',
        },
      );
      if (res.user != null) {
        state = AsyncValue.data(UserProfile.fromUser(res.user!));
      } else {
        throw Exception('Registration succeeded, please verify email if required');
      }
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      rethrow;
    }
  }

  Future<void> updateProfile({
    String? fullName,
    String? phone,
    String? deliveryAddress,
    String? avatarUrl,
  }) async {
    final current = Supabase.instance.client.auth.currentUser;
    if (current == null) return;

    final updatedData = <String, dynamic>{
      if (fullName != null) 'full_name': fullName.trim(),
      if (phone != null) 'phone': phone.trim(),
      if (deliveryAddress != null) 'delivery_address': deliveryAddress.trim(),
      if (avatarUrl != null) 'avatar_url': avatarUrl.trim(),
    };

    final res = await Supabase.instance.client.auth.updateUser(
      UserAttributes(data: updatedData),
    );

    if (res.user != null) {
      state = AsyncValue.data(UserProfile.fromUser(res.user!));
    }
  }

  Future<void> resetPassword(String email) async {
    await Supabase.instance.client.auth.resetPasswordForEmail(email.trim());
  }

  Future<void> signOut() async {
    await Supabase.instance.client.auth.signOut();
    state = const AsyncValue.data(null);
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AsyncValue<UserProfile?>>((ref) {
  return AuthNotifier();
});

/// Executes any pending action queued before login/registration
void executePendingAction(BuildContext context, WidgetRef ref) {
  final pending = ref.read(pendingActionProvider);
  if (pending == null) return;

  // Clear pending immediately to avoid double execution
  ref.read(pendingActionProvider.notifier).state = null;

  WidgetsBinding.instance.addPostFrameCallback((_) {
    final nav = rootNavigatorKey.currentState;
    if (nav == null) return;

    if (pending.type == PendingActionType.addToCart && pending.phone != null) {
      ref.read(cartProvider.notifier).add(pending.phone!);

      CartNotificationBanner.show(
        context: nav.context,
        phoneName: '${pending.phone!.brand} ${pending.phone!.model}',
        displayDuration: const Duration(seconds: 3),
        onViewCart: () => appRouter.push('/cart'),
      );
    } else if (pending.type == PendingActionType.openProductDetails && pending.phone != null) {
      nav.push(
        MaterialPageRoute(
          builder: (_) => ProductDetailsScreen(phone: pending.phone!),
        ),
      );
    } else if (pending.type == PendingActionType.chatWithPhone && pending.phone != null) {
      nav.push(
        MaterialPageRoute(
          builder: (_) => LiveChatScreen(attachedPhone: pending.phone),
        ),
      );
    } else if (pending.type == PendingActionType.buyNow && pending.phone != null) {
      ref.read(cartProvider.notifier).add(pending.phone!);
      appRouter.push('/cart');
    } else if (pending.type == PendingActionType.addToWishlist && pending.phone != null) {
      ScaffoldMessenger.of(nav.context).showSnackBar(
        SnackBar(
          content: Text('${pending.phone!.brand} ${pending.phone!.model} added to your Wishlist!'),
          backgroundColor: const Color(0xFF16A34A),
        ),
      );
    } else if (pending.type == PendingActionType.openChat) {
      appRouter.push('/chat');
    }
  });
}
