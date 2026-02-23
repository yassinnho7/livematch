import 'package:flutter/material.dart';

/// Premium dark theme colors for LiveMatch app
class AppColors {
  // Primary colors
  static const Color primary = Color(0xFF00E676);
  static const Color primaryDark = Color(0xFF00C853);
  static const Color primaryLight = Color(0xFF69F0AE);
  
  // Accent colors
  static const Color accent = Color(0xFF00BCD4);
  static const Color accentDark = Color(0xFF0097A7);
  
  // Background colors
  static const Color background = Color(0xFF0D0D0D);
  static const Color backgroundLight = Color(0xFF1A1A1A);
  static const Color surface = Color(0xFF1E1E1E);
  static const Color surfaceLight = Color(0xFF2A2A2A);
  static const Color card = Color(0xFF252525);
  static const Color cardLight = Color(0xFF303030);
  
  // Text colors
  static const Color textPrimary = Color(0xFFFFFFFF);
  static const Color textSecondary = Color(0xFFB3B3B3);
  static const Color textTertiary = Color(0xFF808080);
  static const Color textMuted = Color(0xFF4D4D4D);
  
  // Status colors
  static const Color live = Color(0xFFFF1744);
  static const Color liveGlow = Color(0xFFFF5252);
  static const Color success = Color(0xFF00E676);
  static const Color warning = Color(0xFFFFAB00);
  static const Color error = Color(0xFFFF5252);
  static const Color info = Color(0xFF2196F3);
  
  // Gradient colors
  static const List<Color> liveGradient = [
    Color(0xFFFF1744),
    Color(0xFFFF5252),
  ];
  
  static const List<Color> primaryGradient = [
    Color(0xFF00E676),
    Color(0xFF00BCD4),
  ];
  
  static const List<Color> cardGradient = [
    Color(0xFF1E1E1E),
    Color(0xFF252525),
  ];
  
  // League colors (common leagues)
  static const Color championsLeague = Color(0xFF1A237E);
  static const Color premierLeague = Color(0xFF3D195B);
  static const Color laLiga = Color(0xFFFF4B44);
  static const Color serieA = Color(0xFF024494);
  static const Color bundesliga = Color(0xFFD20515);
  static const Color ligue1 = Color(0xFF091C3E);
  
  // Team score colors
  static const Color winning = Color(0xFF00E676);
  static const Color losing = Color(0xFFFF5252);
  static const Color draw = Color(0xFFFFAB00);
  
  // Overlay colors
  static const Color overlay = Color(0x80000000);
  static const Color overlayLight = Color(0x40000000);
  
  // Divider
  static const Color divider = Color(0xFF333333);
  static const Color dividerLight = Color(0xFF404040);
  
  // Shimmer effect
  static const Color shimmerBase = Color(0xFF2A2A2A);
  static const Color shimmerHighlight = Color(0xFF3A3A3A);
}
