import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:micky_mobile/data/models/phone.dart';
import 'package:micky_mobile/logic/auth_provider.dart';

class CartItem {
  final Phone phone;
  final int quantity;
  final bool isSelected;

  const CartItem({
    required this.phone,
    this.quantity = 1,
    this.isSelected = true,
  });

  CartItem copyWith({
    int? quantity,
    bool? isSelected,
  }) {
    return CartItem(
      phone: phone,
      quantity: quantity ?? this.quantity,
      isSelected: isSelected ?? this.isSelected,
    );
  }

  double get totalPrice => phone.price * quantity;

  Map<String, dynamic> toJson() {
    return {
      'phone': phone.toJson(),
      'quantity': quantity,
      'isSelected': isSelected,
    };
  }

  factory CartItem.fromJson(Map<String, dynamic> json) {
    return CartItem(
      phone: Phone.fromJson(json['phone'] as Map<String, dynamic>),
      quantity: json['quantity'] as int? ?? 1,
      isSelected: json['isSelected'] as bool? ?? true,
    );
  }
}

class CartNotifier extends StateNotifier<List<CartItem>> {
  String? _activeUserId;

  CartNotifier() : super([]) {
    final current = Supabase.instance.client.auth.currentUser;
    if (current != null) {
      switchUser(current.id);
    }
  }

  String? get activeUserId => _activeUserId;

  /// Switches active user session.
  /// If userId is null (signed out), persists previous user's cart and clears in-memory state.
  /// If userId is non-null, loads the saved cart for that account.
  Future<void> switchUser(String? userId, {dynamic remoteCartData}) async {
    if (_activeUserId == userId && state.isNotEmpty) return;

    // Save previous user's cart before switching
    if (_activeUserId != null && state.isNotEmpty) {
      await _persistCartForUser(_activeUserId!, state);
    }

    _activeUserId = userId;

    if (userId == null) {
      // User signed out -> Clear active UI session so cart items do not leak
      state = [];
      return;
    }

    // Load saved cart for this customer
    final loaded = await _loadCartForUser(userId, remoteCartData: remoteCartData);
    state = loaded;
  }

  Future<List<CartItem>> _loadCartForUser(String userId, {dynamic remoteCartData}) async {
    try {
      final prefs = await SharedPreferences.getInstance();

      // 1. Try local cache first for instant responsiveness
      final localJson = prefs.getString('micky_cart_$userId');
      if (localJson != null && localJson.trim().isNotEmpty) {
        final List<dynamic> decoded = jsonDecode(localJson);
        final items = decoded.map((e) => CartItem.fromJson(Map<String, dynamic>.from(e as Map))).toList();
        if (items.isNotEmpty) return items;
      }

      // 2. Try remote Supabase user_metadata if local cache is empty
      dynamic cartSource = remoteCartData;
      if (cartSource == null) {
        final current = Supabase.instance.client.auth.currentUser;
        if (current?.id == userId) {
          cartSource = current?.userMetadata?['cart'];
        }
      }

      if (cartSource != null) {
        List<dynamic> list;
        if (cartSource is String) {
          list = jsonDecode(cartSource);
        } else if (cartSource is List) {
          list = cartSource;
        } else {
          list = [];
        }
        final items = list.map((e) => CartItem.fromJson(Map<String, dynamic>.from(e as Map))).toList();
        if (items.isNotEmpty) {
          await prefs.setString('micky_cart_$userId', jsonEncode(items.map((i) => i.toJson()).toList()));
          return items;
        }
      }
    } catch (e) {
      debugPrint('Error loading cart for user $userId: $e');
    }
    return [];
  }

  Future<void> _persistCart() async {
    if (_activeUserId == null) return;
    await _persistCartForUser(_activeUserId!, state);
  }

  Future<void> _persistCartForUser(String userId, List<CartItem> items) async {
    try {
      final jsonList = items.map((i) => i.toJson()).toList();
      final jsonStr = jsonEncode(jsonList);

      // Save to SharedPreferences
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('micky_cart_$userId', jsonStr);

      // Sync to Supabase user_metadata backend asynchronously
      final current = Supabase.instance.client.auth.currentUser;
      if (current != null && current.id == userId) {
        unawaited(
          () async {
            try {
              await Supabase.instance.client.auth.updateUser(
                UserAttributes(data: {'cart': jsonList}),
              );
            } catch (err) {
              debugPrint('Failed to sync cart to Supabase metadata: $err');
            }
          }(),
        );
      }
    } catch (e) {
      debugPrint('Error persisting cart for user $userId: $e');
    }
  }

  void add(Phone phone) {
    final index = state.indexWhere((item) => item.phone.id == phone.id);
    if (index >= 0) {
      final updated = [...state];
      updated[index] = updated[index].copyWith(
        quantity: updated[index].quantity + 1,
        isSelected: true,
      );
      state = updated;
    } else {
      state = [...state, CartItem(phone: phone, quantity: 1, isSelected: true)];
    }
    _persistCart();
  }

  void remove(String phoneId) {
    state = state.where((item) => item.phone.id != phoneId).toList();
    _persistCart();
  }

  void updateQuantity(String phoneId, int qty) {
    if (qty <= 0) {
      remove(phoneId);
      return;
    }
    state = state.map((item) {
      if (item.phone.id == phoneId) {
        return item.copyWith(quantity: qty);
      }
      return item;
    }).toList();
    _persistCart();
  }

  void toggleSelect(String phoneId, bool isSelected) {
    state = state.map((item) {
      if (item.phone.id == phoneId) {
        return item.copyWith(isSelected: isSelected);
      }
      return item;
    }).toList();
    _persistCart();
  }

  void selectAll(bool select) {
    state = state.map((item) => item.copyWith(isSelected: select)).toList();
    _persistCart();
  }

  /// Removes only purchased items from the cart.
  /// Unselected items remain in the cart for future purchase.
  void removePurchasedItems(List<String> purchasedPhoneIds) {
    state = state.where((item) => !purchasedPhoneIds.contains(item.phone.id)).toList();
    _persistCart();
  }

  void clear() {
    state = [];
    _persistCart();
  }

  void clearSession() {
    state = [];
  }

  // Totals based on ALL items
  double get totalAmount => state.fold(0.0, (sum, item) => sum + item.totalPrice);
  int get itemCount => state.fold(0, (sum, item) => sum + item.quantity);

  // Totals based on SELECTED items only
  List<CartItem> get selectedItems => state.where((item) => item.isSelected).toList();
  double get selectedTotalAmount => selectedItems.fold(0.0, (sum, item) => sum + item.totalPrice);
  int get selectedItemCount => selectedItems.fold(0, (sum, item) => sum + item.quantity);
  bool get isAllSelected => state.isNotEmpty && state.every((item) => item.isSelected);
  bool get hasSelectedItems => state.any((item) => item.isSelected);
}

final cartProvider = StateNotifierProvider<CartNotifier, List<CartItem>>((ref) {
  final notifier = CartNotifier();

  ref.listen<AsyncValue<UserProfile?>>(
    authProvider,
    (previous, next) {
      final user = next.value;
      dynamic remoteCart;
      if (user != null) {
        final currentMeta = Supabase.instance.client.auth.currentUser?.userMetadata;
        remoteCart = currentMeta?['cart'];
      }
      notifier.switchUser(
        user?.id,
        remoteCartData: remoteCart,
      );
    },
    fireImmediately: true,
  );

  return notifier;
});
