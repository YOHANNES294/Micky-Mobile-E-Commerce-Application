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
    if (widget.initialFilter == 'pending' || widget.initialFilter == 'topay') initialIndex = 1;
    if (widget.initialFilter == 'processing' || widget.initialFilter == 'active') initialIndex = 2;
    if (widget.initialFilter == 'fulfilled' || widget.initialFilter == 'delivered') initialIndex = 3;
    if (widget.initialFilter == 'cancelled' || widget.initialFilter == 'returns') initialIndex = 4;

    _tabController = TabController(length: 5, vsync: this, initialIndex: initialIndex);
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
    final user = ref.read(authProvider).value;
    if (user == null) return;

    try {
      _realtimeChannel = Supabase.instance.client
          .channel('public:orders_user_${user.id}')
          .onPostgresChanges(
            event: PostgresChangeEvent.all,
            schema: 'public',
            table: 'orders',
            filter: PostgresChangeFilter(
              type: PostgresChangeFilterType.eq,
              column: 'client_id',
              value: user.id,
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
      case 1: // To Pay / Pending
        return _orders.where((o) {
          final paymentStatus = (o['payment_status'] ?? '').toString().toLowerCase();
          return paymentStatus == 'pending';
        }).toList();

      case 2: // In Progress / Active
        return _orders.where((o) {
          final orderStatus = (o['order_status'] ?? '').toString().toLowerCase();
          final paymentStatus = (o['payment_status'] ?? '').toString().toLowerCase();
          final isPaid = paymentStatus == 'completed' || paymentStatus == 'successful';

          if (orderStatus == 'delivered' || orderStatus == 'cancelled' || orderStatus == 'refunded') {
            return false;
          }

          return isPaid ||
              orderStatus == 'payment_confirmed' ||
              orderStatus == 'confirmed' ||
              orderStatus == 'processing' ||
              orderStatus == 'ready_for_dispatch' ||
              orderStatus == 'shipped';
        }).toList();

      case 3: // Completed / Delivered
        return _orders.where((o) {
          final orderStatus = (o['order_status'] ?? '').toString().toLowerCase();
          final fulfillment = (o['fulfillment_status'] ?? '').toString().toLowerCase();
          return orderStatus == 'delivered' || fulfillment == 'fulfilled';
        }).toList();

      case 4: // Cancelled / Refunded
        return _orders.where((o) {
          final orderStatus = (o['order_status'] ?? '').toString().toLowerCase();
          final paymentStatus = (o['payment_status'] ?? '').toString().toLowerCase();
          return orderStatus == 'cancelled' || orderStatus == 'refunded' || paymentStatus == 'cancelled';
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
          tabs: const [
            Tab(text: 'All'),
            Tab(text: 'To Pay'),
            Tab(text: 'In Progress'),
            Tab(text: 'Delivered'),
            Tab(text: 'Cancelled'),
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
                    _buildOrderList(_filterOrders(0)),
                    _buildOrderList(_filterOrders(1)),
                    _buildOrderList(_filterOrders(2)),
                    _buildOrderList(_filterOrders(3)),
                    _buildOrderList(_filterOrders(4)),
                  ],
                ),
    );
  }

  Widget _buildOrderList(List<Map<String, dynamic>> orders) {
    if (orders.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.receipt_long_outlined, size: 64, color: Colors.grey.shade400),
            const SizedBox(height: 12),
            const Text(
              'No orders in this status',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.grey),
            ),
            const SizedBox(height: 6),
            const Text(
              'Orders you place will update here in real time.',
              style: TextStyle(fontSize: 13, color: Colors.grey),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.coral),
              onPressed: () => context.go('/'),
              child: const Text('Shop Catalog Now', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadOrders,
      color: AppTheme.coral,
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        itemCount: orders.length,
        itemBuilder: (context, index) {
          final order = orders[index];
          final amount = order['amount']?.toString() ?? '0';
          final paymentStatus = (order['payment_status'] ?? 'pending').toString().toLowerCase();
          final orderStatus = (order['order_status'] ?? 'placed').toString().toLowerCase();
          final txRef = order['transaction_ref'] ?? 'MCK-${order['id']?.toString().substring(0, 8)}';
          final orderId = order['id']?.toString() ?? '';

          final createdAtStr = order['created_at']?.toString();
          DateTime? dt = createdAtStr != null ? DateTime.tryParse(createdAtStr)?.toLocal() : null;
          final formattedDate = dt != null ? DateFormat('MMM dd, yyyy · hh:mm a').format(dt) : '';

          final isPaid = paymentStatus == 'completed' || paymentStatus == 'successful';

          // Items summary
          List<String> itemsList = [];
          if (order['items'] is List) {
            itemsList = (order['items'] as List)
                .map((it) => '${it['brand'] ?? ''} ${it['model'] ?? 'Device'} (${it['quantity'] ?? 1}x)')
                .toList();
          }
          if (itemsList.isEmpty) {
            itemsList.add('Mobile Device (${NumberFormat('#,###').format(double.tryParse(amount) ?? 0)} ETB)');
          }

          return Card(
            margin: const EdgeInsets.only(bottom: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            elevation: 1.5,
            color: Colors.white,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Top Row: Ref & Status Badge
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.tag, size: 14, color: AppTheme.coral),
                          Text(
                            txRef,
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, fontFamily: 'monospace'),
                          ),
                        ],
                      ),
                      _buildStatusPill(orderStatus, isPaid),
                    ],
                  ),
                  const Divider(height: 18),

                  // Products Summary
                  ...itemsList.map(
                    (item) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2.0),
                      child: Row(
                        children: [
                          const Icon(Icons.smartphone_rounded, size: 15, color: Colors.grey),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              item,
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: AppTheme.textDark),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Amount & Date
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Total Amount', style: TextStyle(color: Colors.grey, fontSize: 11)),
                          const SizedBox(height: 2),
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
                      if (formattedDate.isNotEmpty)
                        Text(
                          formattedDate,
                          style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                        ),
                    ],
                  ),
                  const Divider(height: 20),

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
                      const SizedBox(width: 10),
                      OutlinedButton.icon(
                        icon: const Icon(Icons.receipt_outlined, size: 16),
                        label: const Text('Receipt', style: TextStyle(fontSize: 12)),
                        style: OutlinedButton.styleFrom(
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        ),
                        onPressed: () {
                          final receipt = OrderReceipt(
                            orderId: orderId,
                            txRef: txRef,
                            customerName: order['customer_name'] ?? 'Valued Customer',
                            customerPhone: order['customer_phone'] ?? '',
                            customerEmail: order['customer_email'] ?? '',
                            amount: double.tryParse(amount) ?? 0,
                            items: itemsList,
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
        },
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
        label = 'Confirmed';
        break;
      case 'processing':
        bg = const Color(0xFFF3E8FF);
        text = const Color(0xFF7E22CE);
        label = 'Processing';
        break;
      case 'ready_for_dispatch':
        bg = const Color(0xFFE0E7FF);
        text = const Color(0xFF4338CA);
        label = 'Ready for Pickup';
        break;
      case 'shipped':
        bg = const Color(0xFFCFFAFE);
        text = const Color(0xFF0E7490);
        label = 'Out for Delivery';
        break;
      case 'delivered':
        bg = const Color(0xFFDCFCE7);
        text = const Color(0xFF15803D);
        label = 'Delivered';
        break;
      case 'cancelled':
      case 'refunded':
        bg = const Color(0xFFFFE4E6);
        text = const Color(0xFFBE123C);
        label = status == 'refunded' ? 'Refunded' : 'Cancelled';
        break;
      default:
        if (isPaid) {
          bg = const Color(0xFFDCFCE7);
          text = const Color(0xFF16A34A);
          label = 'Paid';
        }
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3.5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
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
