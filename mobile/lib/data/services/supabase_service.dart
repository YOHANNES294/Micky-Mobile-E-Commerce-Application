import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:micky_mobile/core/constants/app_constants.dart';
import 'package:micky_mobile/data/models/phone.dart';

class SupabaseService {
  static final SupabaseService _instance = SupabaseService._internal();
  factory SupabaseService() => _instance;
  SupabaseService._internal();

  SupabaseClient get client => Supabase.instance.client;

  static Future<void> initialize() async {
    await Supabase.initialize(
      url: AppConstants.supabaseUrl,
      anonKey: AppConstants.supabaseAnonKey,
    );
  }

  Future<List<Phone>> fetchPhones({String? brand}) async {
    var query = client.from('phones').select('*');
    if (brand != null && brand.isNotEmpty && brand != 'All') {
      query = query.eq('brand', brand);
    }
    final data = await query.order('created_at', ascending: false);
    return (data as List).map((json) => Phone.fromJson(json)).toList();
  }

  Future<Phone?> fetchPhoneById(String id) async {
    try {
      final data = await client.from('phones').select('*').eq('id', id).maybeSingle();
      if (data == null) return null;
      return Phone.fromJson(data);
    } catch (_) {
      return null;
    }
  }

  Stream<List<Phone>> streamPhones() {
    return client
        .from('phones')
        .stream(primaryKey: ['id'])
        .order('created_at', ascending: false)
        .map((maps) => maps.map((item) => Phone.fromJson(item)).toList());
  }

  Future<String> getOrCreateChat(
    String userId, {
    String? phoneId,
    Map<String, dynamic>? productSnapshot,
  }) async {
    // 1. Try to find an existing chat linked to this specific product
    if (phoneId != null) {
      try {
        final existingProductChat = await client
            .from('chats')
            .select('id')
            .eq('client_id', userId)
            .eq('phone_id', phoneId)
            .maybeSingle();

        if (existingProductChat != null) {
          return existingProductChat['id'] as String;
        }
      } catch (_) {
        // phone_id column might not be present yet in legacy table
      }
    }

    // 2. Try to find the most recent conversation for this customer
    try {
      final existingChat = await client
          .from('chats')
          .select('id')
          .eq('client_id', userId)
          .order('updated_at', ascending: false)
          .limit(1)
          .maybeSingle();

      if (existingChat != null) {
        // Update phone_id if column exists
        if (phoneId != null) {
          try {
            await client.from('chats').update({
              'phone_id': phoneId,
              if (productSnapshot != null) 'product_snapshot': productSnapshot,
              'updated_at': DateTime.now().toIso8601String(),
            }).eq('id', existingChat['id']);
          } catch (_) {}
        }
        return existingChat['id'] as String;
      }
    } catch (_) {}

    // 3. Create a new chat row
    try {
      final insertData = <String, dynamic>{
        'client_id': userId,
        if (phoneId != null) 'phone_id': phoneId,
        if (productSnapshot != null) 'product_snapshot': productSnapshot,
      };

      final newChat = await client
          .from('chats')
          .insert(insertData)
          .select()
          .single();

      return newChat['id'] as String;
    } catch (_) {
      // Fallback insert without phone_id if column is not yet migrated
      final fallbackChat = await client
          .from('chats')
          .insert({'client_id': userId})
          .select()
          .single();

      return fallbackChat['id'] as String;
    }
  }

  Future<void> sendMessage({
    required String chatId,
    required String senderId,
    required String content,
    Phone? attachedPhone,
  }) async {
    await client.from('messages').insert({
      'chat_id': chatId,
      'sender_id': senderId,
      'content': content,
    });

    try {
      final updateData = <String, dynamic>{
        'updated_at': DateTime.now().toIso8601String(),
        if (attachedPhone != null) 'phone_id': attachedPhone.id,
      };
      await client.from('chats').update(updateData).eq('id', chatId);
    } catch (_) {}
  }
}
