import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:micky_mobile/core/theme/app_theme.dart';
import 'package:micky_mobile/data/models/phone.dart';
import 'package:micky_mobile/data/services/supabase_service.dart';
import 'package:micky_mobile/presentation/screens/auth/auth_modal_sheet.dart';
import 'package:micky_mobile/presentation/screens/catalog/product_details_screen.dart';
import 'package:micky_mobile/presentation/widgets/phone_image_view.dart';

class LiveChatScreen extends StatefulWidget {
  final Phone? attachedPhone;

  const LiveChatScreen({
    super.key,
    this.attachedPhone,
  });

  @override
  State<LiveChatScreen> createState() => _LiveChatScreenState();
}

class _LiveChatScreenState extends State<LiveChatScreen> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  String? _chatId;
  Phone? _activePhone;
  bool _isLoading = true;
  bool _isSending = false;

  final presets = [
    'Is this phone available?',
    'Any discount? ቅናሽ አለው?',
    'Where is your shop in Addis?',
    'What accessories are included?',
  ];

  @override
  void initState() {
    super.initState();
    if (widget.attachedPhone != null) {
      // Pre-fill editable inquiry message template
      _messageController.text =
          "Hello, I'm interested in this phone. Is it still available? Could you please provide more information?";
    }
    _initChat();
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _initChat() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user != null) {
      final chatId = await SupabaseService().getOrCreateChat(
        user.id,
        phoneId: widget.attachedPhone?.id,
        productSnapshot: widget.attachedPhone?.toJson(),
      );

      Phone? resolvedPhone = widget.attachedPhone;
      if (resolvedPhone == null) {
        try {
          final chatData = await Supabase.instance.client
              .from('chats')
              .select('product_snapshot')
              .eq('id', chatId)
              .maybeSingle();
          if (chatData != null && chatData['product_snapshot'] != null) {
            resolvedPhone = Phone.fromJson(
              Map<String, dynamic>.from(chatData['product_snapshot'] as Map),
            );
          }
        } catch (_) {}
      }

      if (mounted) {
        setState(() {
          _chatId = chatId;
          _activePhone = resolvedPhone;
          _isLoading = false;
        });
      }
    } else {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _send(String text) async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please sign in to send messages.')),
      );
      return;
    }
    if (text.trim().isEmpty || _chatId == null || _isSending) return;

    final content = text.trim();
    _messageController.clear();
    setState(() => _isSending = true);

    try {
      await SupabaseService().sendMessage(
        chatId: _chatId!,
        senderId: user.id,
        content: content,
        attachedPhone: _activePhone ?? widget.attachedPhone,
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not send message. Please check internet connection.')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  String _formatTime(dynamic rawTime) {
    if (rawTime == null) return '';
    try {
      final dt = DateTime.parse(rawTime.toString()).toLocal();
      final hour = dt.hour > 12 ? dt.hour - 12 : (dt.hour == 0 ? 12 : dt.hour);
      final period = dt.hour >= 12 ? 'PM' : 'AM';
      final minute = dt.minute.toString().padLeft(2, '0');
      return '$hour:$minute $period';
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = Supabase.instance.client.auth.currentUser;
    final phone = _activePhone ?? widget.attachedPhone;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.support_agent_rounded, color: AppTheme.coral, size: 20),
                const SizedBox(width: 6),
                Text(
                  phone != null ? 'Chat: ${phone.model}' : 'Micky Support Live Chat',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
              ],
            ),
            const Text(
              'Online · Fast response within minutes',
              style: TextStyle(fontSize: 11, color: Colors.grey),
            ),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.coral))
          : user == null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.person_off_outlined, size: 54, color: Colors.grey),
                        const SizedBox(height: 12),
                        const Text(
                          'Sign in to chat with Micky Mobile sales team.',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.coral,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                          ),
                          onPressed: () {
                            AuthModalSheet.show(
                              context,
                              title: 'Sign In to Chat',
                              message: 'Please sign in to start your conversation with our store.',
                            );
                          },
                          child: const Text('Sign In or Register'),
                        ),
                      ],
                    ),
                  ),
                )
              : Column(
                  children: [
                    // 1. Attached Product Preview Card (Pinned at top of conversation)
                    if (phone != null)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          border: Border(
                            bottom: BorderSide(color: Colors.grey.shade200, width: 1.5),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.04),
                              blurRadius: 4,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Row(
                          children: [
                            // Thumbnail
                            Container(
                              width: 60,
                              height: 60,
                              decoration: BoxDecoration(
                                color: Colors.grey.shade100,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: Colors.grey.shade200),
                              ),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(10),
                                child: PhoneImageView(
                                  imageUrl: phone.imageUrl,
                                  brand: phone.brand,
                                  model: phone.model,
                                  fit: BoxFit.contain,
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),

                            // Phone details
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Flexible(
                                        child: Text(
                                          '${phone.brand} ${phone.model}',
                                          style: const TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 14,
                                            color: AppTheme.textDark,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: phone.isNew ? const Color(0xFF16A34A) : AppTheme.gold,
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          phone.condition.toUpperCase(),
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 9,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${phone.storage} · ${phone.ram} · ID: ${phone.id.length > 8 ? phone.id.substring(0, 8) : phone.id}',
                                    style: TextStyle(color: Colors.grey.shade600, fontSize: 11),
                                  ),
                                  const SizedBox(height: 3),
                                  Row(
                                    children: [
                                      Text(
                                        '${phone.formattedPrice} ETB',
                                        style: const TextStyle(
                                          color: AppTheme.coral,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 13,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                        decoration: BoxDecoration(
                                          color: Colors.green.shade50,
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          phone.isAvailable ? 'In Stock' : 'Unavailable',
                                          style: TextStyle(
                                            color: phone.isAvailable ? Colors.green.shade700 : Colors.red.shade700,
                                            fontSize: 10,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),

                            // View Details Button
                            TextButton(
                              style: TextButton.styleFrom(
                                padding: const EdgeInsets.symmetric(horizontal: 10),
                                visualDensity: VisualDensity.compact,
                              ),
                              onPressed: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => ProductDetailsScreen(phone: phone),
                                  ),
                                );
                              },
                              child: const Text('Details', style: TextStyle(fontSize: 12)),
                            ),
                          ],
                        ),
                      ),

                    // Quick Preset Chips
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      child: Row(
                        children: presets.map((p) {
                          return Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: ActionChip(
                              label: Text(p, style: const TextStyle(fontSize: 12, color: AppTheme.coral)),
                              backgroundColor: AppTheme.coralLight,
                              onPressed: () {
                                _messageController.text = p;
                              },
                            ),
                          );
                        }).toList(),
                      ),
                    ),

                    // 2. Real-Time Messages Feed
                    Expanded(
                      child: _chatId == null
                          ? const Center(child: CircularProgressIndicator(color: AppTheme.coral))
                          : StreamBuilder<List<Map<String, dynamic>>>(
                              stream: Supabase.instance.client
                                  .from('messages')
                                  .stream(primaryKey: ['id'])
                                  .eq('chat_id', _chatId!)
                                  .order('created_at', ascending: true),
                              builder: (context, snapshot) {
                                if (!snapshot.hasData) {
                                  return const Center(child: CircularProgressIndicator(color: AppTheme.coral));
                                }
                                final msgs = snapshot.data!;

                                if (msgs.isEmpty) {
                                  return Center(
                                    child: Padding(
                                      padding: const EdgeInsets.all(32.0),
                                      child: Column(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          Icon(Icons.forum_outlined, size: 48, color: Colors.grey.shade400),
                                          const SizedBox(height: 12),
                                          Text(
                                            phone != null
                                                ? 'Start your inquiry for ${phone.brand} ${phone.model}.'
                                                : 'Ask our store team anything.',
                                            style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                                            textAlign: TextAlign.center,
                                          ),
                                        ],
                                      ),
                                    ),
                                  );
                                }

                                return ListView.builder(
                                  controller: _scrollController,
                                  padding: const EdgeInsets.all(16),
                                  itemCount: msgs.length,
                                  itemBuilder: (context, index) {
                                    final msg = msgs[index];
                                    final isOwn = msg['sender_id'] == user.id;
                                    final timeStr = _formatTime(msg['created_at']);

                                    return Align(
                                      alignment: isOwn ? Alignment.centerRight : Alignment.centerLeft,
                                      child: Container(
                                        margin: const EdgeInsets.only(bottom: 10),
                                        constraints: BoxConstraints(
                                          maxWidth: MediaQuery.of(context).size.width * 0.78,
                                        ),
                                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                        decoration: BoxDecoration(
                                          color: isOwn ? AppTheme.coral : Colors.grey.shade200,
                                          borderRadius: BorderRadius.circular(16).copyWith(
                                            bottomRight: isOwn ? Radius.zero : const Radius.circular(16),
                                            bottomLeft: !isOwn ? Radius.zero : const Radius.circular(16),
                                          ),
                                          boxShadow: [
                                            BoxShadow(
                                              color: Colors.black.withOpacity(0.04),
                                              blurRadius: 3,
                                              offset: const Offset(0, 1),
                                            ),
                                          ],
                                        ),
                                        child: Column(
                                          crossAxisAlignment:
                                              isOwn ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              msg['content'] ?? '',
                                              style: TextStyle(
                                                color: isOwn ? Colors.white : AppTheme.textDark,
                                                fontSize: 14,
                                              ),
                                            ),
                                            if (timeStr.isNotEmpty) ...[
                                              const SizedBox(height: 4),
                                              Text(
                                                timeStr,
                                                style: TextStyle(
                                                  color: isOwn ? Colors.white70 : Colors.grey.shade600,
                                                  fontSize: 10,
                                                ),
                                              ),
                                            ],
                                          ],
                                        ),
                                      ),
                                    );
                                  },
                                );
                              },
                            ),
                    ),

                    // 3. Bottom Message Input Bar
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.06),
                            blurRadius: 8,
                            offset: const Offset(0, -2),
                          ),
                        ],
                      ),
                      child: SafeArea(
                        child: Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _messageController,
                                maxLines: null,
                                decoration: InputDecoration(
                                  hintText: phone != null
                                      ? 'Ask about ${phone.model}...'
                                      : 'Type message... መልእክትዎን እዚህ ይጻፉ...',
                                  hintStyle: TextStyle(fontSize: 13, color: Colors.grey.shade500),
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                  filled: true,
                                  fillColor: Colors.grey.shade100,
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(24),
                                    borderSide: BorderSide.none,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            CircleAvatar(
                              radius: 22,
                              backgroundColor: AppTheme.coral,
                              child: IconButton(
                                icon: const Icon(Icons.send_rounded, color: Colors.white, size: 20),
                                onPressed: () => _send(_messageController.text),
                              ),
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
