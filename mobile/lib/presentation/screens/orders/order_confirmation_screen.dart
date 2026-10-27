import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:micky_mobile/core/constants/app_constants.dart';
import 'package:micky_mobile/core/theme/app_theme.dart';
import 'package:micky_mobile/presentation/screens/orders/order_tracking_screen.dart';
import 'package:micky_mobile/presentation/screens/orders/orders_screen.dart';

class OrderConfirmationScreen extends StatelessWidget {
  final String orderId;
  final String txRef;
  final double totalAmount;
  final String customerName;
  final String customerPhone;
  final String customerEmail;
  final List<String> items;
  final String pickupMethod;
  final String? deliveryAddress;
  final String? estimatedDelivery;

  const OrderConfirmationScreen({
    super.key,
    required this.orderId,
    required this.txRef,
    required this.totalAmount,
    required this.customerName,
    required this.customerPhone,
    required this.customerEmail,
    required this.items,
    this.pickupMethod = 'pickup',
    this.deliveryAddress,
    this.estimatedDelivery,
  });

  void _copyToClipboard(BuildContext context, String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$label copied to clipboard!'),
        backgroundColor: const Color(0xFF16A34A),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  Future<void> _makeSupportCall() async {
    final uri = Uri.parse('tel:+251933694796');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDelivery = pickupMethod.toLowerCase() == 'delivery';

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) {
          context.go('/');
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(
          title: const Text('Order Confirmed', style: TextStyle(fontWeight: FontWeight.bold)),
          centerTitle: true,
          automaticallyImplyLeading: false,
          actions: [
            IconButton(
              icon: const Icon(Icons.close),
              tooltip: 'Home',
              onPressed: () => context.go('/'),
            ),
          ],
        ),
        body: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Celebration Badge
              Container(
                width: 76,
                height: 76,
                decoration: BoxDecoration(
                  color: const Color(0xFFDCFCE7),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF16A34A).withOpacity(0.2),
                      blurRadius: 16,
                      spreadRadius: 4,
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.check_circle_rounded,
                  color: Color(0xFF16A34A),
                  size: 52,
                ),
              ),
              const SizedBox(height: 16),

              const Text(
                'Payment Verified & Order Placed!',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Your transaction was confirmed by Chapa. We are preparing your order.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.grey.shade600,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 24),

              // Order Summary Card
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.grey.shade200),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.03),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header with badges
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Order Number',
                              style: TextStyle(fontSize: 11, color: Colors.grey, fontWeight: FontWeight.w500),
                            ),
                            const SizedBox(height: 2),
                            InkWell(
                              onTap: () => _copyToClipboard(context, txRef, 'Order Reference'),
                              borderRadius: BorderRadius.circular(6),
                              child: Row(
                                children: [
                                  Text(
                                    txRef,
                                    style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.bold,
                                      color: AppTheme.textDark,
                                      fontFamily: 'monospace',
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  const Icon(Icons.copy_rounded, size: 14, color: AppTheme.coral),
                                ],
                              ),
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFDCFCE7),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.shield_rounded, size: 13, color: Color(0xFF16A34A)),
                              SizedBox(width: 4),
                              Text(
                                'PAID & VERIFIED',
                                style: TextStyle(
                                  color: Color(0xFF16A34A),
                                  fontWeight: FontWeight.w800,
                                  fontSize: 10,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const Divider(height: 24),

                    // Purchased Items
                    const Text(
                      'Purchased Devices:',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey),
                    ),
                    const SizedBox(height: 8),
                    ...items.map(
                      (item) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Padding(
                              padding: EdgeInsets.only(top: 2),
                              child: Icon(Icons.check_circle_outline, size: 15, color: AppTheme.coral),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                item,
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: AppTheme.textDark,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const Divider(height: 24),

                    // Delivery & Fulfillment Info
                    _buildDetailRow(
                      icon: isDelivery ? Icons.local_shipping_outlined : Icons.storefront_outlined,
                      title: isDelivery ? 'Delivery Method' : 'Collection Method',
                      value: isDelivery
                          ? (deliveryAddress?.isNotEmpty == true ? deliveryAddress! : 'Courier Home/Office Delivery')
                          : '${AppConstants.shopAddress} (Ground Floor)',
                    ),
                    const SizedBox(height: 10),
                    _buildDetailRow(
                      icon: Icons.access_time_rounded,
                      title: 'Estimated Ready Time',
                      value: estimatedDelivery ?? (isDelivery ? 'Today within 2-4 hours' : 'Immediate In-Store Pickup'),
                    ),
                    const SizedBox(height: 10),
                    _buildDetailRow(
                      icon: Icons.person_outline,
                      title: 'Recipient',
                      value: '$customerName · $customerPhone',
                    ),
                    const Divider(height: 24),

                    // Total Paid
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Total Paid',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                        ),
                        Text(
                          '${totalAmount.toStringAsFixed(0)} ETB',
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            color: AppTheme.coral,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Action 1: Track Order (AliExpress Primary Flow)
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.timeline_rounded, color: Colors.white),
                  label: const Text(
                    'Track Order Live Progress',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Colors.white),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.coral,
                    elevation: 2,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => OrderTrackingScreen(
                          orderId: orderId,
                          txRef: txRef,
                        ),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 12),

              // Action 2: View My Orders
              SizedBox(
                width: double.infinity,
                height: 48,
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.receipt_long_outlined, color: AppTheme.textDark),
                  label: const Text(
                    'View My Orders',
                    style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.textDark),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(color: Colors.grey.shade300),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const OrdersScreen(),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 12),

              // Action 3 & 4: Continue Shopping & Contact Support
              Row(
                children: [
                  Expanded(
                    child: TextButton.icon(
                      icon: const Icon(Icons.store_mall_directory_outlined, size: 18),
                      label: const Text('Continue Shopping'),
                      onPressed: () => context.go('/'),
                    ),
                  ),
                  Expanded(
                    child: TextButton.icon(
                      icon: const Icon(Icons.headset_mic_outlined, size: 18),
                      label: const Text('Contact Support'),
                      onPressed: _makeSupportCall,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDetailRow({
    required IconData icon,
    required String title,
    required String value,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: AppTheme.coral),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(fontSize: 11, color: Colors.grey, fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 1),
              Text(
                value,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textDark),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
