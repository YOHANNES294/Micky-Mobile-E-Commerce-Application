import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:micky_mobile/core/constants/app_constants.dart';
import 'package:micky_mobile/core/theme/app_theme.dart';
import 'package:micky_mobile/data/models/phone.dart';
import 'package:micky_mobile/logic/auth_provider.dart';
import 'package:micky_mobile/logic/cart_provider.dart';
import 'package:micky_mobile/logic/phone_provider.dart';
import 'package:micky_mobile/presentation/screens/auth/auth_modal_sheet.dart';
import 'package:micky_mobile/presentation/screens/catalog/product_details_screen.dart';
import 'package:micky_mobile/presentation/screens/chat/live_chat_screen.dart';
import 'package:micky_mobile/presentation/widgets/cart_notification_banner.dart';
import 'package:micky_mobile/presentation/widgets/phone_image_view.dart';
import 'package:micky_mobile/presentation/widgets/promo_slider.dart';
import 'package:micky_mobile/logic/notification_provider.dart';
import 'package:micky_mobile/presentation/widgets/notification_permission_dialog.dart';

class CatalogScreen extends ConsumerWidget {
  const CatalogScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedBrand = ref.watch(brandFilterProvider);
    final phonesAsync = ref.watch(phonesFutureProvider);
    final cartItemCount = ref.watch(cartProvider.select((items) => items.fold(0, (sum, i) => sum + i.quantity)));
    final user = ref.watch(authProvider).value;
    final unreadNotifs = ref.watch(unreadNotificationsCountProvider);

    // Prompt for notification permission when appropriate (not immediately upon raw launch)
    WidgetsBinding.instance.addPostFrameCallback((_) {
      NotificationPermissionDialog.showIfAppropriate(context);
    });

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Image.asset(
              'assets/micky_logo.png',
              width: 32,
              height: 32,
              fit: BoxFit.contain,
              errorBuilder: (_, __, ___) => const SizedBox.shrink(),
            ),
            const SizedBox(width: 8),
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  AppConstants.appName,
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AppTheme.coral),
                ),
                Text(
                  AppConstants.appTagline,
                  style: TextStyle(fontSize: 10, color: Colors.grey),
                ),
              ],
            ),
          ],
        ),
        actions: [
          // Shopping Cart Button
          IconButton(
            icon: Stack(
              clipBehavior: Clip.none,
              children: [
                const Icon(Icons.shopping_bag_outlined, color: AppTheme.textDark),
                if (cartItemCount > 0)
                  Positioned(
                    top: -4,
                    right: -4,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: AppTheme.coral,
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        '$cartItemCount',
                        style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
              ],
            ),
            onPressed: () => context.push('/cart'),
          ),

          // Notifications Bell Button
          IconButton(
            tooltip: 'Notifications',
            icon: Stack(
              clipBehavior: Clip.none,
              children: [
                const Icon(Icons.notifications_outlined, color: AppTheme.textDark),
                if (unreadNotifs > 0)
                  Positioned(
                    top: -3,
                    right: -3,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: Colors.red,
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        unreadNotifs > 9 ? '9+' : '$unreadNotifs',
                        style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
              ],
            ),
            onPressed: () => context.push('/notifications'),
          ),

          // Message / Store Chat Button
          IconButton(
            icon: const Icon(Icons.chat_bubble_outline, color: AppTheme.coral),
            onPressed: () {
              if (user == null) {
                ref.read(pendingActionProvider.notifier).state = const PendingAction(
                  type: PendingActionType.openChat,
                );
                AuthModalSheet.show(
                  context,
                  title: 'Chat With Our Store',
                  message: 'Please sign in or create an account to start a live conversation with our sales team.',
                );
              } else {
                context.push('/chat');
              }
            },
          ),

          // Customer Profile Button
          IconButton(
            tooltip: 'Customer Profile',
            icon: user != null
                ? CircleAvatar(
                    radius: 14,
                    backgroundColor: AppTheme.coral,
                    child: Text(
                      user.fullName.isNotEmpty ? user.fullName[0].toUpperCase() : 'U',
                      style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                  )
                : const Icon(Icons.person_outline, color: AppTheme.textDark),
            onPressed: () => context.push('/profile'),
          ),
        ],
      ),
      body: phonesAsync.when(
        data: (phones) {
          final filtered = selectedBrand == 'All'
              ? phones
              : phones.where((p) => p.brand.toLowerCase() == selectedBrand.toLowerCase()).toList();

          // 3 rows of 2 columns = 6 items
          final firstBatch = filtered.take(6).toList();
          final secondBatch = filtered.length > 6 ? filtered.skip(6).toList() : <Phone>[];

          return CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              // 1. Brand Filter Chips (All, Samsung, iPhone)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                  child: Row(
                    children: ['All', 'Samsung', 'iPhone'].map((brand) {
                      final isSelected = selectedBrand == brand;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8.0),
                        child: FilterChip(
                          label: Text(brand),
                          selected: isSelected,
                          onSelected: (_) => ref.read(brandFilterProvider.notifier).state = brand,
                          selectedColor: AppTheme.coral,
                          labelStyle: TextStyle(
                            color: isSelected ? Colors.white : AppTheme.textDark,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          ),
                          backgroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20),
                            side: BorderSide(color: isSelected ? AppTheme.coral : Colors.grey.shade300),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ),

              // 2. Top Hero Promotional Carousel (Auto-slide between all 3 banners)
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.only(top: 4.0, bottom: 8.0),
                  child: PromoSlider(),
                ),
              ),

              // 3. Section Title
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16.0, 12.0, 16.0, 8.0),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        selectedBrand == 'All' ? 'Available Phones' : '$selectedBrand Models',
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textDark,
                        ),
                      ),
                      Text(
                        '${filtered.length} phones',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              if (filtered.isEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 40.0),
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.phone_android, size: 48, color: Colors.grey),
                          const SizedBox(height: 12),
                          Text('No $selectedBrand phones available at the moment.'),
                        ],
                      ),
                    ),
                  ),
                )
              else ...[
                // 4. First 3 Rows (up to 6 phones)
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16.0),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      childAspectRatio: 0.65,
                      crossAxisSpacing: 14,
                      mainAxisSpacing: 14,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (context, index) => _PhoneGridCard(phone: firstBatch[index]),
                      childCount: firstBatch.length,
                    ),
                  ),
                ),

                // 5. In-Feed Promotional Banner at Row 3 Gap!
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 8.0),
                    child: Row3BreakBanner(),
                  ),
                ),

                // 6. Products after Row 3 Gap (Rows 4+)
                if (secondBatch.isNotEmpty)
                  SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0),
                    sliver: SliverGrid(
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        childAspectRatio: 0.65,
                        crossAxisSpacing: 14,
                        mainAxisSpacing: 14,
                      ),
                      delegate: SliverChildBuilderDelegate(
                        (context, index) => _PhoneGridCard(phone: secondBatch[index]),
                        childCount: secondBatch.length,
                      ),
                    ),
                  ),
              ],

              // Bottom Spacer
              const SliverToBoxAdapter(
                child: SizedBox(height: 32),
              ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator(color: AppTheme.coral)),
        error: (err, _) => Center(child: Text('Error: $err')),
      ),
    );
  }
}

