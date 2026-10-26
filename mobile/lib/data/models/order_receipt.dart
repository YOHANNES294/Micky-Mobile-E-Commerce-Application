class OrderReceipt {
  final String orderId;
  final String txRef;
  final String customerName;
  final String customerPhone;
  final String customerEmail;
  final double amount;
  final List<String> items;
  final DateTime date;
  final String paymentStatus;

  const OrderReceipt({
    required this.orderId,
    required this.txRef,
    required this.customerName,
    required this.customerPhone,
    required this.customerEmail,
    required this.amount,
    required this.items,
    required this.date,
    required this.paymentStatus,
  });
}
