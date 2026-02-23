import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/entities/match.dart';
import 'match_card.dart';

/// League section widget that groups matches by league
class LeagueSection extends StatelessWidget {
  final String leagueName;
  final String? leagueLogo;
  final String? country;
  final List<Match> matches;
  final Function(Match)? onMatchTap;
  
  const LeagueSection({
    super.key,
    required this.leagueName,
    this.leagueLogo,
    this.country,
    required this.matches,
    this.onMatchTap,
  });
  
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // League header
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              // League logo
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: AppColors.surfaceLight,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: leagueLogo != null
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: CachedNetworkImage(
                          imageUrl: leagueLogo!,
                          fit: BoxFit.contain,
                          errorWidget: (_, __, ___) => const Icon(
                            Icons.emoji_events,
                            size: 16,
                            color: AppColors.textTertiary,
                          ),
                        ),
                      )
                    : const Icon(
                        Icons.emoji_events,
                        size: 16,
                        color: AppColors.textTertiary,
                      ),
              ),
              const SizedBox(width: 12),
              
              // League name and country
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      leagueName,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (country != null)
                      Text(
                        country!,
                        style: const TextStyle(
                          color: AppColors.textTertiary,
                          fontSize: 11,
                        ),
                      ),
                  ],
                ),
              ),
              
              // Match count
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLight,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${matches.length}',
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ),
        
        // Matches list
        ...matches.map((match) => MatchCard(
          match: match,
          onTap: onMatchTap != null ? () => onMatchTap!(match) : null,
          showLeague: false,
        )),
        
        const SizedBox(height: 8),
      ],
    );
  }
}

/// Helper to group matches by league
class MatchGrouper {
  /// Group matches by league
  static Map<String, List<Match>> groupByLeague(List<Match> matches) {
    final Map<String, List<Match>> grouped = {};
    
    for (final match in matches) {
      final key = match.league;
      grouped.putIfAbsent(key, () => []);
      grouped[key]!.add(match);
    }
    
    return grouped;
  }
  
  /// Get league info from matches
  static LeagueInfo? getLeagueInfo(List<Match> matches) {
    if (matches.isEmpty) return null;
    
    final firstMatch = matches.first;
    return LeagueInfo(
      name: firstMatch.league,
      logo: firstMatch.leagueLogo,
      country: firstMatch.country,
    );
  }
  
  /// Sort matches by time
  static List<Match> sortByTime(List<Match> matches) {
    final sorted = List<Match>.from(matches);
    sorted.sort((a, b) => a.startTime.compareTo(b.startTime));
    return sorted;
  }
  
  /// Sort matches: live first, then by time
  static List<Match> sortWithLiveFirst(List<Match> matches) {
    final sorted = List<Match>.from(matches);
    sorted.sort((a, b) {
      // Live matches first
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      
      // Then by time
      return a.startTime.compareTo(b.startTime);
    });
    return sorted;
  }
}

/// League info model
class LeagueInfo {
  final String name;
  final String? logo;
  final String? country;
  
  const LeagueInfo({
    required this.name,
    this.logo,
    this.country,
  });
}
