import 'dart:convert';
import 'package:http/http.dart' as http;

class ChapaService {
  static const String secretKey = 'CHAPA_TEST_PRIV_QvtfZWStMEmRu9rmr-3jwniCtiqeXCuen28-unud';
  static const String chapaEndpoint = 'https://api.chapa.global/v1';

  static Future<Map<String, dynamic>> initializePayment({
    required String orderId,
    required double amount,
    required String email,
    required String name,
    required String phone,
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
        'callback_url': 'https://checkout.chapa.co/callback',
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

  static Future<bool> verifyPayment(String txRef) async {
    final url = Uri.parse('$chapaEndpoint/transaction/verify/$txRef');
    final response = await http.get(
      url,
      headers: {'Authorization': 'Bearer $secretKey'},
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data['status'] == 'success';
    }
    return false;
  }
}
