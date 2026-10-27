import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:micky_mobile/core/constants/app_constants.dart';
import 'package:micky_mobile/core/theme/app_theme.dart';

class OrderTrackingScreen extends StatefulWidget {
  final String orderId;
  final String? txRef;

  const OrderTrackingScreen({
    super.key,
    required this.orderId,
    this.txRef,
  });

  @override
  State<OrderTrackingScreen> createState() => _OrderTrackingScreenState();
}

class _OrderTrackingScreenState extends State<OrderTrackingScreen> {
  Map<String, dynamic>? _order;
  List<Map<String, dynamic>> _history = [];
  bool _isLoading = true;
  String? _errorMessage;
  RealtimeChannel? _subscription;

  static const List<Map<String, String>> _allStages = [
    {'key': 'placed', 'title': 'Order Placed'},
    {'key': 'payment_confirmed', 'title': 'Payment Confirmed'},
    {'key': 'confirmed', 'title': 'Order Confirmed'},
    {'key': 'processing', 'title': 'Processing & Quality Inspection'},
    {'key': 'ready_for_dispatch', 'title': 'Ready for Dispatch / Pickup'},
    {'key': 'shipped', 'title': 'Out for Delivery / Shipped'},
    {'key': 'delivered', 'title': 'Delivered & Received'},
  ];

  @override
  void initState() {
    super.initState();
    _loadOrder();
    _setupRealtimeSubscription();
  }

  @override
  void dispose() {
    _subscription?.unsubscribe();
    super.dispose();
  }

  void _setupRealtimeSubscription() {
    try {
      _subscription = Supabase.instance.client
          .channel('order_tracking_${widget.orderId}')
          .onPostgresChanges(
            event: PostgresChangeEvent.update,
            schema: 'public',
            table: 'orders',
            filter: PostgresChangeFilter(
              type: PostgresChangeFilterType.eq,
              column: 'id',
              value: widget.orderId,
            ),
            callback: (payload) {
              if (mounted) {
                _loadOrder();
              }
            },
          )
          .subscribe();
    } catch (_) {}
  }

  Future<void> _loadOrder() async {
    try {
      var query = Supabase.instance.client.from('orders').select('*');
      if (widget.orderId.isNotEmpty && widget.orderId.contains('-') && widget.orderId.length > 20) {
        query = query.eq('id', widget.orderId);
      } else if (widget.txRef != null && widget.txRef!.isNotEmpty) {
        query = query.eq('transaction_ref', widget.txRef!);
      } else {
        query = query.eq('id', widget.orderId);
      }

      final data = await query.maybeSingle();

      if (data == null && widget.txRef != null) {
        final fallback = await Supabase.instance.client
            .from('orders')
            .select('*')
            .eq('transaction_ref', widget.txRef!)
            .maybeSingle();
        if (mounted && fallback != null) {
          _processOrderData(fallback);
          return;
        }
      }

      if (mounted) {
        if (data != null) {
          _processOrderData(data);
        } else {
          setState(() {
            _isLoading = false;
            _errorMessage = 'Order not found';
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = e.toString();
        });
      }
    }
  }

  void _processOrderData(Map<String, dynamic> data) {
    List<Map<String, dynamic>> history = [];

    if (data['status_history'] is List) {
      history = List<Map<String, dynamic>>.from(data['status_history']);
    } else {
      final createdAt = data['created_at']?.toString() ?? DateTime.now().toIso8601String();
      history.add({
        'status': 'placed',
        'title': 'Order Placed',
        'description': 'Order recorded in system',
        'timestamp': createdAt,
      });

      final paymentStatus = (data['payment_status'] ?? '').toString().toLowerCase();
      if (paymentStatus == 'completed' || paymentStatus == 'successful') {
        history.add({
          'status': 'payment_confirmed',
          'title': 'Payment Confirmed',
          'description': 'Payment verified securely with Chapa gateway',
          'timestamp': data['updated_at'] ?? createdAt,
        });
      }
    }

    setState(() {
      _order = data;
      _history = history;
      _isLoading = false;
      _errorMessage = null;
    });
  }

  void _copyToClipboard(String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$label copied to clipboard!'),
        backgroundColor: const Color(0xFF16A34A),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  Future<void> _callSupport() async {
    final uri = Uri.parse('tel:+251933694796');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  @override
  Widget build(BuildContext context) {
    final txRef = _order?['transaction_ref'] ?? widget.txRef ?? widget.orderId;
    final currentStatus = (_order?['order_status'] ?? '').toString().toLowerCase();
    final isDelivered = currentStatus == 'delivered';
    final isCancelled = currentStatus == 'cancelled';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Order Live Tracking', style: TextStyle(fontWeight: FontWeight.bold)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh Status',
            onPressed: () {
              setState(() => _isLoading = true);
              _loadOrder();
            },
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.coral))
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline, size: 48, color: Colors.red),
                        const SizedBox(height: 12),
                        Text(_errorMessage!, textAlign: TextAlign.center),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: _loadOrder,
                          child: const Text('Try Again'),
                        ),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadOrder,
                  color: AppTheme.coral,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Status Header Card
                        _buildStatusHeaderCard(txRef, currentStatus),
                        const SizedBox(height: 20),

