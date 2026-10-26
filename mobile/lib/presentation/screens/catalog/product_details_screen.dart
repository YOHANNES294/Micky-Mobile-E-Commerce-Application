import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:micky_mobile/core/theme/app_theme.dart';
import 'package:micky_mobile/data/models/phone.dart';
import 'package:micky_mobile/logic/auth_provider.dart';
import 'package:micky_mobile/logic/cart_provider.dart';
import 'package:micky_mobile/presentation/screens/auth/auth_modal_sheet.dart';
import 'package:micky_mobile/presentation/screens/chat/live_chat_screen.dart';
import 'package:micky_mobile/presentation/widgets/cart_notification_banner.dart';
import 'package:micky_mobile/presentation/widgets/phone_image_view.dart';

class ProductDetailsScreen extends ConsumerStatefulWidget {
  final Phone phone;

  const ProductDetailsScreen({
    super.key,
    required this.phone,
  });

  @override
  ConsumerState<ProductDetailsScreen> createState() => _ProductDetailsScreenState();
}

class _ProductDetailsScreenState extends ConsumerState<ProductDetailsScreen> {
  bool _isWishlisted = false;

  void _handleAddToCart() {
    final user = ref.read(authProvider).value;
    if (user == null) {
      ref.read(pendingActionProvider.notifier).state = PendingAction(
        type: PendingActionType.addToCart,
        phone: widget.phone,
      );
      AuthModalSheet.show(
        context,
        title: 'Add to Cart',
        message: 'Please sign in or register to add ${widget.phone.brand} ${widget.phone.model} to your account cart.',
      );
    } else {
      ref.read(cartProvider.notifier).add(widget.phone);
      CartNotificationBanner.show(
        context: context,
        phoneName: '${widget.phone.brand} ${widget.phone.model}',
        displayDuration: const Duration(seconds: 3),
        onViewCart: () => context.push('/cart'),
      );
    }
  }

  void _handleBuyNow() {
    final user = ref.read(authProvider).value;
    if (user == null) {
      ref.read(pendingActionProvider.notifier).state = PendingAction(
        type: PendingActionType.buyNow,
        phone: widget.phone,
      );
      AuthModalSheet.show(
        context,
        title: 'Instant Purchase',
        message: 'Please sign in or create an account to proceed directly to checkout.',
      );
    } else {
      ref.read(cartProvider.notifier).add(widget.phone);
      context.push('/cart');
    }
  }