class _PhoneGridCard extends ConsumerWidget {
  final Phone phone;
  const _PhoneGridCard({required this.phone});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isNew = phone.isNew;

    return Card(
      clipBehavior: Clip.antiAlias,
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: InkWell(
        onTap: () {
          // Check authentication for clicking product card / image
          final user = ref.read(authProvider).value;
          if (user == null) {
            // Store selected phone and intended action
            ref.read(pendingActionProvider.notifier).state = PendingAction(
              type: PendingActionType.openProductDetails,
              phone: phone,
            );
            // Open sign-in popup
            AuthModalSheet.show(
              context,
              title: 'View ${phone.brand} ${phone.model}',
              message: 'Please sign in or create an account to view full specifications, battery reports, and purchase options.',
            );
          } else {
            // Already authenticated: Open details immediately
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => ProductDetailsScreen(phone: phone),
              ),
            );
          }
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. Phone Image with condition badge & message icon overlay
            Expanded(
              child: Stack(
                children: [
                  Positioned.fill(
                    child: PhoneImageView(
                      imageUrl: phone.imageUrl,
                      brand: phone.brand,
                      model: phone.model,
                      fit: BoxFit.cover,
                    ),
                  ),

                  // Condition Badge (Top-Left)
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                      decoration: BoxDecoration(
                        color: isNew ? const Color(0xFF16A34A) : AppTheme.gold,
                        borderRadius: BorderRadius.circular(6),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.2),
                            blurRadius: 4,
                          ),
                        ],
                      ),
                      child: Text(
                        phone.condition.toUpperCase(),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ),
                  ),

                  // Independent Message Icon Overlay (Bottom-Right)
                  Positioned(
                    bottom: 8,
                    right: 8,
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () {
                          // Clicking message icon starts product-specific conversation!
                          final user = ref.read(authProvider).value;
                          if (user == null) {
                            // Queue pending action to open this specific phone's chat after login
                            ref.read(pendingActionProvider.notifier).state = PendingAction(
                              type: PendingActionType.chatWithPhone,
                              phone: phone,
                            );
                            AuthModalSheet.show(
                              context,
                              title: 'Chat About ${phone.brand} ${phone.model}',
                              message: 'Please sign in or create an account to start a conversation about this phone with our sales team.',
                            );
                          } else {
                            // Already logged in: open conversation immediately
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => LiveChatScreen(attachedPhone: phone),
                              ),
                            );
                          }
                        },
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          padding: const EdgeInsets.all(7),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.25),
                                blurRadius: 6,
                                offset: const Offset(0, 2),
                              ),
                            ],
                            border: Border.all(
                              color: AppTheme.coral.withOpacity(0.3),
                              width: 1,
                            ),
                          ),
                          child: const Icon(
                            Icons.chat_bubble_outline_rounded,
                            size: 17,
                            color: AppTheme.coral,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // 2. Info & Action section
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${phone.brand} ${phone.model}',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    '${phone.storage} · ${phone.ram}',
                    style: const TextStyle(color: Colors.grey, fontSize: 11),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${phone.formattedPrice} ETB',
                    style: const TextStyle(
                      color: AppTheme.coral,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 6),
                  SizedBox(
                    width: double.infinity,
                    height: 32,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        padding: EdgeInsets.zero,
                        textStyle: const TextStyle(fontSize: 12),
                      ),
                      onPressed: () {
                        final user = ref.read(authProvider).value;
                        if (user == null) {
                          ref.read(pendingActionProvider.notifier).state = PendingAction(
                            type: PendingActionType.addToCart,
                            phone: phone,
                          );
                          AuthModalSheet.show(
                            context,
                            title: 'Add to Cart',
                            message: 'Please sign in or create an account to add ${phone.brand} ${phone.model} to your cart.',
                          );
                        } else {
                          ref.read(cartProvider.notifier).add(phone);
                          CartNotificationBanner.show(
                            context: context,
                            phoneName: '${phone.brand} ${phone.model}',
                            displayDuration: const Duration(seconds: 3),
                            onViewCart: () => context.push('/cart'),
                          );
                        }
                      },
                      child: const Text('Add to Cart'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
