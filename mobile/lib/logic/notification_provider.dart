import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:micky_mobile/core/services/notification_service.dart';
import 'package:micky_mobile/data/models/notification_item.dart';
import 'package:micky_mobile/logic/auth_provider.dart';

final notificationServiceProvider = Provider<NotificationService>((ref) {
  return NotificationService();
});

final notificationsFutureProvider = FutureProvider.autoDispose<List<NotificationItem>>((ref) async {
  final user = ref.watch(authProvider).value;
  if (user == null) return [];
  final service = ref.watch(notificationServiceProvider);
  return service.fetchNotifications();
});

final notificationsStreamProvider = StreamProvider.autoDispose<List<NotificationItem>>((ref) {
  final user = ref.watch(authProvider).value;
  if (user == null) return const Stream.empty();
  final service = ref.watch(notificationServiceProvider);
  return service.streamNotifications();
});

final unreadNotificationsCountProvider = Provider.autoDispose<int>((ref) {
  final streamVal = ref.watch(notificationsStreamProvider);
  return streamVal.maybeWhen(
    data: (list) => list.where((n) => !n.isRead).length,
    orElse: () {
      final futureVal = ref.watch(notificationsFutureProvider);
      return futureVal.maybeWhen(
        data: (list) => list.where((n) => !n.isRead).length,
        orElse: () => 0,
      );
    },
  );
});
