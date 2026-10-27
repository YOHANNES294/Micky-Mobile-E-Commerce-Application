import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:micky_mobile/core/theme/app_theme.dart';
import 'package:micky_mobile/data/models/order_receipt.dart';
import 'package:micky_mobile/data/services/chapa_service.dart';
import 'package:micky_mobile/presentation/screens/orders/order_confirmation_screen.dart';

class ChapaPaymentWebviewScreen extends StatefulWidget {
  final String checkoutUrl;
  final String txRef;
  final OrderReceipt pendingReceipt;
  final VoidCallback? onPaymentSuccess;

  const ChapaPaymentWebviewScreen({
    super.key,
    required this.checkoutUrl,
    required this.txRef,
    required this.pendingReceipt,
    this.onPaymentSuccess,
  });

  @override
  State<ChapaPaymentWebviewScreen> createState() => _ChapaPaymentWebviewScreenState();
}

class _ChapaPaymentWebviewScreenState extends State<ChapaPaymentWebviewScreen> {
  late final WebViewController _controller;
  bool _isLoading = true;
  bool _isVerifying = false;
  String? _verificationError;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (url) {
            setState(() => _isLoading = true);
            _checkUrlForCompletion(url);
          },
          onPageFinished: (url) {
            setState(() => _isLoading = false);
            _checkUrlForCompletion(url);
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.checkoutUrl));
  }

  void _checkUrlForCompletion(String url) {
    final lower = url.toLowerCase();
    if (lower.contains('receipt') || lower.contains('success') || lower.contains('callback') || lower.contains('/checkout/result')) {
      _verifyAndNavigate();
    }
  }

  Future<void> _verifyAndNavigate() async {
    if (_isVerifying) return;
    setState(() {
      _isVerifying = true;
      _verificationError = null;
    });

    // Authoritative Server-Side Chapa Verification API check
    // "Never trust the payment success redirect alone"
    final result = await ChapaService.verifyPaymentSecurely(widget.txRef);

    if (!mounted) return;

    if (result['success'] == true) {
      widget.onPaymentSuccess?.call();

      // Navigate to dedicated Order Confirmation screen
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => OrderConfirmationScreen(
            orderId: widget.pendingReceipt.orderId,
            txRef: widget.txRef,
            totalAmount: widget.pendingReceipt.amount,
            customerName: widget.pendingReceipt.customerName,
            customerPhone: widget.pendingReceipt.customerPhone,
            customerEmail: widget.pendingReceipt.customerEmail,
            items: widget.pendingReceipt.items,
          ),
        ),
      );
    } else {
      setState(() {
        _isVerifying = false;
        _verificationError = result['message'] ?? 'Payment has not been confirmed yet. Please complete the Chapa checkout.';
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_verificationError!),
          backgroundColor: Colors.amber.shade900,
          duration: const Duration(seconds: 4),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chapa Payment Checkout', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        actions: [
          TextButton.icon(
            onPressed: _isVerifying ? null : _verifyAndNavigate,
            icon: _isVerifying
                ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.coral))
                : const Icon(Icons.verified_rounded, size: 16, color: AppTheme.coral),
            label: const Text('I Paid (Verify)', style: TextStyle(color: AppTheme.coral, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_isLoading || _isVerifying)
            Container(
              color: Colors.white.withOpacity(0.85),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const CircularProgressIndicator(color: AppTheme.coral),
                    const SizedBox(height: 14),
                    Text(
                      _isVerifying ? 'Verifying payment with Chapa server...' : 'Loading Chapa Payment Gateway...',
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textDark),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Please do not close this window',
                      style: TextStyle(fontSize: 11, color: Colors.grey),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
