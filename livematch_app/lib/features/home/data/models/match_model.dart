import '../../domain/entities/match.dart';

/// Match model for JSON serialization/deserialization
class MatchModel extends Match {
  const MatchModel({
    required super.id,
    required super.homeTeam,
    required super.awayTeam,
    super.homeTeamLogo,
    super.awayTeamLogo,
    super.homeScore,
    super.awayScore,
    required super.league,
    super.leagueLogo,
    super.country,
    required super.startTime,
    required super.status,
    super.minute,
    super.isLive,
    super.servers,
    super.stadium,
    super.referee,
  });
  
  /// Create from JSON
  factory MatchModel.fromJson(Map<String, dynamic> json) {
    return MatchModel(
      id: json['id']?.toString() ?? '',
      homeTeam: json['homeTeam'] ?? json['home'] ?? '',
      awayTeam: json['awayTeam'] ?? json['away'] ?? '',
      homeTeamLogo: json['homeTeamLogo'] ?? json['homeLogo'],
      awayTeamLogo: json['awayTeamLogo'] ?? json['awayLogo'],
      homeScore: json['homeScore'] ?? json['scoreHome'],
      awayScore: json['awayScore'] ?? json['scoreAway'],
      league: json['league'] ?? json['competition'] ?? '',
      leagueLogo: json['leagueLogo'] ?? json['competitionLogo'],
      country: json['country'],
      startTime: _parseDateTime(json['startTime'] ?? json['time'] ?? json['date']),
      status: _parseStatus(json['status']),
      minute: json['minute'],
      isLive: json['isLive'] ?? false,
      servers: _parseServers(json['servers'] ?? json['links']),
      stadium: json['stadium'],
      referee: json['referee'],
    );
  }
  
  /// Convert to JSON
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'homeTeam': homeTeam,
      'awayTeam': awayTeam,
      'homeTeamLogo': homeTeamLogo,
      'awayTeamLogo': awayTeamLogo,
      'homeScore': homeScore,
      'awayScore': awayScore,
      'league': league,
      'leagueLogo': leagueLogo,
      'country': country,
      'startTime': startTime.toIso8601String(),
      'status': status.name,
      'minute': minute,
      'isLive': isLive,
      'servers': servers.map((s) => {
        'id': s.id,
        'name': s.name,
        'quality': s.quality,
        'url': s.url,
        'isHD': s.isHD,
        'isPremium': s.isPremium,
        'source': s.source.name,
      }).toList(),
      'stadium': stadium,
      'referee': referee,
    };
  }
  
  /// Parse DateTime from various formats
  static DateTime _parseDateTime(dynamic value) {
    if (value == null) return DateTime.now();
    
    if (value is DateTime) return value;
    
    if (value is String) {
      // Try ISO 8601 format
      try {
        return DateTime.parse(value);
      } catch (_) {}
      
      // Try timestamp format
      try {
        final timestamp = int.parse(value);
        return DateTime.fromMillisecondsSinceEpoch(timestamp);
      } catch (_) {}
    }
    
    if (value is int) {
      return DateTime.fromMillisecondsSinceEpoch(value);
    }
    
    return DateTime.now();
  }
  
  /// Parse match status
  static MatchStatus _parseStatus(dynamic value) {
    if (value == null) return MatchStatus.scheduled;
    
    final statusStr = value.toString().toLowerCase();
    
    switch (statusStr) {
      case 'live':
      case 'inplay':
      case 'in_play':
        return MatchStatus.live;
      case 'halftime':
      case 'ht':
      case 'half_time':
        return MatchStatus.halftime;
      case 'finished':
      case 'ft':
      case 'full_time':
        return MatchStatus.finished;
      case 'postponed':
        return MatchStatus.postponed;
      case 'cancelled':
      case 'canceled':
        return MatchStatus.cancelled;
      case 'extratime':
      case 'et':
      case 'extra_time':
        return MatchStatus.extraTime;
      case 'penalties':
      case 'pen':
        return MatchStatus.penalties;
      default:
        return MatchStatus.scheduled;
    }
  }
  
  /// Parse servers list
  static List<StreamServer> _parseServers(dynamic value) {
    if (value == null) return [];
    
    if (value is! List) return [];
    
    return value.map<StreamServer?>((item) {
      if (item is! Map<String, dynamic>) return null;
      
      return StreamServer(
        id: item['id']?.toString() ?? '',
        name: item['name'] ?? item['server'] ?? 'Server',
        quality: item['quality'] ?? 'SD',
        url: item['url'] ?? item['link'],
        isHD: item['isHD'] ?? item['hd'] ?? false,
        isPremium: item['isPremium'] ?? item['premium'] ?? false,
        source: _parseSource(item['source']),
      );
    }).whereType<StreamServer>().toList();
  }
  
  /// Parse server source
  static ServerSource _parseSource(dynamic value) {
    if (value == null) return ServerSource.yallaShoot;
    
    final sourceStr = value.toString().toLowerCase();
    
    switch (sourceStr) {
      case 'yallashoot':
        return ServerSource.yallaShoot;
      case 'koraonline':
        return ServerSource.koraOnline;
      case 'livekora':
        return ServerSource.liveKora;
      case 'korah':
        return ServerSource.korah;
      case 'koraplus':
        return ServerSource.koraPlus;
      case 'sportsonline':
        return ServerSource.sportsOnline;
      case 'siiir':
        return ServerSource.siiir;
      default:
        return ServerSource.yallaShoot;
    }
  }
}
