import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:micky_mobile/core/constants/app_constants.dart';
import 'package:micky_mobile/core/theme/app_theme.dart';
import 'package:micky_mobile/logic/auth_provider.dart';
import 'package:micky_mobile/logic/cart_provider.dart';
import 'package:micky_mobile/presentation/screens/auth/auth_modal_sheet.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  void _showEditProfileDialog(BuildContext context, WidgetRef ref, UserProfile profile) {
    final nameController = TextEditingController(text: profile.fullName);
    final phoneController = TextEditingController(text: profile.phone);
    final addressController = TextEditingController(text: profile.deliveryAddress ?? '');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Edit Customer Profile', style: TextStyle(fontWeight: FontWeight.bold)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(
                  labelText: 'Full Name',
                  prefixIcon: Icon(Icons.person_outline),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: phoneController,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Phone Number (+251)',
                  prefixIcon: Icon(Icons.phone_outlined),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: addressController,
                decoration: const InputDecoration(
                  labelText: 'Delivery Address',
                  hintText: 'e.g. Bole Medhanialem, Addis Ababa',
                  prefixIcon: Icon(Icons.location_on_outlined),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.coral),
            onPressed: () async {
              Navigator.of(ctx).pop();
              try {
                await ref.read(authProvider.notifier).updateProfile(
                  fullName: nameController.text.trim(),
                  phone: phoneController.text.trim(),
                  deliveryAddress: addressController.text.trim(),
                );
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Profile updated successfully!'),
                      backgroundColor: Color(0xFF16A34A),
                    ),
                  );
                }
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Failed to update: $e')),
                  );
                }
              }
            },
            child: const Text('Save Changes', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showHelpSupportDialog(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Help & Support',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(ctx).pop(),
                  ),
                ],
              ),
              const Divider(),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.green.shade50,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.phone, color: Colors.green),
                ),
                title: const Text('Direct Store Call'),
                subtitle: const Text(AppConstants.shopPhone),
                trailing: const Icon(Icons.arrow_forward_ios, size: 14),
                onTap: () async {
                  final uri = Uri.parse('tel:${AppConstants.shopPhone.replaceAll(' ', '')}');
                  if (await canLaunchUrl(uri)) await launchUrl(uri);
                },
              ),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.location_on, color: AppTheme.coral),
                ),
                title: const Text('Shop Location'),
                subtitle: const Text(AppConstants.shopAddress),
                trailing: const Icon(Icons.arrow_forward_ios, size: 14),
                onTap: () {},
              ),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.blue.shade50,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.chat_bubble_outline, color: Colors.blue),
                ),
                title: const Text('In-App Live Chat'),
                subtitle: const Text('Instant answers from our sales team'),
                trailing: const Icon(Icons.arrow_forward_ios, size: 14),
                onTap: () {
                  Navigator.of(ctx).pop();
                  context.push('/chat');
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showAddressDialog(BuildContext context, WidgetRef ref, UserProfile profile) {
    final addressController = TextEditingController(text: profile.deliveryAddress ?? '');
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delivery Addresses'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Set your primary delivery address in Addis Ababa or Ethiopian regional cities:',
              style: TextStyle(fontSize: 13, color: Colors.grey),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: addressController,
              maxLines: 2,
              decoration: const InputDecoration(
                hintText: 'e.g. House No 402, Bole Subcity, Addis Ababa',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.coral),
            onPressed: () async {
              Navigator.of(ctx).pop();
              await ref.read(authProvider.notifier).updateProfile(
                deliveryAddress: addressController.text.trim(),
              );
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Delivery address updated!'),
                    backgroundColor: Color(0xFF16A34A),
                  ),
                );
              }
            },
            child: const Text('Save Address', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _confirmSignOut(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out of your account?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () async {
              Navigator.of(ctx).pop();
              await ref.read(authProvider.notifier).signOut();
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Signed out successfully.')),
                );
              }
            },
            child: const Text('Sign Out', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final user = authState.value;
    final cartCount = ref.watch(cartProvider.select((items) => items.fold(0, (sum, i) => sum + i.quantity)));

    return Scaffold(
      backgroundColor: Colors.grey.shade100,
      appBar: AppBar(
        title: const Text('Customer Profile'),
        elevation: 0,
        backgroundColor: AppTheme.coral,
        foregroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/');
            }
          },
        ),
        actions: [
          if (user != null)
            IconButton(
              icon: const Icon(Icons.logout_rounded, color: Colors.white),
              tooltip: 'Sign Out',
              onPressed: () => _confirmSignOut(context, ref),
            ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            // ================= 1. ALIEXPRESS HEADER PROFILE CARD =================
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppTheme.coral, Color(0xFFBE123C)],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
                borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
              ),
              child: user == null
                  ? _buildGuestHeader(context)
                  : _buildUserHeader(context, ref, user),
            ),

            const SizedBox(height: 14),

            // ================= 2. QUICK ORDER STATUS BAR (AliExpress style) =================
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Card(
                elevation: 1.5,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'My Orders',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.textDark,
                            ),
                          ),
                          InkWell(
                            onTap: () {
                              if (user == null) {
                                AuthModalSheet.show(context, title: 'View Orders');
                              } else {
                                context.push('/orders');
                              }
                            },
                            child: const Row(
                              children: [
                                Text('View All', style: TextStyle(fontSize: 12, color: Colors.grey)),
                                Icon(Icons.chevron_right, size: 16, color: Colors.grey),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _OrderStatusItem(
                            icon: Icons.payment_rounded,
                            label: 'To Pay',
                            onTap: () {
                              if (user == null) {
                                AuthModalSheet.show(context);
                              } else {
                                context.push('/orders?status=pending');
                              }
                            },
                          ),
                          _OrderStatusItem(
                            icon: Icons.inventory_2_outlined,
                            label: 'To Ship',
                            onTap: () {
                              if (user == null) {
                                AuthModalSheet.show(context);
                              } else {
                                context.push('/orders?status=processing');
                              }
                            },
                          ),
                          _OrderStatusItem(
                            icon: Icons.local_shipping_outlined,
                            label: 'Shipped',
                            onTap: () {
                              if (user == null) {
                                AuthModalSheet.show(context);
                              } else {
                                context.push('/orders?status=fulfilled');
                              }
                            },
                          ),
                          _OrderStatusItem(
                            icon: Icons.assignment_return_outlined,
                            label: 'Returns',
                            onTap: () {
                              if (user == null) {
                                AuthModalSheet.show(context);
                              } else {
                                context.push('/orders?status=returns');
                              }
                            },
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),

            const SizedBox(height: 14),

            // ================= 3. SHOPPING MENU SECTION =================
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Card(
                elevation: 1.5,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                child: Column(
                  children: [
                    _MenuTile(
                      icon: Icons.shopping_bag_outlined,
                      title: 'My Cart',
                      badge: cartCount > 0 ? '$cartCount items' : null,
                      onTap: () => context.push('/cart'),
                    ),
                    const Divider(height: 1, indent: 56),
                    _MenuTile(
                      icon: Icons.favorite_border,
                      title: 'Wishlist',
                      subtitle: 'Saved Samsung & iPhone models',
                      onTap: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Wishlist feature synced! All favorite phones are available in catalog.')),
                        );
                      },
                    ),
                    const Divider(height: 1, indent: 56),
                    _MenuTile(
                      icon: Icons.location_on_outlined,
                      title: 'Delivery Addresses',
                      subtitle: user?.deliveryAddress ?? 'Add Addis Ababa address',
                      onTap: () {
                        if (user == null) {
                          AuthModalSheet.show(context);
                        } else {
                          _showAddressDialog(context, ref, user);
                        }
                      },
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 14),

            // ================= 4. COMMUNICATION & SUPPORT SECTION =================
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Card(
                elevation: 1.5,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                child: Column(
                  children: [
                    _MenuTile(
                      icon: Icons.chat_bubble_outline_rounded,
                      title: 'Messages & Support Chat',
                      subtitle: 'Direct support with store team',
                      onTap: () {
                        if (user == null) {
                          AuthModalSheet.show(context, title: 'Store Live Chat');
                        } else {
                          context.push('/chat');
                        }
                      },
                    ),
                    const Divider(height: 1, indent: 56),
                    _MenuTile(
                      icon: Icons.notifications_none_rounded,
                      title: 'Notifications',
                      subtitle: 'Stock alerts and special discounts',
                      onTap: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('No new notifications at this time.')),
                        );
                      },
                    ),
                    const Divider(height: 1, indent: 56),
                    _MenuTile(
                      icon: Icons.help_outline_rounded,
                      title: 'Help & Support',
                      subtitle: 'Store location, call & FAQs',
                      onTap: () => _showHelpSupportDialog(context),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 14),

            // ================= 5. ACCOUNT SETTINGS & SIGN OUT =================
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Card(
                elevation: 1.5,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                child: Column(
                  children: [
                    _MenuTile(
                      icon: Icons.settings_outlined,
                      title: 'Account Settings',
                      subtitle: 'Security, password & preferences',
                      onTap: () {
                        if (user == null) {
                          AuthModalSheet.show(context);
                        } else {
                          _showEditProfileDialog(context, ref, user);
                        }
                      },
                    ),
                    if (user != null) ...[
                      const Divider(height: 1, indent: 56),
                      _MenuTile(
                        icon: Icons.logout_rounded,
                        iconColor: Colors.red,
                        textColor: Colors.red,
                        title: 'Sign Out',
                        onTap: () => _confirmSignOut(context, ref),
                      ),
                    ],
                  ],
                ),
              ),
            ),

            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildUserHeader(BuildContext context, WidgetRef ref, UserProfile user) {
    return Row(
      children: [
        // Avatar with edit badge
        Stack(
          children: [
            CircleAvatar(
              radius: 36,
              backgroundColor: Colors.white,
              child: CircleAvatar(
                radius: 33,
                backgroundColor: AppTheme.gold.withOpacity(0.2),
                child: Text(
                  user.fullName.isNotEmpty ? user.fullName[0].toUpperCase() : 'U',
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.coral,
                  ),
                ),
              ),
            ),
            Positioned(
              bottom: 0,
              right: 0,
              child: InkWell(
                onTap: () => _showEditProfileDialog(context, ref, user),
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(
                    color: AppTheme.gold,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.edit, size: 14, color: Colors.white),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(width: 16),
        // Name, Email, Phone
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Flexible(
                    child: Text(
                      user.fullName,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppTheme.gold,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Text(
                      'VIP 🇪🇹',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                user.email,
                style: TextStyle(fontSize: 12, color: Colors.white.withOpacity(0.9)),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              if (user.phone.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  user.phone,
                  style: TextStyle(fontSize: 12, color: Colors.white.withOpacity(0.85)),
                ),
              ],
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: [
                  InkWell(
                    onTap: () => _showEditProfileDialog(context, ref, user),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.white.withOpacity(0.4)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.edit, size: 12, color: Colors.white),
                          SizedBox(width: 4),
                          Text(
                            'Edit Profile',
                            style: TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
                  ),
                  InkWell(
                    onTap: () => _confirmSignOut(context, ref),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.25),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.white.withOpacity(0.3)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.logout, size: 12, color: Colors.white),
                          SizedBox(width: 4),
                          Text(
                            'Sign Out',
                            style: TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildGuestHeader(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const CircleAvatar(
          radius: 34,
          backgroundColor: Colors.white24,
          child: Icon(Icons.person_outline, size: 40, color: Colors.white),
        ),
        const SizedBox(height: 12),
        const Text(
          'Welcome to Micky Mobile',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Sign in to sync your cart, orders, and addresses',
          style: TextStyle(
            fontSize: 13,
            color: Colors.white.withOpacity(0.9),
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 18),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: AppTheme.coral,
                minimumSize: const Size(120, 42),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
                elevation: 2,
              ),
              onPressed: () => context.push('/login'),
              child: const Text('Sign In', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
            const SizedBox(width: 14),
            OutlinedButton(
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white,
                minimumSize: const Size(120, 42),
                side: const BorderSide(color: Colors.white, width: 1.5),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
              ),
              onPressed: () => context.push('/register'),
              child: const Text('Register', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ],
    );
  }
}

class _OrderStatusItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _OrderStatusItem({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
        child: Column(
          children: [
            Icon(icon, size: 28, color: AppTheme.coral),
            const SizedBox(height: 6),
            Text(
              label,
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: AppTheme.textDark),
            ),
          ],
        ),
      ),
    );
  }
}

class _MenuTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final String? badge;
  final Color? iconColor;
  final Color? textColor;
  final VoidCallback onTap;

  const _MenuTile({
    required this.icon,
    required this.title,
    this.subtitle,
    this.badge,
    this.iconColor,
    this.textColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: iconColor ?? AppTheme.textDark, size: 22),
      title: Text(
        title,
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: textColor ?? AppTheme.textDark,
        ),
      ),
      subtitle: subtitle != null
          ? Text(subtitle!, style: const TextStyle(fontSize: 12, color: Colors.grey))
          : null,
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (badge != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              margin: const EdgeInsets.only(right: 6),
              decoration: BoxDecoration(
                color: AppTheme.coral,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                badge!,
                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
              ),
            ),
          const Icon(Icons.chevron_right, size: 18, color: Colors.grey),
        ],
      ),
      onTap: onTap,
    );
  }
}
