import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/entities/match.dart' as match_entity;

/// Premium match card widget
class MatchCard extends StatelessWidget {
  final match_entity.Match match;
  final VoidCallback? onTap;
  final bool showLeague;
  
  const MatchCard({
    super.key,
    required this.match,
    this.onTap,
    this.showLeague = true,
  });
  
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: AppColors.cardGradient,
          ),
          borderRadius: BorderRadius.circular(16),
          border: match.isLive
              ? Border.all(color: AppColors.live.withOpacity(0.5), width: 1)
              : null,
          boxShadow: match.isLive
              ? [
                  BoxShadow(
                    color: AppColors.live.withOpacity(0.2),
                    blurRadius: 12,
                    spreadRadius: 0,
                  ),
                ]
              : null,
        ),
        child: Column(
          children: [
            // Header with league and time
            _buildHeader(),
            
            // Teams and score
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  // Home team
                  Expanded(
                    child: _buildTeam(
                      match.homeTeam,
                      match.homeTeamLogo,
                      match.homeScore,
                      match.isLive && (match.homeScore ?? 0) > (match.awayScore ?? 0),
                    ),
                  ),
                  
                  // Score / Time
                  _buildScoreOrTime(),
                  
                  // Away team
                  Expanded(
                    child: _buildTeam(
                      match.awayTeam,
                      match.awayTeamLogo,
                      match.awayScore,
                      match.isLive && (match.awayScore ?? 0) > (match.homeScore ?? 0),
                    ),
                  ),
                ],
              ),
            ),
            
            // Server indicators
            if (match.servers.isNotEmpty) _buildServerIndicators(),
          ],
        ),
      ),
    );
  }
  
  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight.withOpacity(0.5),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
      ),
      child: Row(
        children: [
          // League info
          if (showLeague) ...[
            if (match.leagueLogo != null)
              Container(
                width: 20,
                height: 20,
                margin: const EdgeInsets.only(right: 8),
                child: CachedNetworkImage(
                  imageUrl: match.leagueLogo!,
                  errorWidget: (_, __, ___) => const Icon(
                    Icons.sports_soccer,
                    size: 16,
                    color: AppColors.textTertiary,
                  ),
                ),
              ),
            Expanded(
              child: Text(
                match.league,
                style: const TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ] else
            const Spacer(),
          
          // Time / Status
          if (match.isLive)
            _buildLiveBadge()
          else
            Text(
              match.formattedTime,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
        ],
      ),
    );
  }
  
  Widget _buildLiveBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: AppColors.liveGradient,
        ),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: const BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 4),
          Text(
            match.minute != null ? "${match.minute}'" : 'LIVE',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 10,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildTeam(String name, String? logo, int? score, bool isWinning) {
    return Column(
      children: [
        // Team logo
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: AppColors.surfaceLight,
            shape: BoxShape.circle,
          ),
          child: logo != null
              ? ClipOval(
                  child: CachedNetworkImage(
                    imageUrl: logo,
                    width: 40,
                    height: 40,
                    fit: BoxFit.contain,
                    placeholder: (_, __) => const Center(
                      child: SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.textTertiary,
                        ),
                      ),
                    ),
                    errorWidget: (_, __, ___) => const Icon(
                      Icons.sports_soccer,
                      color: AppColors.textTertiary,
                    ),
                  ),
                )
              : const Icon(
                  Icons.sports_soccer,
                  color: AppColors.textTertiary,
                ),
        ),
        const SizedBox(height: 8),
        
        // Team name
        Text(
          name,
          style: TextStyle(
            color: isWinning ? AppColors.textPrimary : AppColors.textSecondary,
            fontSize: 12,
            fontWeight: isWinning ? FontWeight.w600 : FontWeight.w500,
          ),
          textAlign: TextAlign.center,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
  
  Widget _buildScoreOrTime() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: match.hasStarted
          ? Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildScoreText(match.homeScore?.toString() ?? '0', match.isLive),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 8),
                  child: Text(
                    '-',
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                _buildScoreText(match.awayScore?.toString() ?? '0', match.isLive),
              ],
            )
          : Column(
              children: [
                Text(
                  match.formattedTime,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  match.formattedDate,
                  style: const TextStyle(
                    color: AppColors.textTertiary,
                    fontSize: 10,
                  ),
                ),
              ],
            ),
    );
  }
  
  Widget _buildScoreText(String score, bool isLive) {
    return Text(
      score,
      style: TextStyle(
        color: isLive ? AppColors.primary : AppColors.textPrimary,
        fontSize: 24,
        fontWeight: FontWeight.bold,
      ),
    );
  }
  
  Widget _buildServerIndicators() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.play_circle_outline,
            size: 14,
            color: match.servers.any((s) => s.isHD)
                ? AppColors.primary
                : AppColors.textTertiary,
          ),
          const SizedBox(width: 4),
          Text(
            '${match.servers.length} ${match.servers.length == 1 ? 'server' : 'servers'}',
            style: const TextStyle(
              color: AppColors.textTertiary,
              fontSize: 11,
            ),
          ),
          if (match.servers.any((s) => s.isHD)) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.2),
                borderRadius: BorderRadius.circular(2),
              ),
              child: const Text(
                'HD',
                style: TextStyle(
                  color: AppColors.primary,
                  fontSize: 9,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