                        // Visual Tracking Timeline
                        _buildVisualTimeline(isCancelled),
                        const SizedBox(height: 20),

                        // Shipment & Carrier Details Card (when available)
                        _buildCarrierDetailsCard(),
                        const SizedBox(height: 20),

                        // Customer Support & Direct Contact Card
                        _buildSupportContactCard(),
                      ],
                    ),
                  ),
                ),
    );
  }

  Widget _buildStatusHeaderCard(String txRef, String currentStatus) {
    final amount = _order?['amount']?.toString() ?? '0';
    final paymentStatus = (_order?['payment_status'] ?? 'pending').toString().toUpperCase();
    final isPaid = paymentStatus == 'COMPLETED' || paymentStatus == 'SUCCESSFUL';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Transaction Ref', style: TextStyle(fontSize: 11, color: Colors.grey)),
                  const SizedBox(height: 2),
                  InkWell(
                    onTap: () => _copyToClipboard(txRef, 'Transaction Ref'),
                    child: Row(
                      children: [
                        Text(
                          txRef,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, fontFamily: 'monospace'),
                        ),
                        const SizedBox(width: 4),
                        const Icon(Icons.copy_rounded, size: 13, color: AppTheme.coral),
                      ],
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: isPaid ? const Color(0xFFDCFCE7) : const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Icon(
                      isPaid ? Icons.check_circle : Icons.access_time,
                      size: 13,
                      color: isPaid ? const Color(0xFF16A34A) : const Color(0xFFD97706),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      isPaid ? 'PAID & VERIFIED' : paymentStatus,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: isPaid ? const Color(0xFF16A34A) : const Color(0xFFD97706),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const Divider(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Total Amount', style: TextStyle(fontSize: 11, color: Colors.grey)),
                  const SizedBox(height: 2),
                  Text(
                    '${NumberFormat('#,###').format(double.tryParse(amount) ?? 0)} ETB',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppTheme.coral),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text('Fulfillment', style: TextStyle(fontSize: 11, color: Colors.grey)),
                  const SizedBox(height: 2),
                  Text(
                    _formatStatusTitle(currentStatus),
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.textDark),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildVisualTimeline(bool isCancelled) {
    if (isCancelled) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFFFFE4E6),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFFDA4AF)),
        ),
        child: const Row(
          children: [
            Icon(Icons.cancel_rounded, color: Color(0xFFE11D48), size: 28),
            SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Order Cancelled', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF9F1239))),
                  Text('This order was cancelled. Contact store support if you have questions.', style: TextStyle(fontSize: 11, color: Color(0xFF9F1239))),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade200),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Live Milestones Timeline',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.textDark),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppTheme.coral.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '${_history.length} Completed',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.coral),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Display only milestones that have actually occurred
          if (_history.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Text('Awaiting initial milestone...', style: TextStyle(color: Colors.grey, fontSize: 12)),
            )
          else
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _history.length,
              itemBuilder: (context, index) {
                final milestone = _history[index];
                final isLast = index == _history.length - 1;
                final dateStr = milestone['timestamp']?.toString();
                DateTime? dt = dateStr != null ? DateTime.tryParse(dateStr)?.toLocal() : null;
                final formattedDate = dt != null ? DateFormat('MMM dd, hh:mm a').format(dt) : '';

                return IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Step Circle & Vertical Connector Line
                      Column(
                        children: [
                          Container(
                            width: 22,
                            height: 22,
                            decoration: BoxDecoration(
                              color: isLast ? AppTheme.coral : const Color(0xFF16A34A),
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 2),
                              boxShadow: [
                                BoxShadow(
                                  color: (isLast ? AppTheme.coral : const Color(0xFF16A34A)).withOpacity(0.3),
                                  blurRadius: 6,
                                ),
                              ],
                            ),
                            child: Icon(
                              isLast ? Icons.radio_button_checked : Icons.check,
                              color: Colors.white,
                              size: 12,
                            ),
                          ),
                          if (!isLast)
                            Expanded(
                              child: Container(
                                width: 2,
                                color: const Color(0xFF16A34A).withOpacity(0.4),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(width: 14),

                      // Milestone Content
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    milestone['title']?.toString() ?? _formatStatusTitle(milestone['status']),
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                      color: isLast ? AppTheme.coral : AppTheme.textDark,
                                    ),
                                  ),
                                  if (formattedDate.isNotEmpty)
                                    Text(
                                      formattedDate,
                                      style: TextStyle(fontSize: 10, color: Colors.grey.shade500, fontFamily: 'monospace'),
                                    ),
                                ],
                              ),
                              if (milestone['description'] != null && milestone['description'].toString().isNotEmpty) ...[
                                const SizedBox(height: 3),
                                Text(
                                  milestone['description'].toString(),
                                  style: TextStyle(fontSize: 11, color: Colors.grey.shade600, height: 1.3),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
        ],
      ),
    );
  }

  Widget _buildCarrierDetailsCard() {
    final carrier = _order?['shipping_carrier']?.toString();
    final tracking = _order?['tracking_number']?.toString();
    final est = _order?['estimated_delivery']?.toString();
    final method = (_order?['pickup_method'] ?? 'pickup').toString();
    final address = _order?['delivery_address']?.toString();

    final isDelivery = method.toLowerCase() == 'delivery';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.grey.shade200),
      ),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(isDelivery ? Icons.local_shipping_outlined : Icons.storefront_outlined, color: AppTheme.coral, size: 20),
              const SizedBox(width: 8),
              Text(
                isDelivery ? 'Delivery & Dispatch Details' : 'Store Collection Details',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
            ],
          ),
          const Divider(height: 20),
          _buildInfoRow(
            'Method',
            isDelivery ? 'Courier Direct Dispatch' : 'In-Store Pickup',
          ),
          const SizedBox(height: 8),
          _buildInfoRow(
            isDelivery ? 'Delivery Address' : 'Pickup Location',
            isDelivery
                ? (address?.isNotEmpty == true ? address! : 'Addis Ababa (Customer Contacted)')
                : '${AppConstants.shopAddress} (Ground Floor)',
          ),
          if (carrier != null && carrier.isNotEmpty) ...[
            const SizedBox(height: 8),
            _buildInfoRow('Courier / Rider', carrier),
          ],
          if (tracking != null && tracking.isNotEmpty) ...[
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Tracking Number', style: TextStyle(color: Colors.grey, fontSize: 11)),
                InkWell(
                  onTap: () => _copyToClipboard(tracking, 'Tracking Number'),
                  child: Row(
                    children: [
                      Text(tracking, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, fontFamily: 'monospace')),
                      const SizedBox(width: 4),
                      const Icon(Icons.copy_rounded, size: 12, color: AppTheme.coral),
                    ],
                  ),
                ),
              ],
            ),
          ],
          if (est != null && est.isNotEmpty) ...[
            const SizedBox(height: 8),
            _buildInfoRow('Estimated Arrival', est),
          ],
        ],
      ),
    );
  }

  Widget _buildSupportContactCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Need assistance with your order?',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppTheme.textDark),
          ),
          const SizedBox(height: 4),
          const Text(
            'Our Micky Mobile store team is available 7 days a week at Bole Alemnesh Plaza.',
            style: TextStyle(fontSize: 11, color: Colors.grey),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.phone, size: 16, color: Colors.white),
                  label: const Text('Call Store (+251 93 369 4796)', style: TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.coral,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: _callSupport,
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                style: IconButton.styleFrom(
                  backgroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                icon: const Icon(Icons.chat_bubble_outline, color: AppTheme.coral, size: 20),
                tooltip: 'Live Chat',
                onPressed: () => context.push('/chat'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.grey, fontSize: 11)),
        const SizedBox(width: 12),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 11, color: AppTheme.textDark),
          ),
        ),
      ],
    );
  }

  String _formatStatusTitle(dynamic status) {
    final s = (status ?? '').toString().toLowerCase();
    switch (s) {
      case 'placed':
        return 'Order Placed';
      case 'payment_confirmed':
        return 'Payment Confirmed';
      case 'confirmed':
        return 'Order Confirmed';
      case 'processing':
        return 'Processing';
      case 'ready_for_dispatch':
        return 'Ready for Dispatch';
      case 'shipped':
        return 'Out for Delivery';
      case 'delivered':
        return 'Delivered';
      case 'cancelled':
        return 'Cancelled';
      case 'refunded':
        return 'Refunded';
      default:
        return s.toUpperCase();
    }
  }
}
