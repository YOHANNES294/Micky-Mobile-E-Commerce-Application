import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:micky_mobile/core/constants/app_constants.dart';
import 'package:micky_mobile/core/theme/app_theme.dart';
import 'package:micky_mobile/data/models/order_receipt.dart';
import 'package:micky_mobile/logic/auth_provider.dart';
import 'package:micky_mobile/presentation/screens/cart/receipt_screen.dart';
import 'package:micky_mobile/presentation/screens/orders/order_tracking_screen.dart';

class OrdersScreen extends ConsumerStatefulWidget {
  final String? initialFilter;
  const OrdersScreen({super.key, this.initialFilter});

  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends ConsumerState<OrdersScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<Map<String, dynamic>> _orders = [];
  bool _isLoading = true;
  String? _error;
  RealtimeChannel? _realtimeChannel;

  @override
  void initState() {
    super.initState();
    int initialIndex = 0;
    final f = (widget.initialFilter ?? '').toLowerCase().trim();
    if (f == 'pending' || f == 'topay' || f == 'to_pay') {
      initialIndex = 1;
    } else if (f == 'toship' || f == 'to_ship' || f == 'processing' || f == 'active') {
      initialIndex = 2;
    } else if (f == 'toreceive' || f == 'to_receive' || f == 'shipped' || f == 'transit') {
      initialIndex = 3;
    } else if (f == 'completed' || f == 'fulfilled' || f == 'delivered') {
      initialIndex = 4;
    } else if (f == 'cancelled' || f == 'canceled') {
      initialIndex = 5;
    } else if (f == 'refunded' || f == 'refund' || f == 'returns') {
      initialIndex = 6;
    }

    _tabController = TabController(length: 7, vsync: this, initialIndex: initialIndex);
    _loadOrders();
    _subscribeToOrderChanges();
  }

  @override
  void dispose() {
    _realtimeChannel?.unsubscribe();
    _tabController.dispose();
    super.dispose();
  }

  void _subscribeToOrderChanges() {
    final appUser = ref.read(authProvider).value;
    final sbUser = Supabase.instance.client.auth.currentUser;
    final userId = appUser?.id ?? sbUser?.id;
    if (userId == null) return;

    try {
      _realtimeChannel = Supabase.instance.client
          .channel('public:orders_user_$userId')
          .onPostgresChanges(
            event: PostgresChangeEvent.all,
            schema: 'public',
            table: 'orders',
            filter: PostgresChangeFilter(
              type: PostgresChangeFilterType.eq,
              column: 'client_id',
              value: userId,
            ),
            callback: (payload) {
              if (mounted) {
                _loadOrders();
              }
            },
          )
          .subscribe();
    } catch (_) {}
  }

  Future<void> _loadOrders() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    final authUser = Supabase.instance.client.auth.currentUser;
    final user = ref.read(authProvider).value;
    final effectiveUserId = user?.id ?? authUser?.id;
    final effectiveEmail = user?.email ?? authUser?.email;

