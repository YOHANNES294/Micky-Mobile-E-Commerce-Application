class Phone {
  final String id;
  final String brand; // 'Samsung' or 'iPhone'
  final String model;
  final String storage;
  final String ram;
  final double price;
  final String? color;
  final int stock;
  final String? imageUrl;
  final String? description;
  final String? battery;
  final String? network;
  final String? sim;
  final String condition; // 'New' or 'Used' / 'Like New'
  final String? batteryHealth;
  final String? defects;
  final String warranty;
  final String? display;
  final String? camera;
  final String? os;
  final String sellerName;

  const Phone({
    required this.id,
    required this.brand,
    required this.model,
    required this.storage,
    required this.ram,
    required this.price,
    this.color,
    this.stock = 5,
    this.imageUrl,
    this.description,
    this.battery,
    this.network,
    this.sim,
    this.condition = 'New',
    this.batteryHealth,
    this.defects,
    this.warranty = '1 Year Official Warranty',
    this.display,
    this.camera,
    this.os,
    this.sellerName = 'Micky Mobile Official Store',
  });

  bool get isNew => condition.trim().toLowerCase() == 'new';
  bool get isAvailable => stock > 0;

  String get formattedPrice {
    final str = price.toStringAsFixed(0);
    // Add comma separators
    final reg = RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))');
    return str.replaceAllMapped(reg, (Match m) => '${m[1]},');
  }

  factory Phone.fromJson(Map<String, dynamic> json) {
    double parsedPrice = 0.0;
    final rawPrice = json['price'];
    if (rawPrice is num) {
      parsedPrice = rawPrice.toDouble();
    } else if (rawPrice is String) {
      final sanitized = rawPrice.replaceAll(',', '').replaceAll('ETB', '').trim();
      parsedPrice = double.tryParse(sanitized) ?? 0.0;
    }

    final desc = (json['message'] ?? json['description']) as String?;
    final cond = json['condition'] as String? ??
        (desc?.toLowerCase().contains('used') == true ? 'Used' : 'New');

    return Phone(
      id: json['id']?.toString() ?? DateTime.now().millisecondsSinceEpoch.toString(),
      brand: json['brand'] as String? ?? 'Samsung',
      model: json['model'] as String? ?? '',
      storage: json['storage'] as String? ?? '128GB',
      ram: json['ram'] as String? ?? '8GB',
      price: parsedPrice,
      color: json['color'] as String?,
      stock: (json['stock'] as num?)?.toInt() ?? 5,
      imageUrl: (json['image'] ?? json['image_url']) as String?,
      description: desc,
      battery: (json['battery'] ?? json['battery_capacity']) as String?,
      network: json['network'] as String?,
      sim: json['sim'] as String?,
      condition: cond,
      batteryHealth: json['battery_health'] as String?,
      defects: json['defects'] as String?,
      warranty: json['warranty'] as String? ?? '1 Year Official Warranty',
      display: json['display'] as String?,
      camera: json['camera'] as String?,
      os: json['os'] as String?,
      sellerName: json['seller_name'] as String? ?? 'Micky Mobile Official Store',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'brand': brand,
      'model': model,
      'storage': storage,
      'ram': ram,
      'price': price,
      'color': color,
      'stock': stock,
      'image': imageUrl,
      'message': description,
      'battery': battery,
      'network': network,
      'sim': sim,
      'condition': condition,
      'battery_health': batteryHealth,
      'defects': defects,
      'warranty': warranty,
      'display': display,
      'camera': camera,
      'os': os,
      'seller_name': sellerName,
    };
  }
}
