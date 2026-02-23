/// Match entity representing a football match
class Match {
  final String id;
  final String homeTeam;
  final String awayTeam;
  final String? homeTeamLogo;
  final String? awayTeamLogo;
  final int? homeScore;
  final int? awayScore;
  final String league;
  final String? leagueLogo;
  final String? country;
  final DateTime startTime;
  final MatchStatus status;
  final int? minute;
  final bool isLive;
  final List<StreamServer> servers;
  final String? stadium;
  final String? referee;
  
  const Match({
    required this.id,
    required this.homeTeam,
    required this.awayTeam,
    this.homeTeamLogo,
    this.awayTeamLogo,
    this.homeScore,
    this.awayScore,
    required this.league,
    this.leagueLogo,
    this.country,
    required this.startTime,
    required this.status,
    this.minute,
    this.isLive = false,
    this.servers = const [],
    this.stadium,
    this.referee,
  });
  
  /// Check if match has started
  bool get hasStarted => status != MatchStatus.scheduled;
  
  /// Check if match is finished
  bool get isFinished => status == MatchStatus.finished;
  
  /// Check if match is in first half
  bool get isFirstHalf => minute != null && minute! <= 45;
  
  /// Check if match is in second half
  bool get isSecondHalf => minute != null && minute! > 45 && minute! <= 90;
  
  /// Get match time display
  String get timeDisplay {
    if (isLive && minute != null) {
      return "$minute'";
    }
    return status.display;
  }
  
  /// Get formatted start time
  String get formattedTime {
    final hour = startTime.hour.toString().padLeft(2, '0');
    final minute = startTime.minute.toString().padLeft(2, '0');
    return '$hour:$minute';
  }
  
  /// Get formatted date
  String get formattedDate {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final matchDay = DateTime(startTime.year, startTime.month, startTime.day);
    
    if (matchDay == today) {
      return 'Today';
    } else if (matchDay == today.add(const Duration(days: 1))) {
      return 'Tomorrow';
    } else {
      return '${startTime.day}/${startTime.month}';
    }
  }
  
  /// Copy with new values
  Match copyWith({
    String? id,
    String? homeTeam,
    String? awayTeam,
    String? homeTeamLogo,
    String? awayTeamLogo,
    int? homeScore,
    int? awayScore,
    String? league,
    String? leagueLogo,
    String? country,
    DateTime? startTime,
    MatchStatus? status,
    int? minute,
    bool? isLive,
    List<StreamServer>? servers,
    String? stadium,
    String? referee,
  }) {
    return Match(
      id: id ?? this.id,
      homeTeam: homeTeam ?? this.homeTeam,
      awayTeam: awayTeam ?? this.awayTeam,
      homeTeamLogo: homeTeamLogo ?? this.homeTeamLogo,
      awayTeamLogo: awayTeamLogo ?? this.awayTeamLogo,
      homeScore: homeScore ?? this.homeScore,
      awayScore: awayScore ?? this.awayScore,
      league: league ?? this.league,
      leagueLogo: leagueLogo ?? this.leagueLogo,
      country: country ?? this.country,
      startTime: startTime ?? this.startTime,
      status: status ?? this.status,
      minute: minute ?? this.minute,
      isLive: isLive ?? this.isLive,
      servers: servers ?? this.servers,
      stadium: stadium ?? this.stadium,
      referee: referee ?? this.referee,
    );
  }
  
  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is Match && other.id == id;
  }
  
  @override
  int get hashCode => id.hashCode;
}

/// Match status enum
enum MatchStatus {
  scheduled('Scheduled'),
  live('Live'),
  halftime('HT'),
  finished('FT'),
  postponed('Postponed'),
  cancelled('Cancelled'),
  extraTime('ET'),
  penalties('PEN');
  
  final String display;
  const MatchStatus(this.display);
}

/// Stream server model
class StreamServer {
  final String id;
  final String name;
  final String quality;
  final String? url;
  final bool isHD;
  final bool isPremium;
  final ServerSource source;
  
  const StreamServer({
    required this.id,
    required this.name,
    required this.quality,
    this.url,
    this.isHD = false,
    this.isPremium = false,
    required this.source,
  });
  
  /// Get quality badge text
  String get qualityBadge {
    if (isHD) return 'HD';
    return quality;
  }
}

/// Server source enum
enum ServerSource {
  yallaShoot('YallaShoot'),
  koraOnline('KoraOnline'),
  liveKora('LiveKora'),
  korah('Korah'),
  koraPlus('KoraPlus'),
  sportsOnline('SportsOnline'),
  siiir('SIIIR');
  
  final String displayName;
  const ServerSource(this.displayName);
}