  void _handleChatWithSeller() {
    final user = ref.read(authProvider).value;
    if (user == null) {
      ref.read(pendingActionProvider.notifier).state = PendingAction(
        type: PendingActionType.chatWithPhone,
        phone: widget.phone,
      );
      AuthModalSheet.show(
        context,
        title: 'Chat About This Phone',
        message: 'Please sign in or create an account to start a conversation about ${widget.phone.brand} ${widget.phone.model}.',
      );
    } else {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => LiveChatScreen(attachedPhone: widget.phone),
        ),
      );
    }
  }

  void _toggleWishlist() {
    final user = ref.read(authProvider).value;
    if (user == null) {
      ref.read(pendingActionProvider.notifier).state = PendingAction(
        type: PendingActionType.addToWishlist,
        phone: widget.phone,
      );
      AuthModalSheet.show(
        context,
        title: 'Save to Wishlist',
        message: 'Sign in to save this phone to your favorites list.',
      );
      return;
    }

    setState(() => _isWishlisted = !_isWishlisted);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          _isWishlisted
              ? '${widget.phone.brand} ${widget.phone.model} added to your Wishlist!'
              : '${widget.phone.brand} ${widget.phone.model} removed from Wishlist.',
        ),
        duration: const Duration(seconds: 2),
        backgroundColor: _isWishlisted ? const Color(0xFF16A34A) : Colors.grey.shade800,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final phone = widget.phone;
    final isNew = phone.isNew;

    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: Text(
          '${phone.brand} ${phone.model}',
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
        ),
        actions: [
          IconButton(
            icon: Icon(
              _isWishlisted ? Icons.favorite : Icons.favorite_border,
              color: _isWishlisted ? AppTheme.coral : AppTheme.textDark,
            ),
            tooltip: 'Wishlist',
            onPressed: _toggleWishlist,
          ),
          IconButton(
            icon: const Icon(Icons.share_outlined, color: AppTheme.textDark),
            tooltip: 'Share Phone',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Sharing ${phone.brand} ${phone.model} link...'),
                  duration: const Duration(seconds: 1),
                ),
              );
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 100),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. Image Header Section
            Container(
              height: 300,
              width: double.infinity,
              color: Colors.white,
              child: Stack(
                children: [
                  Positioned.fill(
                    child: Padding(
                      padding: const EdgeInsets.all(20.0),
                      child: PhoneImageView(
                        imageUrl: phone.imageUrl,
                        brand: phone.brand,
                        model: phone.model,
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),

                  // Condition badge
                  Positioned(
                    top: 16,
                    left: 16,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: isNew ? const Color(0xFF16A34A) : AppTheme.gold,
                        borderRadius: BorderRadius.circular(8),
                        boxShadow: [
                          BoxShadow(color: Colors.black.withOpacity(0.15), blurRadius: 4),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            isNew ? Icons.verified : Icons.recycling_rounded,
                            size: 14,
                            color: Colors.white,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            isNew ? 'BRAND NEW' : phone.condition.toUpperCase(),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Brand Badge
                  Positioned(
                    top: 16,
                    right: 16,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.grey.shade300),
                        boxShadow: [
                          BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 4),
                        ],
                      ),
                      child: Text(
                        phone.brand,
                        style: const TextStyle(
                          color: AppTheme.textDark,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 12),

            // 2. Title, Price, and Stock Card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(18),
              color: Colors.white,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          '${phone.brand} ${phone.model}',
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textDark,
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: phone.isAvailable ? Colors.green.shade50 : Colors.red.shade50,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: phone.isAvailable ? Colors.green.shade300 : Colors.red.shade300,
                          ),
                        ),
                        child: Text(
                          phone.isAvailable ? 'In Stock (${phone.stock})' : 'Out of Stock',
                          style: TextStyle(
                            color: phone.isAvailable ? Colors.green.shade700 : Colors.red.shade700,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${phone.storage} Storage · ${phone.ram} RAM${phone.color != null ? " · ${phone.color}" : ""}',
                    style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(
                        '${phone.formattedPrice} ETB',
                        style: const TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w900,
                          color: AppTheme.coral,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Tax Included · Free Delivery',
                        style: TextStyle(color: Colors.grey.shade500, fontSize: 11),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 12),

            // 3. Description / Highlights
            if (phone.description != null && phone.description!.isNotEmpty) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(18),
                color: Colors.white,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Overview & Highlights',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      phone.description!,
                      style: TextStyle(fontSize: 13, color: Colors.grey.shade800, height: 1.5),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],

            // 4. Condition & Inspection Report (Crucial for Used/New phones)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(18),
              color: Colors.white,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        isNew ? Icons.verified_user_outlined : Icons.health_and_safety_outlined,
                        color: isNew ? const Color(0xFF16A34A) : AppTheme.gold,
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        isNew ? 'New Product Verification' : 'Used Phone Inspection Report',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _buildInspectionTile(
                    'Overall Condition',
                    isNew ? 'Brand New Sealed in Box' : phone.condition,
                    Icons.check_circle_outline,
                    color: isNew ? const Color(0xFF16A34A) : AppTheme.gold,
                  ),
                  if (phone.batteryHealth != null || phone.battery != null)
                    _buildInspectionTile(
                      'Battery Health / Capacity',
                      phone.batteryHealth ?? phone.battery ?? 'Optimal (100%)',
                      Icons.battery_charging_full_rounded,
                    ),
                  _buildInspectionTile(
                    'Cosmetic & Screen State',
                    phone.defects ?? (isNew ? 'Flawless, factory original' : 'Inspected, excellent working condition'),
                    Icons.phone_android_rounded,
                  ),
                  _buildInspectionTile(
                    'Network & Lock Status',
                    'Factory Unlocked for all Ethiopian Networks (Ethio Telecom & Safaricom)',
                    Icons.lock_open_rounded,
                  ),
                  _buildInspectionTile(
                    'Included Accessories',
                    isNew ? 'Full Retail Box, Fast Charger & USB Cable' : 'Original Fast Charger & Cable included',
                    Icons.cable_rounded,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 12),

            // 5. Full Technical Specifications
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(18),
              color: Colors.white,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Technical Specifications',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  _buildSpecRow('Brand', phone.brand),
                  _buildSpecRow('Model', phone.model),
                  _buildSpecRow('Storage Capacity', phone.storage),
                  _buildSpecRow('RAM Memory', phone.ram),
                  if (phone.battery != null) _buildSpecRow('Battery Capacity', phone.battery!),
                  if (phone.network != null) _buildSpecRow('Network Compatibility', phone.network!),
                  if (phone.sim != null) _buildSpecRow('SIM Configuration', phone.sim!),
                  _buildSpecRow('Warranty Coverage', phone.warranty),
                  _buildSpecRow('Item ID', phone.id),
                ],
              ),
            ),

            const SizedBox(height: 12),

            // 6. Warranty & Delivery Store Info
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(18),
              color: Colors.white,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Seller & Guarantee',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppTheme.coral.withOpacity(0.08),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.storefront_rounded, color: AppTheme.coral, size: 24),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              phone.sellerName,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                            ),
                            Text(
                              'Bole Road, Addis Ababa · Verified Seller',
                              style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Divider(),
                  const SizedBox(height: 8),
                  const Row(
                    children: [
                      Icon(Icons.shield_outlined, size: 16, color: Color(0xFF16A34A)),
                      SizedBox(width: 6),
                      Text(
                        '100% Genuine Micky Mobile Guarantee · 7-Day Return Policy',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),

      // 7. Bottom Customer Purchase Action Bar
      bottomSheet: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.08),
              blurRadius: 10,
              offset: const Offset(0, -3),
            ),
          ],
        ),
        child: SafeArea(
          child: Row(
            children: [
              // Chat with Seller Icon Button
              Container(
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey.shade300),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: IconButton(
                  icon: const Icon(Icons.chat_bubble_outline_rounded, color: AppTheme.coral),
                  tooltip: 'Chat with Seller',
                  onPressed: _handleChatWithSeller,
                ),
              ),
              const SizedBox(width: 10),

              // Add to Cart Button
              Expanded(
                child: SizedBox(
                  height: 48,
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppTheme.coral,
                      side: const BorderSide(color: AppTheme.coral, width: 1.5),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      padding: EdgeInsets.zero,
                    ),
                    onPressed: _handleAddToCart,
                    child: const Text(
                      'Add to Cart',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),

              // Buy Now Button
              Expanded(
                child: SizedBox(
                  height: 48,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.coral,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 1,
                      padding: EdgeInsets.zero,
                    ),
                    onPressed: _handleBuyNow,
                    child: const Text(
                      'Buy Now',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInspectionTile(String label, String value, IconData icon, {Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: color ?? Colors.grey.shade600),
          const SizedBox(width: 10),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: const TextStyle(fontSize: 13, color: AppTheme.textDark),
                children: [
                  TextSpan(
                    text: '$label: ',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  TextSpan(
                    text: value,
                    style: TextStyle(color: color ?? Colors.grey.shade700),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSpecRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
          Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: AppTheme.textDark),
          ),
        ],
      ),
    );
  }
}
