import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
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
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

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

      if (data != null && mounted) {
        _processOrderData(data);
        return;
      }

      if (widget.txRef != null) {
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

      // Fallback: Authoritative backend endpoint which uses service role
      final ref = (widget.txRef != null && widget.txRef!.isNotEmpty)
          ? widget.txRef!
          : widget.orderId;

      if (ref.isNotEmpty) {
        try {
          final backendUrl = Uri.parse(
            '${AppConstants.apiBaseUrl}/payments/chapa/verify?tx_ref=${Uri.encodeComponent(ref)}',
          );
          final resp = await http.get(backendUrl).timeout(const Duration(seconds: 8));
          if (resp.statusCode == 200) {
            final json = jsonDecode(resp.body);
            if (json['order'] != null && mounted) {
              _processOrderData(Map<String, dynamic>.from(json['order']));
              return;
            }
          }
        } catch (_) {}
      }

      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Order not found';
        });
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

    // Derive current status if not explicitly present in DB
    String currentStatus = (data['order_status'] ?? '').toString().toLowerCase();
    final paymentStatus = (data['payment_status'] ?? '').toString().toLowerCase();
    final fulfillmentStatus = (data['fulfillment_status'] ?? '').toString().toLowerCase();

    if (currentStatus.isEmpty) {
      if (fulfillmentStatus == 'fulfilled') {
        currentStatus = 'delivered';
      } else if (fulfillmentStatus == 'processing') {
        currentStatus = 'processing';
      } else if (paymentStatus == 'completed' || paymentStatus == 'successful') {
        currentStatus = 'payment_confirmed';
      } else {
        currentStatus = 'placed';
      }
      data['order_status'] = currentStatus;
    }

    if (data['status_history'] is List && (data['status_history'] as List).isNotEmpty) {
      history = List<Map<String, dynamic>>.from(data['status_history']);
    } else {
      final createdAt = data['created_at']?.toString() ?? DateTime.now().toIso8601String();
      history.add({
        'status': 'placed',
        'title': 'Order Placed',
        'description': 'Order recorded in Micky Mobile store',
        'timestamp': createdAt,
      });

      if (paymentStatus == 'completed' || paymentStatus == 'successful') {
        history.add({
          'status': 'payment_confirmed',
          'title': 'Payment Confirmed',
          'description': 'Payment verified securely with Chapa gateway',
          'timestamp': data['updated_at'] ?? createdAt,
        });
      }

      if (fulfillmentStatus == 'processing') {
        history.add({
          'status': 'processing',
          'title': 'Processing & Quality Inspection',
          'description': 'Order is being prepared and inspected',
          'timestamp': data['updated_at'] ?? createdAt,
        });
      } else if (fulfillmentStatus == 'fulfilled') {
        history.add({
          'status': 'delivered',
          'title': 'Delivered & Received',
          'description': 'Device successfully handed over / delivered',
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
                        const SizedBox(height: 16),

                        // Purchased Products Card
                        _buildPurchasedProductsCard(),
                        const SizedBox(height: 16),

                        // Visual Tracking Timeline
                        _buildVisualTimeline(isCancelled),
                        const SizedBox(height: 16),

                        // Shipment & Carrier Details Card (when available)
                        _buildCarrierDetailsCard(),
                        const SizedBox(height: 16),

                        // Customer Support & Direct Contact Card
                        _buildSupportContactCard(),

                        if (_isEligibleForCancellation(currentStatus)) ...[
                          const SizedBox(height: 16),
                          _buildCancelOrderButton(),
                        ],
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

  Widget _buildPurchasedProductsCard() {
    final items = (_order?['items'] is List && (_order!['items'] as List).isNotEmpty)
        ? List<Map<String, dynamic>>.from(_order!['items'])
        : <Map<String, dynamic>>[];

    if (items.isEmpty && _order?['phone'] is Map) {
      final p = _order!['phone'] as Map<String, dynamic>;
      items.add({
        'brand': p['brand'] ?? 'Samsung',
        'model': p['model'] ?? 'Galaxy A15',
        'storage': p['storage'] ?? '',
        'ram': p['ram'] ?? '',
        'quantity': 1,
        'price': double.tryParse(p['price']?.toString() ?? '0') ?? double.tryParse(_order?['amount']?.toString() ?? '0') ?? 0,
        'image': p['image'],
      });
    }

    if (items.isEmpty) {
      final amount = _order?['amount']?.toString() ?? '0';
      items.add({
        'brand': 'Micky Mobile',
        'model': 'Selected Device',
        'quantity': 1,
        'price': double.tryParse(amount) ?? 0,
      });
    }

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
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Purchased Products',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.textDark),
              ),
              Text(
                '${items.length} ${items.length == 1 ? "item" : "items"}',
                style: const TextStyle(fontSize: 12, color: Colors.grey),
              ),
            ],
          ),
          const Divider(height: 18),
          ...items.map((it) {
            final brand = it['brand']?.toString() ?? '';
            final model = it['model']?.toString() ?? 'Mobile Device';
            final storage = it['storage']?.toString() ?? '';
            final ram = it['ram']?.toString() ?? '';
            final qty = it['quantity'] ?? 1;
            final price = double.tryParse(it['price']?.toString() ?? '0') ?? 0;
            final image = it['image']?.toString();

            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 6.0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.grey.shade200),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: image != null && image.isNotEmpty
                        ? Image.network(
                            image,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => const Icon(Icons.phone_android, color: Colors.grey),
                          )
                        : const Icon(Icons.phone_android, color: Colors.grey),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '$brand $model',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppTheme.textDark),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (storage.isNotEmpty || ram.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            [if (storage.isNotEmpty) storage, if (ram.isNotEmpty) '$ram RAM'].join(' • '),
                            style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                          ),
                        ],
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '${NumberFormat('#,###').format(price)} ETB',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppTheme.coral),
                      ),
                      Text(
                        'Qty: $qty',
                        style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }),
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

    final isPickup = (_order?['pickup_method'] ?? 'pickup').toString().toLowerCase() == 'pickup';

    // AliExpress defined milestone progression
    final List<Map<String, String>> lifecycleStages = isPickup
        ? [
            {'key': 'placed', 'title': 'Order Placed', 'desc': 'Order created and registered in store'},
            {'key': 'payment_confirmed', 'title': 'Payment Confirmed', 'desc': 'Chapa transaction verified securely'},
            {'key': 'confirmed', 'title': 'Order Confirmed', 'desc': 'Accepted and queued by store manager'},
            {'key': 'processing', 'title': 'Processing & Quality Inspection', 'desc': 'Device IMEI verified & inspected'},
            {'key': 'ready_for_pickup', 'title': 'Ready for In-Store Pickup', 'desc': 'Staged at Bole Alemnesh Ground Floor counter'},
            {'key': 'picked_up', 'title': 'Picked Up & Completed', 'desc': 'Device handed over to customer'},
          ]
        : [
            {'key': 'placed', 'title': 'Order Placed', 'desc': 'Order created and registered in store'},
            {'key': 'payment_confirmed', 'title': 'Payment Confirmed', 'desc': 'Chapa transaction verified securely'},
            {'key': 'confirmed', 'title': 'Order Confirmed', 'desc': 'Accepted and queued by store manager'},
            {'key': 'processing', 'title': 'Processing & Quality Inspection', 'desc': 'Device IMEI verified & inspected'},
            {'key': 'ready_for_dispatch', 'title': 'Ready for Dispatch', 'desc': 'Packaged and staged for courier'},
            {'key': 'shipped', 'title': 'Shipped & In Transit', 'desc': 'Courier rider has collected device'},
            {'key': 'out_for_delivery', 'title': 'Out for Delivery', 'desc': 'Rider is on final delivery route'},
            {'key': 'delivered', 'title': 'Delivered & Completed', 'desc': 'Device delivered and verified'},
          ];

    final currentStatus = (_order?['order_status'] ?? 'placed').toString().toLowerCase();

    // Map history entries by status key
    final Map<String, Map<String, dynamic>> historyMap = {};
    for (final h in _history) {
      final s = (h['status'] ?? '').toString().toLowerCase();
      if (s.isNotEmpty) historyMap[s] = h;
    }

    // Determine current index in lifecycle
    int currentIndex = lifecycleStages.indexWhere((st) => st['key'] == currentStatus);
    if (currentIndex == -1) {
      if (currentStatus == 'delivered' || currentStatus == 'picked_up') {
        currentIndex = lifecycleStages.length - 1;
      } else if (currentStatus == 'shipped' || currentStatus == 'out_for_delivery') {
        currentIndex = lifecycleStages.indexWhere((st) => st['key'] == 'shipped');
      } else {
        currentIndex = 1;
      }
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
                'Live Tracking Timeline',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.textDark),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppTheme.coral.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  'Stage ${currentIndex + 1} of ${lifecycleStages.length}',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.coral),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),

          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: lifecycleStages.length,
            itemBuilder: (context, index) {
              final stage = lifecycleStages[index];
              final stageKey = stage['key']!;
              final isLast = index == lifecycleStages.length - 1;

              final isCompleted = index < currentIndex;
              final isCurrent = index == currentIndex;
              final isUpcoming = index > currentIndex;

              final matchedMilestone = historyMap[stageKey];
              final dateStr = matchedMilestone?['timestamp']?.toString();
              DateTime? dt = dateStr != null ? DateTime.tryParse(dateStr)?.toLocal() : null;
              final formattedDate = dt != null ? DateFormat('MMM dd, hh:mm a').format(dt) : '';
              final note = matchedMilestone?['description']?.toString() ?? stage['desc']!;

              return IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Stepper Node & Line
                    Column(
                      children: [
                        Container(
                          width: 24,
                          height: 24,
                          decoration: BoxDecoration(
                            color: isCompleted
                                ? const Color(0xFF16A34A)
                                : isCurrent
                                    ? AppTheme.coral
                                    : Colors.white,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: isCompleted
                                  ? const Color(0xFF16A34A)
                                  : isCurrent
                                      ? AppTheme.coral
                                      : Colors.grey.shade300,
                              width: 2,
                            ),
                            boxShadow: isCurrent
                                ? [
                                    BoxShadow(
                                      color: AppTheme.coral.withOpacity(0.35),
                                      blurRadius: 8,
                                      spreadRadius: 1,
                                    ),
                                  ]
                                : null,
                          ),
                          child: Icon(
                            isCompleted
                                ? Icons.check
                                : isCurrent
                                    ? Icons.radio_button_checked
                                    : Icons.circle,
                            color: isCompleted || isCurrent ? Colors.white : Colors.grey.shade300,
                            size: isCompleted ? 13 : isCurrent ? 13 : 8,
                          ),
                        ),
                        if (!isLast)
                          Expanded(
                            child: Container(
                              width: 2,
                              color: isCompleted
                                  ? const Color(0xFF16A34A).withOpacity(0.5)
                                  : Colors.grey.shade200,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(width: 14),

                    // Milestone Info
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 22),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      stage['title']!,
                                      style: TextStyle(
                                        fontWeight: isCurrent || isCompleted ? FontWeight.bold : FontWeight.w500,
                                        fontSize: 13,
                                        color: isCurrent
                                            ? AppTheme.coral
                                            : isCompleted
                                                ? AppTheme.textDark
                                                : Colors.grey.shade500,
                                      ),
                                    ),
                                    if (isCurrent) ...[
                                      const SizedBox(width: 6),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                        decoration: BoxDecoration(
                                          color: AppTheme.coral,
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: const Text(
                                          'CURRENT',
                                          style: TextStyle(fontSize: 8, fontWeight: FontWeight.bold, color: Colors.white),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                                if (formattedDate.isNotEmpty)
                                  Text(
                                    formattedDate,
                                    style: TextStyle(fontSize: 10, color: Colors.grey.shade500, fontFamily: 'monospace'),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 3),
                            Text(
                              isUpcoming ? 'Upcoming stage' : note,
                              style: TextStyle(
                                fontSize: 11,
                                color: isUpcoming ? Colors.grey.shade400 : Colors.grey.shade600,
                                height: 1.3,
                              ),
                            ),
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

  bool _isEligibleForCancellation(String status) {
    final s = status.toLowerCase();
    return s == 'placed' || s == 'payment_confirmed' || s == 'confirmed';
  }

  Widget _buildCancelOrderButton() {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        icon: const Icon(Icons.cancel_outlined, color: Color(0xFFE11D48), size: 18),
        label: const Text('Cancel Order', style: TextStyle(color: Color(0xFFE11D48), fontWeight: FontWeight.bold)),
        style: OutlinedButton.styleFrom(
          side: const BorderSide(color: Color(0xFFFDA4AF)),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          padding: const EdgeInsets.symmetric(vertical: 12),
        ),
        onPressed: _showCancellationDialog,
      ),
    );
  }

  void _showCancellationDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel Order?'),
        content: const Text(
          'Are you sure you want to cancel this order? If payment was completed, store staff will initiate a refund.',
          style: TextStyle(fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Keep Order'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFE11D48)),
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                final id = _order?['id'];
                if (id != null) {
                  await Supabase.instance.client.from('orders').update({
                    'order_status': 'cancelled',
                    'fulfillment_status': 'cancelled',
                  }).eq('id', id);
                  _loadOrder();
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Order cancelled successfully.'),
                      backgroundColor: Color(0xFFE11D48),
                    ),
                  );
                }
              } catch (e) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Failed to cancel order: $e')),
                );
              }
            },
            child: const Text('Confirm Cancel', style: TextStyle(color: Colors.white)),
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
