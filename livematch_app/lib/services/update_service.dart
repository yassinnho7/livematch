import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:dio/dio.dart';

/// Service for checking and handling app updates
class UpdateService {
  static final UpdateService _instance = UpdateService._internal();
  factory UpdateService() => _instance;
  UpdateService._internal();
  
  static const String _githubRepo = 'your-username/livematch-app';
  static const String _playStoreUrl = 'https://play.google.com/store/apps/details?id=com.livematch.livematch_app';
  
  String? _currentVersion;
  String? _latestVersion;
  String? _downloadUrl;
  String? _releaseNotes;
  
  /// Get current app version
  Future<String> getCurrentVersion() async {
    if (_currentVersion != null) return _currentVersion!;
    
    final info = await PackageInfo.fromPlatform();
    _currentVersion = info.version;
    return _currentVersion!;
  }
  
  /// Check for updates from GitHub releases
  Future<UpdateInfo?> checkForUpdate() async {
    try {
      final currentVersion = await getCurrentVersion();
      
      // Check GitHub releases
      final response = await Dio().get(
        'https://api.github.com/repos/$_githubRepo/releases/latest',
      );
      
      if (response.statusCode == 200) {
        final data = response.data;
        _latestVersion = data['tag_name']?.toString().replaceAll('v', '');
        _releaseNotes = data['body'];
        
        // Get APK download URL
        final assets = data['assets'] as List?;
        if (assets != null) {
          for (final asset in assets) {
            if (asset['name'].toString().endsWith('.apk')) {
              _downloadUrl = asset['browser_download_url'];
              break;
            }
          }
        }
        
        // Compare versions
        if (_latestVersion != null) {
          final needsUpdate = _compareVersions(currentVersion, _latestVersion!) < 0;
          
          return UpdateInfo(
            currentVersion: currentVersion,
            latestVersion: _latestVersion!,
            needsUpdate: needsUpdate,
            downloadUrl: _downloadUrl,
            releaseNotes: _releaseNotes,
          );
        }
      }
    } catch (e) {
      debugPrint('Failed to check for updates: $e');
    }
    
    return null;
  }
  
  /// Compare two version strings
  /// Returns: negative if v1 < v2, 0 if equal, positive if v1 > v2
  int _compareVersions(String v1, String v2) {
    final parts1 = v1.split('.').map((p) => int.tryParse(p) ?? 0).toList();
    final parts2 = v2.split('.').map((p) => int.tryParse(p) ?? 0).toList();
    
    // Pad with zeros
    while (parts1.length < 3) parts1.add(0);
    while (parts2.length < 3) parts2.add(0);
    
    for (var i = 0; i < 3; i++) {
      if (parts1[i] < parts2[i]) return -1;
      if (parts1[i] > parts2[i]) return 1;
    }
    
    return 0;
  }
  
  /// Open download URL
  Future<bool> openDownloadUrl() async {
    if (_downloadUrl == null) return false;
    
    final uri = Uri.parse(_downloadUrl!);
    if (await canLaunchUrl(uri)) {
      return await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
    return false;
  }
  
  /// Open Play Store
  Future<bool> openPlayStore() async {
    final uri = Uri.parse(_playStoreUrl);
    if (await canLaunchUrl(uri)) {
      return await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
    return false;
  }
}

/// Update information model
class UpdateInfo {
  final String currentVersion;
  final String latestVersion;
  final bool needsUpdate;
  final String? downloadUrl;
  final String? releaseNotes;
  
  const UpdateInfo({
    required this.currentVersion,
    required this.latestVersion,
    required this.needsUpdate,
    this.downloadUrl,
    this.releaseNotes,
  });
}

/// Update dialog widget
class UpdateDialog extends StatelessWidget {
  final UpdateInfo updateInfo;
  final VoidCallback onUpdate;
  final VoidCallback? onLater;
  
  const UpdateDialog({
    super.key,
    required this.updateInfo,
    required this.onUpdate,
    this.onLater,
  });
  
  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: const Color(0xFF1E1E1E),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      title: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF00E676), Color(0xFF00BCD4)],
              ),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              Icons.system_update,
              color: Color(0xFF0D0D0D),
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          const Text(
            'Update Available',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
            ),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Version ${updateInfo.latestVersion} is available',
            style: const TextStyle(
              color: Color(0xFFB3B3B3),
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Current: ${updateInfo.currentVersion}',
            style: const TextStyle(
              color: Color(0xFF808080),
              fontSize: 12,
            ),
          ),
          if (updateInfo.releaseNotes != null) ...[
            const SizedBox(height: 16),
            const Text(
              'What\'s new:',
              style: TextStyle(
                color: Colors.white,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Container(
              constraints: const BoxConstraints(maxHeight: 150),
              child: SingleChildScrollView(
                child: Text(
                  updateInfo.releaseNotes!,
                  style: const TextStyle(
                    color: Color(0xFFB3B3B3),
                    fontSize: 12,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
      actions: [
        if (onLater != null)
          TextButton(
            onPressed: onLater,
            child: const Text(
              'Later',
              style: TextStyle(color: Color(0xFF808080)),
            ),
          ),
        ElevatedButton(
          onPressed: onUpdate,
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF00E676),
            foregroundColor: const Color(0xFF0D0D0D),
          ),
          child: const Text('Update Now'),
        ),
      ],
    );
  }
  
  /// Show update dialog
  static Future<void> show(
    BuildContext context, {
    required UpdateInfo updateInfo,
    required VoidCallback onUpdate,
    VoidCallback? onLater,
  }) {
    return showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => UpdateDialog(
        updateInfo: updateInfo,
        onUpdate: onUpdate,
        onLater: onLater,
      ),
    );
  }
}
