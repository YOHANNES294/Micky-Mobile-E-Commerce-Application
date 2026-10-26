import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:micky_mobile/data/models/phone.dart';
import 'package:micky_mobile/data/services/supabase_service.dart';

final brandFilterProvider = StateProvider<String>((ref) => 'All');

final phonesFutureProvider = FutureProvider<List<Phone>>((ref) async {
  try {
    final phones = await SupabaseService().fetchPhones().timeout(const Duration(seconds: 2));
    if (phones.isNotEmpty) return phones;
  } catch (e) {
    debugPrint('Supabase fetch error: $e');
  }

  // Pre-loaded inventory matching the database so items are never empty
  return [
    const Phone(
      id: 'c670c733-5c50-4fc6-9d80-3da003f8d223',
      brand: 'Samsung',
      model: 'Galaxy S24 Ultra',
      storage: '512GB',
      ram: '12GB',
      price: 135000,
      color: 'Titanium Gray',
      stock: 5,
      imageUrl: 'assets/phones/s24_ultra.jpg',
      description: 'Titanium Gray, 200MP Camera, S-Pen included',
    ),
    const Phone(
      id: 'c3fce3ce-0636-46b0-93af-ab52da5f3c42',
      brand: 'iPhone',
      model: 'iPhone 15 Pro Max',
      storage: '256GB',
      ram: '8GB',
      price: 140000,
      color: 'Natural Titanium',
      stock: 8,
      imageUrl: 'assets/phones/iphone_15_pro_max.jpg',
      description: 'Natural Titanium, A17 Pro Chip, 100% Battery health',
    ),
    const Phone(
      id: '6f740144-91ac-49d8-876a-266ecf6a7aca',
      brand: 'Samsung',
      model: 'Galaxy S23 FE',
      storage: '256GB',
      ram: '8GB',
      price: 62000,
      color: 'Mint Green',
      stock: 12,
      imageUrl: 'assets/phones/s23_fe.jpg',
      description: 'Mint Green, Brand new in box with warranty',
    ),
    const Phone(
      id: 'b50aa352-31cb-4d66-8c6f-21f4b349ce14',
      brand: 'iPhone',
      model: 'iPhone 14 Pro',
      storage: '128GB',
      ram: '6GB',
      price: 85000,
      color: 'Deep Purple',
      stock: 6,
      imageUrl: 'assets/phones/iphone_14_pro.jpg',
      description: 'Deep Purple, Dynamic Island, Premium condition',
    ),
    const Phone(
      id: '8ee18445-1c22-4f70-b85b-fa8d4e7810b0',
      brand: 'Samsung',
      model: 'Galaxy A15',
      storage: '128GB',
      ram: '6GB',
      price: 24000,
      color: 'Blue Black',
      stock: 10,
      imageUrl: 'assets/phones/galaxy_a15.jpg',
      description: 'Super AMOLED 90Hz, 50MP triple camera',
    ),
  ];
});
