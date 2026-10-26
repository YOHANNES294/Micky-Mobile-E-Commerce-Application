import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:micky_mobile/core/theme/app_theme.dart';
import 'package:micky_mobile/logic/auth_provider.dart';

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

  @override
  void initState() {
    super.initState();
    int initialIndex = 0;
    if (widget.initialFilter == 'pending') initialIndex = 1;
    if (widget.initialFilter == 'processing') initialIndex = 2;
    if (widget.initialFilter == 'fulfilled') initialIndex = 3;

    _tabController = TabController(length: 4, vsync: this, initialIndex: initialIndex);
    _loadOrders();
  }

  Future<void> _loadOrders() async {
    final user = ref.read(authProvider).value;
    if (user == null) {
      setState(() {
        _isLoading = false;
        _orders = [];
      });
      return;
    }

    try {
      final data = await Supabase.instance.client
          .from('orders')
          .select('*')
          .eq('client_id', user.id)
          .order('created_at', ascending: false);

      if (mounted) {
        setState(() {
          _orders = List<Map<String, dynamic>>.from(data);
          _isLoading = false;
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

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> _filterOrders(int tabIndex) {
    switch (tabIndex) {
      case 1: // To Pay / Pending
        return _orders.where((o) => (o['payment_status'] ?? '').toString().toLowerCase() == 'pending').toList();
      case 2: // To Ship / Processing
        return _orders.where((o) => (o['fulfillment_status'] ?? '').toString().toLowerCase() == 'processing' ||
            (o['payment_status'] ?? '').toString().toLowerCase() == 'completed' &&
            (o['fulfillment_status'] ?? '').toString().toLowerCase() != 'fulfilled').toList();
      case 3: // Shipped / Fulfilled
        return _orders.where((o) => (o['fulfillment_status'] ?? '').toString().toLowerCase() == 'fulfilled').toList();
      default: // All
        return _orders;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Orders'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppTheme.coral,
          unselectedLabelColor: Colors.grey,
          indicatorColor: AppTheme.coral,
          indicatorWeight: 3,
          tabs: const [
            Tab(text: 'All'),
            Tab(text: 'To Pay'),
            Tab(text: 'To Ship'),
            Tab(text: 'Shipped'),
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
              'Orders you place will appear here in real time.',
              style: TextStyle(fontSize: 13, color: Colors.grey),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.coral),
              onPressed: () => context.go('/'),
              child: const Text('Shop Phones Now', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadOrders,
      color: AppTheme.coral,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: orders.length,
        itemBuilder: (context, index) {
          final order = orders[index];
          final amount = order['amount']?.toString() ?? '0';
          final paymentStatus = (order['payment_status'] ?? 'pending').toString();
          final fulfillmentStatus = (order['fulfillment_status'] ?? 'unfulfilled').toString();
          final txRef = order['transaction_ref'] ?? 'TX-${order['id']?.toString().substring(0, 8)}';
          final createdAt = order['created_at'] != null
              ? DateTime.tryParse(order['created_at'].toString())?.toLocal().toString().substring(0, 16) ?? ''
              : '';

          final isPaid = paymentStatus.toLowerCase() == 'completed' || paymentStatus.toLowerCase() == 'successful';

          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            elevation: 1.5,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Ref: $txRef',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: isPaid ? Colors.green.shade50 : Colors.amber.shade50,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: isPaid ? Colors.green.shade300 : Colors.amber.shade300,
                          ),
                        ),
                        child: Text(
                          paymentStatus.toUpperCase(),
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: isPaid ? Colors.green.shade800 : Colors.amber.shade900,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Total Amount', style: TextStyle(color: Colors.grey, fontSize: 11)),
                          const SizedBox(height: 2),
                          Text(
                            '$amount ETB',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.coral,
                            ),
                          ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          const Text('Fulfillment', style: TextStyle(color: Colors.grey, fontSize: 11)),
                          const SizedBox(height: 2),
                          Text(
                            fulfillmentStatus.toUpperCase(),
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.textDark,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  if (createdAt.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Text(
                      'Ordered on: $createdAt',
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
