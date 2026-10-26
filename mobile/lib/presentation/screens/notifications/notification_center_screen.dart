import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:micky_mobile/core/theme/app_theme.dart';
import 'package:micky_mobile/data/models/notification_item.dart';
import 'package:micky_mobile/logic/notification_provider.dart';

class NotificationCenterScreen extends ConsumerStatefulWidget {
  const NotificationCenterScreen({super.key});

  @override
  ConsumerState<NotificationCenterScreen> createState() => _NotificationCenterScreenState();
}

class _NotificationCenterScreenState extends ConsumerState<NotificationCenterScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final List<String> _tabs = ['All', 'Orders', 'Messages', 'Products'];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _handleNotificationTap(NotificationItem item) {
    if (!item.isRead) {
      ref.read(notificationServiceProvider).markAsRead(notificationId: item.id);
    }

    if (item.targetType == 'order') {
      context.push('/orders');
    } else if (item.targetType == 'chat') {
      context.push('/chat');
    } else {
      context.push('/');
    }
  }

  @override
  Widget build(BuildContext context) {
    final notificationsAsync = ref.watch(notificationsStreamProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Notifications',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          TextButton.icon(
            onPressed: () {
              ref.read(notificationServiceProvider).markAsRead();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('All notifications marked as read')),
              );
            },
            icon: const Icon(Icons.done_all, size: 16, color: AppTheme.coral),
            label: const Text('Mark all read', style: TextStyle(color: AppTheme.coral, fontSize: 12)),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppTheme.coral,
          unselectedLabelColor: Colors.grey,
          indicatorColor: AppTheme.coral,
          tabs: _tabs.map((t) => Tab(text: t)).toList(),
        ),
      ),
      body: notificationsAsync.when(
        data: (notifications) {
          return TabBarView(
            controller: _tabController,
            children: _tabs.map((tab) {
              final filtered = tab == 'All'
                  ? notifications
                  : notifications.where((n) => n.category.toLowerCase() == tab.toLowerCase()).toList();

              if (filtered.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 64,
                        height: 64,
                        decoration: BoxDecoration(
                          color: Colors.grey.shade100,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.notifications_none, size: 32, color: Colors.grey),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        tab == 'All' ? 'No notifications yet' : 'No $tab notifications',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Updates about your orders and inquiries will appear here.',
                        style: TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                    ],
                  ),
                );
              }

              return ListView.separated(
                itemCount: filtered.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final item = filtered[index];
                  return ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    leading: Stack(
                      children: [
                        CircleAvatar(
                          backgroundColor: _getCategoryColor(item.category).withOpacity(0.15),
                          child: Icon(
                            _getCategoryIcon(item.category),
                            color: _getCategoryColor(item.category),
                            size: 20,
                          ),
                        ),
                        if (!item.isRead)
                          Positioned(
                            top: 0,
                            right: 0,
                            child: Container(
                              width: 8,
                              height: 8,
                              decoration: const BoxDecoration(
                                color: Colors.red,
                                shape: BoxShape.circle,
                              ),
                            ),
                          ),
                      ],
                    ),
                    title: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            item.title,
                            style: TextStyle(
                              fontWeight: item.isRead ? FontWeight.w600 : FontWeight.bold,
                              fontSize: 14,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        Text(
                          _formatTime(item.createdAt),
                          style: const TextStyle(fontSize: 11, color: Colors.grey),
                        ),
                      ],
                    ),
                    subtitle: Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        item.message,
                        style: TextStyle(
                          fontSize: 12,
                          color: item.isRead ? Colors.grey.shade600 : AppTheme.textDark,
                          height: 1.3,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    onTap: () => _handleNotificationTap(item),
                  );
                },
              );
            }).toList(),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: Text('Error loading notifications: $err')),
      ),
    );
  }

  IconData _getCategoryIcon(String category) {
    switch (category.toLowerCase()) {
      case 'orders':
        return Icons.local_shipping_outlined;
      case 'messages':
        return Icons.chat_bubble_outline;
      case 'products':
        return Icons.phone_android;
      case 'promotions':
        return Icons.local_offer_outlined;
      default:
        return Icons.notifications_none;
    }
  }

  Color _getCategoryColor(String category) {
    switch (category.toLowerCase()) {
      case 'orders':
        return AppTheme.coral;
      case 'messages':
        return Colors.amber.shade800;
      case 'products':
        return Colors.blue;
      case 'promotions':
        return Colors.purple;
      default:
        return Colors.teal;
    }
  }

  String _formatTime(DateTime time) {
    final now = DateTime.now();
    final diff = now.difference(time);
    if (diff.inMinutes < 60) {
      return '${diff.inMinutes}m ago';
    } else if (diff.inHours < 24) {
      return '${diff.inHours}h ago';
    } else if (diff.inDays < 7) {
      return '${diff.inDays}d ago';
    } else {
      return DateFormat('MMM d').format(time);
    }
  }
}
