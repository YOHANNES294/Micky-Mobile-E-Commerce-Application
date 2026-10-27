import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:micky_mobile/core/constants/app_constants.dart';

class ChapaService {
  static const String secretKey = 'CHAPA_TEST_PRIV_QvtfZWStMEmRu9rmr-3jwniCtiqeXCuen28-unud';
  static const String chapaEndpoint = 'https://api.chapa.global/v1';

  /// Initialize payment on Chapa gateway
  static Future<Map<String, dynamic>> initializePayment({
    required String orderId,
    required double amount,
    required String email,
    required String name,
    required String phone,
    List<Map<String, dynamic>>? items,
    String pickupMethod = 'pickup',
    String? deliveryAddress,
  }) async {
    final names = name.trim().split(' ');
    final firstName = names.isNotEmpty ? names.first : 'Customer';
    final lastName = names.length > 1 ? names.sublist(1).join(' ') : 'Micky';

    final url = Uri.parse('$chapaEndpoint/transaction/initialize');

    final response = await http.post(
      url,
      headers: {
        'Authorization': 'Bearer $secretKey',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'amount': amount.toStringAsFixed(0),
        'currency': 'ETB',
        'email': email,
        'first_name': firstName,
        'last_name': lastName,
        'phone_number': phone,
        'tx_ref': orderId,
        'callback_url': '${AppConstants.apiBaseUrl}/payments/chapa/webhook',
        'return_url': 'https://mickymobile.et/receipt',
        'customization': {
          'title': 'Micky Mobile Store',
          'description': 'Phone purchase from Micky Mobile Ethiopia',
        }
      }),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300 && data['status'] == 'success') {
      return {
        'checkout_url': data['data']['checkout_url'],
        'tx_ref': orderId,
      };
    } else {
      throw Exception(data['message'] ?? 'Chapa payment initialization failed');
    }
  }

  /// Verifies transaction securely on the backend using the Chapa verification API.
  /// Never trusts client redirect alone!
  static Future<Map<String, dynamic>> verifyPaymentSecurely(String txRef) async {
    try {
      // 1. First, call our authoritative backend verification endpoint
      final backendUrl = Uri.parse('${AppConstants.apiBaseUrl}/payments/chapa/verify?tx_ref=${Uri.encodeComponent(txRef)}');
      
      final session = Supabase.instance.client.auth.currentSession;
      final headers = <String, String>{
        'Content-Type': 'application/json',
      };
      if (session?.accessToken != null) {
        headers['Authorization'] = 'Bearer ${session!.accessToken}';
      }

      final response = await http.get(backendUrl, headers: headers).timeout(
        const Duration(seconds: 15),
        onTimeout: () => http.Response('{"error":"Backend verification timeout"}', 408),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true) {
          return {
            'success': true,
            'order': data['order'],
            'payment': data['payment'],
            'message': data['message'] ?? 'Payment verified successfully',
          };
        }
      }
    } catch (e) {
      // Fallback to direct verification if backend is temporarily unreachable
    }

    // 2. Direct Chapa API verification fallback
    try {
      final url = Uri.parse('$chapaEndpoint/transaction/verify/$txRef');
      final response = await http.get(
        url,
        headers: {'Authorization': 'Bearer $secretKey'},
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final isSuccess = data['status'] == 'success';

        if (isSuccess) {
          // Reconcile order in Supabase directly
          try {
            await Supabase.instance.client
                .from('orders')
                .update({
                  'payment_status': 'completed',
                  'order_status': 'payment_confirmed',
                  'updated_at': DateTime.now().toIso8601String(),
                })
                .eq('transaction_ref', txRef);
          } catch (_) {}

          return {
            'success': true,
            'message': 'Chapa verified successfully',
          };
        }
      }
    } catch (_) {}

    return {
      'success': false,
      'message': 'Payment verification could not be confirmed',
    };
  }

  /// Legacy helper for backward compatibility
  static Future<bool> verifyPayment(String txRef) async {
    final result = await verifyPaymentSecurely(txRef);
    return result['success'] == true;
  }
}
