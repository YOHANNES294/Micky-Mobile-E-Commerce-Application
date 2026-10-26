import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:micky_mobile/core/theme/app_theme.dart';
import 'package:micky_mobile/data/models/order_receipt.dart';
import 'package:micky_mobile/data/services/chapa_service.dart';
import 'package:micky_mobile/presentation/screens/cart/receipt_screen.dart';

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
    if (url.contains('receipt') || url.contains('success') || url.contains('callback')) {
      _verifyAndNavigate();
    }
  }

  Future<void> _verifyAndNavigate() async {
    if (_isVerifying) return;
    setState(() => _isVerifying = true);

    await ChapaService.verifyPayment(widget.txRef);

    if (mounted) {
      widget.onPaymentSuccess?.call();
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => ReceiptScreen(receipt: widget.pendingReceipt),
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
          TextButton(
            onPressed: _verifyAndNavigate,
            child: const Text('I Paid (Receipt)', style: TextStyle(color: AppTheme.coral, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_isLoading || _isVerifying)
            Container(
              color: Colors.white.withValues(alpha: 0.7),
              child: const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(color: AppTheme.coral),
                    SizedBox(height: 12),
                    Text('Loading Chapa Payment Gateway...', style: TextStyle(fontSize: 13, color: Colors.grey)),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
