import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:micky_mobile/core/constants/app_constants.dart';
import 'package:micky_mobile/data/models/notification_item.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  SupabaseClient get _client => Supabase.instance.client;

  Future<List<NotificationItem>> fetchNotifications() async {
    final user = _client.auth.currentUser;
    if (user == null) return [];

    try {
      final data = await _client
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', ascending: false)
          .limit(50);

      return (data as List).map((json) => NotificationItem.fromJson(json)).toList();
    } catch (e) {
      return [];
    }
  }

  Future<void> markAsRead({String? notificationId}) async {
    final user = _client.auth.currentUser;
    if (user == null) return;

    try {
      var query = _client.from('notifications').update({'is_read': true}).eq('user_id', user.id);
      if (notificationId != null) {
        query = query.eq('id', notificationId);
      }
      await query;
    } catch (_) {}
  }

  Stream<List<NotificationItem>> streamNotifications() {
    final user = _client.auth.currentUser;
    if (user == null) return const Stream.empty();

    return _client
        .from('notifications')
        .stream(primaryKey: ['id'])
        .eq('user_id', user.id)
        .order('created_at', ascending: false)
        .map((maps) => maps.map((item) => NotificationItem.fromJson(item)).toList());
  }

  Future<bool> registerDeviceToken({required String token, String deviceType = 'android'}) async {
    final user = _client.auth.currentUser;
    if (user == null) return false;

    try {
      final response = await http.post(
        Uri.parse('${AppConstants.apiBaseUrl}/notifications/register-subscription'),
        headers: {
          'Content-Type': 'application/json',
          if (_client.auth.currentSession?.accessToken != null)
            'Authorization': 'Bearer ${_client.auth.currentSession!.accessToken}',
        },
        body: jsonEncode({
          'endpoint': 'mobile-token-$token',
          'device_token': token,
          'device_type': deviceType,
        }),
      );

      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}
