class NotificationItem {
  final String id;
  final String userId;
  final String title;
  final String message;
  final String category; // 'orders', 'messages', 'products', 'promotions', 'account'
  final String? targetType;
  final String? targetId;
  final bool isRead;
  final DateTime createdAt;

  NotificationItem({
    required this.id,
    required this.userId,
    required this.title,
    required this.message,
    required this.category,
    this.targetType,
    this.targetId,
    required this.isRead,
    required this.createdAt,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      title: json['title'] as String? ?? 'Notification',
      message: json['message'] as String? ?? '',
      category: json['category'] as String? ?? 'account',
      targetType: json['target_type'] as String?,
      targetId: json['target_id'] as String?,
      isRead: json['is_read'] as bool? ?? false,
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  NotificationItem copyWith({bool? isRead}) {
    return NotificationItem(
      id: id,
      userId: userId,
      title: title,
      message: message,
      category: category,
      targetType: targetType,
      targetId: targetId,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt,
    );
  }
}
