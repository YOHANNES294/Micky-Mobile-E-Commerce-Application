import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:micky_mobile/core/theme/app_theme.dart';
import 'package:micky_mobile/data/models/order_receipt.dart';
import 'package:micky_mobile/data/services/chapa_service.dart';
import 'package:micky_mobile/logic/auth_provider.dart';
import 'package:micky_mobile/logic/cart_provider.dart';
import 'package:micky_mobile/presentation/screens/cart/chapa_payment_webview_screen.dart';
import 'package:micky_mobile/presentation/widgets/phone_image_view.dart';

class CartScreen extends ConsumerStatefulWidget {
  const CartScreen({super.key});

  @override
  ConsumerState<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends ConsumerState<CartScreen> {
  bool _isProcessing = false;
  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;
  late final TextEditingController _emailController;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authProvider).value;
    _nameController = TextEditingController(text: user?.fullName ?? '');
    _phoneController = TextEditingController(text: user?.phone ?? '');
    _emailController = TextEditingController(text: user?.email ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _handleCheckout(double selectedTotal) async {
    final notifier = ref.read(cartProvider.notifier);
    final selectedItems = notifier.selectedItems;

    // 1. Validation: Prevent checkout if no items are selected
    if (selectedItems.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select at least one item to proceed to payment'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    final name = _nameController.text.trim();
    final phone = _phoneController.text.trim();
    final email = _emailController.text.trim();

    if (name.isEmpty || phone.isEmpty || email.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter your Name, Phone Number, and Email')),
      );
      return;
    }

    setState(() => _isProcessing = true);
    try {
      final txRef = 'MCK-${DateTime.now().millisecondsSinceEpoch}';

      final currentUser = Supabase.instance.client.auth.currentUser;
      final userId = currentUser?.id ?? '00000000-0000-0000-0000-000000000000';

      final itemsMap = selectedItems.map((item) => {
        'phone_id': item.phone.id,
        'model': item.phone.model,
        'brand': item.phone.brand,
        'storage': item.phone.storage,
        'ram': item.phone.ram,
        'quantity': item.quantity,
        'price': item.phone.numericPrice,
        'image': item.phone.image,
      }).toList();

      final initialMilestone = {
        'status': 'placed',
        'title': 'Order Placed',
        'description': 'Order created in Micky Mobile store and awaiting payment',
        'timestamp': DateTime.now().toIso8601String(),
      };

      String orderDbId = txRef;
      try {
        final orderInsert = await Supabase.instance.client.from('orders').insert({
          'client_id': userId,
          'phone_id': selectedItems.first.phone.id,
          'amount': selectedTotal,
          'currency': 'ETB',
          'payment_method': 'chapa',
          'payment_status': 'pending',
          'order_status': 'placed',
          'fulfillment_status': 'unfulfilled',
          'transaction_ref': txRef,
          'customer_name': name,
          'customer_phone': phone,
          'customer_email': email,
          'pickup_method': 'pickup',
          'items': itemsMap,
          'status_history': [initialMilestone],
        }).select('id').maybeSingle();

        if (orderInsert != null && orderInsert['id'] != null) {
          orderDbId = orderInsert['id'].toString();
        }
      } catch (e) {
        // Non-blocking: Backend verification reconciles or creates if needed
      }

      final res = await ChapaService.initializePayment(
        orderId: txRef,
        amount: selectedTotal,
        email: email,
        name: name,
        phone: phone,
      );

      final checkoutUrl = res['checkout_url'] as String?;
      if (checkoutUrl != null) {
        final pendingReceipt = OrderReceipt(
          orderId: orderDbId,
          txRef: txRef,
          customerName: name,
          customerPhone: phone,
          customerEmail: email,
          amount: selectedTotal,
          items: selectedItems
              .map((item) => '${item.phone.brand} ${item.phone.model} (${item.quantity}x)')
              .toList(),
          date: DateTime.now(),
          paymentStatus: 'PAID',
        );

        if (mounted) {
          final purchasedPhoneIds = selectedItems.map((item) => item.phone.id).toList();

          // Open In-App Payment WebView Directly
          // NOTE: Do NOT clear the whole cart here! Only remove purchased items upon verified success.
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => ChapaPaymentWebviewScreen(
                checkoutUrl: checkoutUrl,
                txRef: txRef,
                pendingReceipt: pendingReceipt,
                onPaymentSuccess: () {
                  // Only purchased items are removed. Unselected items remain!
                  ref.read(cartProvider.notifier).removePurchasedItems(purchasedPhoneIds);
                },
              ),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: Colors.red.shade700,
            content: Text('Chapa Error: $e'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cartItems = ref.watch(cartProvider);
    final notifier = ref.watch(cartProvider.notifier);
    final selectedTotal = notifier.selectedTotalAmount;
    final selectedCount = notifier.selectedItemCount;
    final isAllSelected = notifier.isAllSelected;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Shopping Cart', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          if (cartItems.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: Text(
                  '${cartItems.length} items',
                  style: const TextStyle(fontSize: 13, color: Colors.grey),
                ),
              ),
            ),
        ],
      ),
      body: cartItems.isEmpty
          ? const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.shopping_bag_outlined, size: 64, color: Colors.grey),
                  SizedBox(height: 12),
                  Text('Your cart is empty', style: TextStyle(fontSize: 16, color: Colors.grey)),
                  SizedBox(height: 6),
                  Text('Add items to your cart from the phone catalog', style: TextStyle(fontSize: 13, color: Colors.grey)),
                ],
              ),
            )
          : Column(
              children: [
                // 1. SELECT ALL TOOLBAR
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade50,
                    border: Border(bottom: BorderSide(color: Colors.grey.shade200)),
                  ),
                  child: Row(
                    children: [
                      Checkbox(
                        value: isAllSelected,
                        activeColor: AppTheme.coral,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                        onChanged: (val) {
                          ref.read(cartProvider.notifier).selectAll(val ?? false);
                        },
                      ),
                      Text(
                        'Select All (${cartItems.length} items)',
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                      ),
                      const Spacer(),
                      if (selectedCount > 0)
                        Text(
                          '$selectedCount selected',
                          style: const TextStyle(
                            color: AppTheme.coral,
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                          ),
                        ),
                      if (selectedCount > 0) ...[
                        const SizedBox(width: 8),
                        IconButton(
                          icon: const Icon(Icons.delete_sweep_outlined, color: Colors.red, size: 22),
                          tooltip: 'Remove selected items',
                          onPressed: () {
                            final selectedIds = notifier.selectedItems.map((e) => e.phone.id).toList();
                            ref.read(cartProvider.notifier).removePurchasedItems(selectedIds);
                          },
                        ),
                      ],
                    ],
                  ),
                ),

                // 2. CART ITEMS LIST WITH SELECTION CHECKBOXES & DELETE ICONS
                Expanded(
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    itemCount: cartItems.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final item = cartItems[index];

                      return Card(
                        elevation: item.isSelected ? 1 : 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: BorderSide(
                            color: item.isSelected
                                ? AppTheme.coral.withOpacity(0.4)
                                : Colors.grey.shade200,
                            width: item.isSelected ? 1.5 : 1,
                          ),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              // Checkbox to select/deselect product
                              Checkbox(
                                value: item.isSelected,
                                activeColor: AppTheme.coral,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                                onChanged: (val) {
                                  ref.read(cartProvider.notifier).toggleSelect(item.phone.id, val ?? false);
                                },
                              ),

                              // Thumbnail
                              Container(
                                width: 56,
                                height: 56,
                                clipBehavior: Clip.antiAlias,
                                decoration: BoxDecoration(
                                  color: Colors.grey.shade100,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: PhoneImageView(
                                  imageUrl: item.phone.imageUrl,
                                  brand: item.phone.brand,
                                  model: item.phone.model,
                                  fit: BoxFit.cover,
                                ),
                              ),
                              const SizedBox(width: 10),

                              // Phone Details
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '${item.phone.brand} ${item.phone.model}',
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      '${item.phone.storage} · ${item.phone.ram}',
                                      style: TextStyle(color: Colors.grey.shade600, fontSize: 11),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      '${item.phone.price.toStringAsFixed(0)} ETB',
                                      style: const TextStyle(
                                        color: AppTheme.coral,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ],
                                ),
                              ),

                              // Quantity Controls
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  IconButton(
                                    visualDensity: VisualDensity.compact,
                                    padding: EdgeInsets.zero,
                                    icon: const Icon(Icons.remove_circle_outline, size: 20),
                                    onPressed: () {
                                      ref.read(cartProvider.notifier).updateQuantity(
                                        item.phone.id,
                                        item.quantity - 1,
                                      );
                                    },
                                  ),
                                  Text(
                                    '${item.quantity}',
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                  ),
                                  IconButton(
                                    visualDensity: VisualDensity.compact,
                                    padding: EdgeInsets.zero,
                                    icon: const Icon(Icons.add_circle_outline, size: 20),
                                    onPressed: () {
                                      ref.read(cartProvider.notifier).updateQuantity(
                                        item.phone.id,
                                        item.quantity + 1,
                                      );
                                    },
                                  ),
                                ],
                              ),

                              // Dedicated Delete / Remove Icon
                              IconButton(
                                icon: const Icon(Icons.delete_outline, color: Colors.red, size: 22),
                                tooltip: 'Remove from cart',
                                onPressed: () {
                                  ref.read(cartProvider.notifier).remove(item.phone.id);
                                },
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),

                // 3. CHECKOUT SUMMARY & CUSTOMER DETAILS
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.06),
                        blurRadius: 10,
                        offset: const Offset(0, -4),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      TextField(
                        controller: _nameController,
                        decoration: const InputDecoration(
                          labelText: 'Customer Full Name',
                          prefixIcon: Icon(Icons.person_outline),
                          isDense: true,
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _phoneController,
                        keyboardType: TextInputType.phone,
                        decoration: const InputDecoration(
                          labelText: 'Phone Number (09... or 07...)',
                          prefixIcon: Icon(Icons.phone_outlined),
                          isDense: true,
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        decoration: const InputDecoration(
                          labelText: 'Email Address',
                          prefixIcon: Icon(Icons.mail_outline),
                          isDense: true,
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Dynamic Pricing Summary based ONLY on selected products
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Selected Items ($selectedCount):',
                            style: const TextStyle(fontSize: 14, color: Colors.grey),
                          ),
                          Text(
                            '${selectedTotal.toStringAsFixed(0)} ETB',
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      const Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Delivery:', style: TextStyle(fontSize: 14, color: Colors.grey)),
                          Text('FREE', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.green)),
                        ],
                      ),
                      const Divider(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Total Amount to Pay:',
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                          ),
                          Text(
                            '${selectedTotal.toStringAsFixed(0)} ETB',
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.coral,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      // Pay Button
                      SizedBox(
                        width: double.infinity,
                        height: 46,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: selectedCount > 0 ? AppTheme.coral : Colors.grey.shade400,
                          ),
                          onPressed: _isProcessing
                              ? null
                              : () {
                                  if (selectedCount == 0) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text('Please select at least one item to proceed to payment'),
                                        backgroundColor: Colors.orange,
                                      ),
                                    );
                                    return;
                                  }
                                  _handleCheckout(selectedTotal);
                                },
                          child: _isProcessing
                              ? const Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                    ),
                                    SizedBox(width: 10),
                                    Text('Opening Chapa Gateway...'),
                                  ],
                                )
                              : Text(
                                  selectedCount > 0
                                      ? 'Pay with Chapa (${selectedTotal.toStringAsFixed(0)} ETB)'
                                      : 'Select Items to Pay (0 ETB)',
                                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                                ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}
