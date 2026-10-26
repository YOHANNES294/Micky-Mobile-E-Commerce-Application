import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:micky_mobile/core/theme/app_theme.dart';

class NotificationPermissionDialog extends StatefulWidget {
  final VoidCallback? onEnabled;

  const NotificationPermissionDialog({super.key, this.onEnabled});

  static Future<void> showIfAppropriate(BuildContext context) async {
    final prefs = await SharedPreferences.getInstance();
    final dontAskAgain = prefs.getBool('notif_dont_ask_again') ?? false;
    if (dontAskAgain) return;

    final lastDismissed = prefs.getInt('notif_last_dismissed_ms');
    if (lastDismissed != null) {
      final elapsed = DateTime.now().millisecondsSinceEpoch - lastDismissed;
      if (elapsed < 3 * 24 * 60 * 60 * 1000) {
        return; // Don't interrupt within 3 days
      }
    }

    if (!context.mounted) return;

    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => const NotificationPermissionDialog(),
    );
  }

  @override
  State<NotificationPermissionDialog> createState() => _NotificationPermissionDialogState();
}

class _NotificationPermissionDialogState extends State<NotificationPermissionDialog> {
  bool _dontAskAgain = false;

  Future<void> _handleMaybeLater() async {
    final prefs = await SharedPreferences.getInstance();
    if (_dontAskAgain) {
      await prefs.setBool('notif_dont_ask_again', true);
    } else {
      await prefs.setInt('notif_last_dismissed_ms', DateTime.now().millisecondsSinceEpoch);
    }
    if (mounted) Navigator.of(context).pop();
  }

  Future<void> _handleEnable() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('notif_enabled', true);
    widget.onEnabled?.call();

    if (mounted) {
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: AppTheme.coral,
          content: Text('Notifications Enabled! You\'ll receive order and message updates.'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      elevation: 12,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Bell Illustration with Gradient Background
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFFFFEBE6), Color(0xFFFFF7ED)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFFFD1C7)),
              ),
              child: const Icon(
                Icons.notifications_active_rounded,
                color: AppTheme.coral,
                size: 38,
              ),
            ),
            const SizedBox(height: 16),

            // Title
            const Text(
              'Never Miss an Update!',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: AppTheme.textDark,
                letterSpacing: -0.3,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),

            // Description
            const Text(
              'Get notified about order updates, new phones, special offers, and messages from our team.',
              style: TextStyle(
                fontSize: 13,
                color: Colors.grey,
                height: 1.4,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 14),

            // Three categories
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.grey.shade50,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: const Column(
                children: [
                  Row(
                    children: [
                      Icon(Icons.local_shipping_outlined, color: AppTheme.coral, size: 16),
                      SizedBox(width: 8),
                      Text('Orders & delivery updates', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                    ],
                  ),
                  SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(Icons.chat_bubble_outline, color: Colors.amber, size: 16),
                      SizedBox(width: 8),
                      Text('Customer support chat replies', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                    ],
                  ),
                  SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(Icons.phone_android, color: Colors.blue, size: 16),
                      SizedBox(width: 8),
                      Text('New phones & special offers', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Primary Enable Button
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.coral,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 2,
                ),
                onPressed: _handleEnable,
                child: const Text(
                  'Enable Notifications',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                ),
              ),
            ),
            const SizedBox(height: 6),

            // Secondary Button
            TextButton(
              onPressed: _handleMaybeLater,
              child: const Text(
                'Maybe Later',
                style: TextStyle(color: Colors.grey, fontSize: 13),
              ),
            ),

            // Don't ask again checkbox
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                SizedBox(
                  width: 24,
                  height: 24,
                  child: Checkbox(
                    value: _dontAskAgain,
                    activeColor: AppTheme.coral,
                    onChanged: (val) {
                      setState(() {
                        _dontAskAgain = val ?? false;
                      });
                    },
                  ),
                ),
                const SizedBox(width: 6),
                GestureDetector(
                  onTap: () {
                    setState(() {
                      _dontAskAgain = !_dontAskAgain;
                    });
                  },
                  child: const Text(
                    'Don\'t ask me again',
                    style: TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