    if (effectiveUserId == null && effectiveEmail == null) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _orders = [];
        });
      }
      return;
    }

    try {
      List<Map<String, dynamic>> orderList = [];

      // 1. Primary Supabase query by client_id
      if (effectiveUserId != null) {
        try {
          final data = await Supabase.instance.client
              .from('orders')
              .select('*')
              .eq('client_id', effectiveUserId)
              .order('created_at', ascending: false);
          orderList = List<Map<String, dynamic>>.from(data);
        } catch (_) {}
      }

      // 2. Fallback query by email if client_id yielded nothing
      if (orderList.isEmpty && effectiveEmail != null) {
        try {
          final data = await Supabase.instance.client
              .from('orders')
              .select('*')
              .eq('customer_email', effectiveEmail)
              .order('created_at', ascending: false);
          if (data.isNotEmpty) {
            orderList = List<Map<String, dynamic>>.from(data);
          }
        } catch (_) {}
      }

      // 3. Fallback to authoritative backend endpoint
      if (orderList.isEmpty) {
        try {
          final session = Supabase.instance.client.auth.currentSession;
          final headers = <String, String>{};
          if (session?.accessToken != null) {
            headers['Authorization'] = 'Bearer ${session!.accessToken}';
          }
          final resp = await http
              .get(
                Uri.parse('${AppConstants.apiBaseUrl}/orders'),
                headers: headers,
              )
              .timeout(const Duration(seconds: 8));

          if (resp.statusCode == 200) {
            final json = jsonDecode(resp.body);
            if (json is List) {
              orderList = List<Map<String, dynamic>>.from(json);
            }
          }
        } catch (_) {}
      }

      // 4. Normalize and derive status for each order
      for (final o in orderList) {
        final paymentStatus = (o['payment_status'] ?? '').toString().toLowerCase();
        final fulfillmentStatus = (o['fulfillment_status'] ?? '').toString().toLowerCase();
        var currentStatus = (o['order_status'] ?? '').toString().toLowerCase();

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
          o['order_status'] = currentStatus;
        }

        // Parse items if string
        if (o['items'] is String) {
          try {
            o['items'] = jsonDecode(o['items'] as String);
          } catch (_) {}
        }
      }

      if (mounted) {
        setState(() {
          _orders = orderList;
          _isLoading = false;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  List<Map<String, dynamic>> _filterOrders(int tabIndex) {
    switch (tabIndex) {
      case 1: // To Pay
        return _orders.where((o) {
          final pStatus = (o['payment_status'] ?? '').toString().toLowerCase();
          final oStatus = (o['order_status'] ?? '').toString().toLowerCase();
          final isPaid = pStatus == 'completed' || pStatus == 'successful';
          if (isPaid || oStatus == 'cancelled' || oStatus == 'refunded') {
            return false;
          }
          return pStatus == 'pending' || oStatus == 'placed';
        }).toList();

      case 2: // To Ship (Paid / confirmed, being prepared or ready for dispatch/pickup)
        return _orders.where((o) {
          final oStatus = (o['order_status'] ?? '').toString().toLowerCase();
          final pStatus = (o['payment_status'] ?? '').toString().toLowerCase();
          final isPaid = pStatus == 'completed' || pStatus == 'successful';

          if (oStatus == 'shipped' ||
              oStatus == 'out_for_delivery' ||
              oStatus == 'delivered' ||
              oStatus == 'picked_up' ||
              oStatus == 'cancelled' ||
              oStatus == 'refunded') {
            return false;
          }

          return isPaid ||
              oStatus == 'payment_confirmed' ||
              oStatus == 'confirmed' ||
              oStatus == 'processing' ||
              oStatus == 'ready_for_dispatch' ||
              oStatus == 'ready_for_pickup';
        }).toList();

      case 3: // To Receive (In transit / out for delivery)
        return _orders.where((o) {
          final oStatus = (o['order_status'] ?? '').toString().toLowerCase();
          return oStatus == 'shipped' || oStatus == 'out_for_delivery';
        }).toList();

      case 4: // Completed (Delivered / Picked up)
        return _orders.where((o) {
          final oStatus = (o['order_status'] ?? '').toString().toLowerCase();
          final fStatus = (o['fulfillment_status'] ?? '').toString().toLowerCase();
          return oStatus == 'delivered' || oStatus == 'picked_up' || fStatus == 'fulfilled';
        }).toList();

      case 5: // Cancelled
        return _orders.where((o) {
          final oStatus = (o['order_status'] ?? '').toString().toLowerCase();
          final pStatus = (o['payment_status'] ?? '').toString().toLowerCase();
          return oStatus == 'cancelled' || pStatus == 'cancelled';
        }).toList();

      case 6: // Refunded
        return _orders.where((o) {
          final oStatus = (o['order_status'] ?? '').toString().toLowerCase();
          final pStatus = (o['payment_status'] ?? '').toString().toLowerCase();
          return oStatus == 'refunded' || pStatus == 'refunded';
        }).toList();

      default: // All
        return _orders;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('My Orders', style: TextStyle(fontWeight: FontWeight.bold)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (Navigator.canPop(context)) {
              Navigator.pop(context);
            } else {
              context.go('/');
            }
          },
        ),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          labelColor: AppTheme.coral,
          unselectedLabelColor: Colors.grey,
          indicatorColor: AppTheme.coral,
          indicatorWeight: 3,
          labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          tabs: const [
            Tab(text: 'All'),
            Tab(text: 'To Pay'),
            Tab(text: 'To Ship'),
            Tab(text: 'To Receive'),
            Tab(text: 'Completed'),
            Tab(text: 'Cancelled'),
            Tab(text: 'Refunded'),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.coral))
          : _error != null
              ? Center(child: Text('Error loading orders: $_error'))
              : TabBarView(
                  controller: _tabController,
                  children: [
                    _buildOrderList(_filterOrders(0), 'No orders yet'),
                    _buildOrderList(_filterOrders(1), 'No pending payments'),
                    _buildOrderList(_filterOrders(2), 'No orders to ship'),
                    _buildOrderList(_filterOrders(3), 'No shipments in transit'),
                    _buildOrderList(_filterOrders(4), 'No completed orders'),
                    _buildOrderList(_filterOrders(5), 'No cancelled orders'),
                    _buildOrderList(_filterOrders(6), 'No refunded orders'),
                  ],
                ),
    );
  }

  Widget _buildOrderList(List<Map<String, dynamic>> orders, String emptyTitle) {
    if (orders.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.receipt_long_outlined, size: 64, color: Colors.grey.shade400),
              const SizedBox(height: 12),
              Text(
                emptyTitle,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.grey),
              ),
              const SizedBox(height: 6),
              const Text(
                'Orders you place will appear here with live AliExpress-style tracking milestones.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: Colors.grey),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.coral,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                ),
                onPressed: () => context.go('/'),
                child: const Text('Shop Catalog Now', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadOrders,
      color: AppTheme.coral,
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        itemCount: orders.length,
        itemBuilder: (context, index) {
          final order = orders[index];
          return _buildOrderCard(order);
        },
      ),
    );
  }

  Widget _buildOrderCard(Map<String, dynamic> order) {
    final amount = order['amount']?.toString() ?? '0';
    final paymentStatus = (order['payment_status'] ?? 'pending').toString().toLowerCase();
    final orderStatus = (order['order_status'] ?? 'placed').toString().toLowerCase();
    final txRef = order['transaction_ref'] ?? 'MCK-${order['id']?.toString().substring(0, 8)}';
    final orderId = order['id']?.toString() ?? '';
    final pickupMethod = (order['pickup_method'] ?? 'pickup').toString().toLowerCase();
    final isPickup = pickupMethod == 'pickup' || pickupMethod == 'in-store pickup';
    final carrier = order['carrier']?.toString();
    final trackingNumber = order['tracking_number']?.toString();
    final estDelivery = order['estimated_delivery']?.toString() ?? order['estimated_delivery_date']?.toString();

    final createdAtStr = order['created_at']?.toString();
    DateTime? dt = createdAtStr != null ? DateTime.tryParse(createdAtStr)?.toLocal() : null;
    final formattedDate = dt != null ? DateFormat('MMM dd, yyyy · hh:mm a').format(dt) : '';

    final isPaid = paymentStatus == 'completed' || paymentStatus == 'successful';

    // Parse items
    List<Map<String, dynamic>> itemsList = [];
    if (order['items'] is List && (order['items'] as List).isNotEmpty) {
      itemsList = List<Map<String, dynamic>>.from(order['items']);
    } else if (order['phone'] is Map) {
      final p = order['phone'] as Map<String, dynamic>;
      itemsList.add({
        'brand': p['brand'] ?? 'Samsung',
        'model': p['model'] ?? 'Galaxy A15',
        'storage': p['storage'] ?? '',
        'ram': p['ram'] ?? '',
        'quantity': 1,
        'price': double.tryParse(p['price']?.toString() ?? '0') ?? double.tryParse(amount) ?? 0,
        'image': p['image'],
      });
    }

    if (itemsList.isEmpty) {
      itemsList.add({
        'brand': 'Micky Mobile',
        'model': 'Selected Device',
        'quantity': 1,
        'price': double.tryParse(amount) ?? 0,
      });
    }

    // Receipts textual representation
    final receiptItems = itemsList
        .map((it) => '${it['brand'] ?? ''} ${it['model'] ?? 'Device'} (${it['quantity'] ?? 1}x)')
        .toList();

    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      elevation: 0.5,
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Row: Ref & Status Badge
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.confirmation_number_outlined, size: 14, color: AppTheme.coral),
                    const SizedBox(width: 5),
                    Text(
                      txRef,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, fontFamily: 'monospace'),
                    ),
                  ],
                ),
                _buildStatusPill(orderStatus, isPaid),
              ],
            ),
            const SizedBox(height: 4),

            if (formattedDate.isNotEmpty)
              Text(
                formattedDate,
                style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
              ),

            const Divider(height: 18),

            // Products with Thumbnails
            ...itemsList.map((it) {
              final brand = it['brand']?.toString() ?? '';
              final model = it['model']?.toString() ?? 'Mobile Device';
              final storage = it['storage']?.toString() ?? '';
              final ram = it['ram']?.toString() ?? '';
              final qty = it['quantity'] ?? 1;
              final price = double.tryParse(it['price']?.toString() ?? '0') ?? 0;
              final image = it['image']?.toString();

              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 4.0),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: image != null && image.isNotEmpty
                          ? Image.network(
                              image,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => const Icon(Icons.phone_android, size: 22, color: Colors.grey),
                            )
                          : const Icon(Icons.phone_android, size: 22, color: Colors.grey),
                    ),
                    const SizedBox(width: 10),
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
                          if (storage.isNotEmpty || ram.isNotEmpty)
                            Text(
                              [if (storage.isNotEmpty) storage, if (ram.isNotEmpty) '$ram RAM'].join(' • '),
                              style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                            ),
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
                          'x$qty',
                          style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            }),

            const SizedBox(height: 8),

            // Delivery / Pickup Method Banner
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: isPickup ? const Color(0xFFF0FDF4) : const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: isPickup ? const Color(0xFFBBF7D0) : const Color(0xFFBFDBFE),
                  width: 0.8,
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    isPickup ? Icons.storefront_rounded : Icons.local_shipping_outlined,
                    size: 14,
                    color: isPickup ? const Color(0xFF15803D) : const Color(0xFF1D4ED8),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      isPickup
                          ? 'In-Store Pickup: Bole Alemnesh Plaza Ground Floor'
                          : carrier != null && carrier.isNotEmpty
                              ? 'Courier Delivery via $carrier${trackingNumber != null && trackingNumber.isNotEmpty ? " ($trackingNumber)" : ""}'
                              : 'Doorstep Courier Delivery (Addis Ababa & Regions)',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: isPickup ? const Color(0xFF15803D) : const Color(0xFF1D4ED8),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (estDelivery != null && estDelivery.isNotEmpty) ...[
                    const SizedBox(width: 4),
                    Text(
                      estDelivery,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: isPickup ? const Color(0xFF15803D) : const Color(0xFF1D4ED8),
                      ),
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 10),

            // Total Amount
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Total Amount', style: TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.w500)),
                Text(
                  '${NumberFormat('#,###').format(double.tryParse(amount) ?? 0)} ETB',
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                    color: AppTheme.coral,
                  ),
                ),
              ],
            ),
            const Divider(height: 18),

            // Actions: Track Order & Receipt
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.timeline_rounded, size: 16, color: Colors.white),
                    label: const Text('Track Order', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.coral,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      padding: const EdgeInsets.symmetric(vertical: 10),
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
                const SizedBox(width: 8),
                OutlinedButton.icon(
                  icon: const Icon(Icons.receipt_outlined, size: 16),
                  label: const Text('Receipt', style: TextStyle(fontSize: 12)),
                  style: OutlinedButton.styleFrom(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                  onPressed: () {
                    final receipt = OrderReceipt(
                      orderId: orderId,
                      txRef: txRef,
                      customerName: order['customer_name'] ?? 'Valued Customer',
                      customerPhone: order['customer_phone'] ?? '',
                      customerEmail: order['customer_email'] ?? '',
                      amount: double.tryParse(amount) ?? 0,
                      items: receiptItems,
                      date: dt ?? DateTime.now(),
                      paymentStatus: isPaid ? 'PAID' : 'PENDING',
                    );
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => ReceiptScreen(receipt: receipt),
                      ),
                    );
                  },
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusPill(String status, bool isPaid) {
    Color bg = const Color(0xFFFEF3C7);
    Color text = const Color(0xFF92400E);
    String label = 'Placed';

    switch (status) {
      case 'payment_confirmed':
        bg = const Color(0xFFDCFCE7);
        text = const Color(0xFF16A34A);
        label = 'Payment Verified';
        break;
      case 'confirmed':
        bg = const Color(0xFFDBEAFE);
        text = const Color(0xFF1D4ED8);
        label = 'Order Confirmed';
        break;
      case 'processing':
        bg = const Color(0xFFF3E8FF);
        text = const Color(0xFF7E22CE);
        label = 'Processing';
        break;
      case 'ready_for_dispatch':
        bg = const Color(0xFFE0E7FF);
        text = const Color(0xFF4338CA);
        label = 'Ready for Dispatch';
        break;
      case 'ready_for_pickup':
        bg = const Color(0xFFE0E7FF);
        text = const Color(0xFF4338CA);
        label = 'Ready for Pickup';
        break;
      case 'shipped':
        bg = const Color(0xFFCFFAFE);
        text = const Color(0xFF0E7490);
        label = 'Shipped';
        break;
      case 'out_for_delivery':
        bg = const Color(0xFFCFFAFE);
        text = const Color(0xFF0E7490);
        label = 'Out for Delivery';
        break;
      case 'picked_up':
        bg = const Color(0xFFDCFCE7);
        text = const Color(0xFF15803D);
        label = 'Picked Up';
        break;
      case 'delivered':
        bg = const Color(0xFFDCFCE7);
        text = const Color(0xFF15803D);
        label = 'Delivered';
        break;
      case 'cancelled':
        bg = const Color(0xFFFFE4E6);
        text = const Color(0xFFBE123C);
        label = 'Cancelled';
        break;
      case 'refunded':
        bg = const Color(0xFFFFE4E6);
        text = const Color(0xFFBE123C);
        label = 'Refunded';
        break;
      default:
        if (isPaid) {
          bg = const Color(0xFFDCFCE7);
          text = const Color(0xFF16A34A);
          label = 'Paid';
        }
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.bold,
          color: text,
        ),
      ),
    );
  }
}
