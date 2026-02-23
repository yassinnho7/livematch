import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../home/domain/entities/match.dart';
import '../../../home/presentation/providers/match_provider.dart';
import 'package:provider/provider.dart';

/// TV Home Screen with D-pad navigation support
class TVHomeScreen extends StatefulWidget {
  const TVHomeScreen({super.key});
  
  @override
  State<TVHomeScreen> createState() => _TVHomeScreenState();
}

class _TVHomeScreenState extends State<TVHomeScreen> {
  final FocusNode _focusNode = FocusNode();
  int _selectedIndex = 0;
  List<Match> _matches = [];
  
  @override
  void initState() {
    super.initState();
    
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<MatchProvider>().fetchMatches();
      _focusNode.requestFocus();
    });
  }
  
  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }
  
  void _handleKeyEvent(KeyEvent event) {
    if (event is! KeyDownEvent) return;
    
    final logicalKey = event.logicalKey;
    
    if (logicalKey == LogicalKeyboardKey.arrowUp) {
      _moveSelection(-1);
    } else if (logicalKey == LogicalKeyboardKey.arrowDown) {
      _moveSelection(1);
    } else if (logicalKey == LogicalKeyboardKey.select ||
        logicalKey == LogicalKeyboardKey.enter) {
      _onSelect();
    }
  }
  
  void _moveSelection(int delta) {
    setState(() {
      _selectedIndex = (_selectedIndex + delta).clamp(0, _matches.length - 1);
    });
  }
  
  void _onSelect() {
    if (_matches.isNotEmpty && _selectedIndex < _matches.length) {
      final match = _matches[_selectedIndex];
      // Navigate to player
      // context.go('/match/${match.id}', extra: match);
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return KeyboardListener(
      focusNode: _focusNode,
      onKeyEvent: _handleKeyEvent,
      child: Scaffold(
        backgroundColor: AppColors.background,
        body: Consumer<MatchProvider>(
          builder: (context, provider, child) {
            _matches = provider.matches;
            
            if (provider.state == MatchListState.loading) {
              return const Center(
                child: CircularProgressIndicator(
                  color: AppColors.primary,
                ),
              );
            }
            
            if (provider.state == MatchListState.error) {
              return _buildError(provider.error ?? 'Unknown error');
            }
            
            if (_matches.isEmpty) {
              return _buildEmpty();
            }
            
            return _buildMatchList();
          },
        ),
      ),
    );
  }
  
  Widget _buildMatchList() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header
        _buildHeader(),
        
        // Match grid
        Expanded(
          child: GridView.builder(
            padding: const EdgeInsets.all(32),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              childAspectRatio: 1.5,
              crossAxisSpacing: 24,
              mainAxisSpacing: 24,
            ),
            itemCount: _matches.length,
            itemBuilder: (context, index) {
              return _buildTVMatchCard(_matches[index], index);
            },
          ),
        ),
      ],
    );
  }
  
  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.all(32),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: AppColors.primaryGradient,
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.sports_soccer,
              color: AppColors.background,
              size: 32,
            ),
          ),
          const SizedBox(width: 16),
          const Text(
            'LiveMatch TV',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 32,
              fontWeight: FontWeight.bold,
            ),
          ),
          const Spacer(),
          // Navigation hint
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Row(
              children: [
                Icon(Icons.keyboard_arrow_up, color: AppColors.textTertiary),
                Icon(Icons.keyboard_arrow_down, color: AppColors.textTertiary),
                SizedBox(width: 8),
                Text(
                  'Navigate',
                  style: TextStyle(color: AppColors.textTertiary),
                ),
                SizedBox(width: 16),
                Icon(Icons.keyboard_return, color: AppColors.textTertiary),
                SizedBox(width: 8),
                Text(
                  'Select',
                  style: TextStyle(color: AppColors.textTertiary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildTVMatchCard(Match match, int index) {
    final isSelected = index == _selectedIndex;
    
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isSelected
              ? [AppColors.surfaceLight, AppColors.card]
              : [AppColors.card, AppColors.surface],
        ),
        borderRadius: BorderRadius.circular(16),
        border: isSelected
            ? Border.all(color: AppColors.primary, width: 3)
            : null,
        boxShadow: isSelected
            ? [
                BoxShadow(
                  color: AppColors.primary.withOpacity(0.3),
                  blurRadius: 20,
                  spreadRadius: 2,
                ),
              ]
            : null,
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // League
            Text(
              match.league,
              style: const TextStyle(
                color: AppColors.textTertiary,
                fontSize: 12,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 12),
            
            // Teams
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Expanded(
                  child: Text(
                    match.homeTeam,
                    style: TextStyle(
                      color: isSelected ? AppColors.textPrimary : AppColors.textSecondary,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                
                // Score or Time
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 16),
                  child: match.hasStarted
                      ? Text(
                          '${match.homeScore ?? 0} - ${match.awayScore ?? 0}',
                          style: TextStyle(
                            color: match.isLive ? AppColors.primary : AppColors.textPrimary,
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                        )
                      : Text(
                          match.formattedTime,
                          style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                ),
                
                Expanded(
                  child: Text(
                    match.awayTeam,
                    style: TextStyle(
                      color: isSelected ? AppColors.textPrimary : AppColors.textSecondary,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            
            // Live badge
            if (match.isLive) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: AppColors.liveGradient,
                  ),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  match.minute != null ? "LIVE ${match.minute}'" : 'LIVE',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
  
  Widget _buildError(String error) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            Icons.error_outline,
            size: 64,
            color: AppColors.error,
          ),
          const SizedBox(height: 16),
          Text(
            'Failed to load matches',
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 24,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            error,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () => context.read<MatchProvider>().fetchMatches(),
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }
  
  Widget _buildEmpty() {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.sports_soccer,
            size: 64,
            color: AppColors.textTertiary,
          ),
          SizedBox(height: 16),
          Text(
            'No matches available',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 24,
            ),
          ),
        ],
      ),
    );
  }
}
